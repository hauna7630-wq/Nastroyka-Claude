// Agent-core runtime: the tool-use loop.
//
// Responsibilities:
//   - Drive the Run through the formal state machine (never mutate status directly).
//   - Call the model, execute requested tools, and persist a full Step trace.
//   - Track token usage (metrics only — no money/billing).
//   - Surface failure by throwing, so the execution plane can retry / DLQ.

import { isTerminal, transition } from '../domain/runStateMachine';
import { EMPTY_OUTPUT_ERROR, isPlaceholderText } from '../domain/errors';
import { ModelMessage, ModelProvider } from '../ports/model';
import { Repository } from '../ports/repository';
import { ToolRegistry, ToolNotAllowedError } from '../tools/registry';
import { Step } from '../domain/types';
import { EventBus, emit } from '../events/bus';
import { MemoryStore, memoryText } from '../ports/memory';
import { Sandbox } from '../ports/sandbox';
import { SearchProvider } from '../ports/search';
import { DocumentParser } from '../ports/documents';
import { PiiMasker } from '../security/pii';

export interface RuntimeDeps {
  repo: Repository;
  model: ModelProvider;
  tools: ToolRegistry;
  allowlistDomains: string[];
  maxIterations?: number;
  // Optional Control-Plane event bus (F4). When present, the runtime streams
  // lifecycle events for live status/observability.
  events?: EventBus;
  // Optional agent memory (F5). When present, relevant long-term/episodic memory
  // is recalled into the prompt and an episodic summary is written on success.
  memory?: MemoryStore;
  // Optional code-execution sandbox (F3) made available to the code_exec tool.
  sandbox?: Sandbox;
  // Optional PRD §3 integration tools.
  search?: SearchProvider;
  documents?: DocumentParser;
  // Optional PII masker. When present, prompts are masked before the model call
  // and the model's output is un-masked afterwards.
  pii?: PiiMasker;
}

// PRD M3: hard loop-control limit. If two agents (or one loop) can't finish within
// this many iterations the run is stopped for human review (human-in-the-loop).
export const DEFAULT_MAX_ITERATIONS = 5;

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Run not found: ${runId}`);
    this.name = 'RunNotFoundError';
  }
}

// Raised when a run exhausts its iteration budget — surfaced for a human.
export class MaxIterationsError extends Error {
  constructor(public readonly maxIterations: number) {
    super(`Run exceeded max iterations (${maxIterations}) — needs human review`);
    this.name = 'MaxIterationsError';
  }
}

// Degradation guard: the model produced no real final answer (empty text or a
// placeholder like "…"). The run must FAIL (worker retries → DLQ), never
// succeed with an empty output the user sees as "...".
export class EmptyModelOutputError extends Error {
  constructor() {
    super(EMPTY_OUTPUT_ERROR);
    this.name = 'EmptyModelOutputError';
  }
}

export async function executeRun(runId: string, deps: RuntimeDeps): Promise<void> {
  const { repo, model, tools } = deps;
  const maxIterations = deps.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  const run = await repo.getRun(runId);
  if (!run) throw new RunNotFoundError(runId);

  // Duplicate delivery of an already-completed run is a no-op (idempotent),
  // not an illegal transition out of a terminal state.
  if (isTerminal(run.status)) {
    await repo.audit({
      orgId: run.orgId,
      runId,
      actor: 'runtime',
      action: 'run.skipped_terminal',
      meta: { status: run.status },
    });
    return;
  }

  const agent = await repo.getAgent(run.agentId);
  if (!agent) throw new Error(`Agent not found: ${run.agentId}`);

  // queued/paused -> running. On a retry the run may already be 'running'
  // (the worker owns the terminal failed/DLQ transition), so re-entry is a no-op
  // rather than an illegal self-transition.
  if (run.status !== 'running') {
    await repo.updateRunStatus(runId, transition(run.status, 'running'));
  }
  await repo.audit({
    orgId: run.orgId,
    runId,
    actor: 'runtime',
    action: 'run.started',
    meta: { attempt: run.attempts },
  });
  emit(deps.events, 'run.started', runId, run.orgId, { attempt: run.attempts });

  // F5: recall relevant long-term/episodic memory into the system prompt.
  const task = toPrompt(run.input);
  let system = agent.systemPrompt;
  if (deps.memory) {
    const recalled = await deps.memory.recall(agent.id, {
      kinds: ['long_term', 'episodic'],
      query: task,
      limit: 5,
    });
    if (recalled.length > 0) {
      system +=
        '\n\n# Relevant memory\n' +
        recalled.map((m) => `- (${m.kind}) ${memoryText(m)}`).join('\n');
    }
  }

  let stepIndex = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  const messages: ModelMessage[] = [{ role: 'user', content: task }];
  // Per-run PII token mapping (never sent to the provider).
  const piiMap = new Map<string, string>();

  // Live token streaming (UX only) — wired for chat runs, where a human waits on
  // the bubble. Deltas are throttled and forwarded as `run.token` events; the
  // authoritative answer is still the final persisted output, so a dropped or
  // partial stream never affects correctness. PII-masked output is un-masked
  // before it leaves so the user never sees a masking token.
  const inputObj =
    run.input && typeof run.input === 'object'
      ? (run.input as { chat?: unknown; stream?: unknown })
      : undefined;
  // Stream live tokens for personal chat (chat:true) AND for orchestration child
  // runs (stream:true) — the latter are bridged onto the parent stream so the
  // "Обсуждение команды" panel can show each agent typing.
  const isChat = !!deps.events && !!inputObj && (inputObj.chat === true || inputObj.stream === true);
  let tokenBuf = '';
  let lastTokenFlush = 0;
  const flushTokens = (force: boolean): void => {
    if (!tokenBuf) return;
    const now = Date.now();
    if (!force && now - lastTokenFlush < 90) return;
    const chunk = deps.pii ? deps.pii.unmask(tokenBuf, piiMap) : tokenBuf;
    tokenBuf = '';
    lastTokenFlush = now;
    emit(deps.events, 'run.token', runId, run.orgId, { text: chunk });
  };
  const onText = isChat
    ? (delta: string): void => {
        tokenBuf += delta;
        flushTokens(false);
      }
    : undefined;

  try {
    for (let iter = 0; iter < maxIterations; iter++) {
      const started = Date.now();
      // Mask outgoing prompt (system + messages) before it leaves for the model.
      const outSystem = deps.pii ? deps.pii.mask(system, piiMap) : system;
      const outMessages = deps.pii
        ? messages.map((m) => ({ ...m, content: deps.pii!.mask(m.content, piiMap) }))
        : messages;
      const turn = await model.complete({
        system: outSystem,
        messages: outMessages,
        tools: tools.schemas(),
        onText,
        capabilities: { webSearch: !!agent.allowedTools?.includes('web_search') },
      });
      flushTokens(true);
      // Un-mask the model's text back into real values for storage/use.
      const text = deps.pii ? deps.pii.unmask(turn.text ?? '', piiMap) : turn.text ?? '';
      tokensIn += turn.tokensIn;
      tokensOut += turn.tokensOut;

      // Persist the assistant turn. The FIRST assistant step also carries a
      // truncated preview of the composed prompt (system + task) — that is the
      // debug-mode "what did the agent actually see" trace, with zero schema
      // change (Step.input already exists; upserts only set input on create).
      await appendStep(repo, {
        runId,
        index: stepIndex++,
        role: 'assistant',
        input:
          iter === 0
            ? { system: truncate(outSystem, 2000), task: truncate(task, 2000) }
            : undefined,
        output: text,
        latencyMs: Date.now() - started,
        tokensIn: turn.tokensIn,
        tokensOut: turn.tokensOut,
      });
      emit(deps.events, 'step.appended', runId, run.orgId, {
        index: stepIndex - 1,
        role: 'assistant',
        tokensIn: turn.tokensIn,
        tokensOut: turn.tokensOut,
      });

      if (turn.toolCalls.length === 0) {
        // No tools requested => final answer. Degradation guard first: an
        // empty/placeholder answer is a FAILURE (retried, then DLQ'd with an
        // honest reason), never a silent empty success.
        if (!text.trim() || isPlaceholderText(text)) {
          throw new EmptyModelOutputError();
        }
        await repo.updateRunStatus(runId, transition('running', 'succeeded'), { output: text });
        await repo.audit({
          orgId: run.orgId,
          runId,
          actor: 'runtime',
          action: 'run.succeeded',
          meta: { tokensIn, tokensOut },
        });
        emit(deps.events, 'run.succeeded', runId, run.orgId, { tokensIn, tokensOut });

        // F5: persist an episodic summary of this run for future recall.
        if (deps.memory) {
          await deps.memory.remember({
            agentId: agent.id,
            kind: 'episodic',
            runId,
            content: { task, summary: truncate(text, 500) },
          });
        }
        return;
      }

      if (text) {
        messages.push({ role: 'assistant', content: text });
      }

      // Execute each requested tool call.
      for (const call of turn.toolCalls) {
        // PRD M2: enforce the agent's per-agent tool allowlist.
        if (
          agent.allowedTools &&
          agent.allowedTools.length > 0 &&
          !agent.allowedTools.includes(call.name)
        ) {
          throw new ToolNotAllowedError(agent.id, call.name);
        }
        const toolStarted = Date.now();
        const result = await tools.run(call.name, call.input, {
          allowlistDomains: deps.allowlistDomains,
          sandbox: deps.sandbox,
          search: deps.search,
          documents: deps.documents,
        });

        await appendStep(repo, {
          runId,
          index: stepIndex++,
          role: 'tool',
          toolName: call.name,
          toolCallId: call.id,
          input: call.input,
          output: result,
          latencyMs: Date.now() - toolStarted,
        });
        emit(deps.events, 'step.appended', runId, run.orgId, {
          index: stepIndex - 1,
          role: 'tool',
          toolName: call.name,
        });

        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Loop-control limit hit: stop and flag for a human (HITL).
    emit(deps.events, 'run.needs_human', runId, run.orgId, { maxIterations });
    throw new MaxIterationsError(maxIterations);
  } catch (err) {
    // Record the attempt error but leave the run 'running': the execution plane
    // decides retry vs terminal failure (running -> failed) and DLQ routing.
    const message = err instanceof Error ? err.message : String(err);
    await repo.updateRunStatus(runId, 'running', { error: message });
    await repo.audit({
      orgId: run.orgId,
      runId,
      actor: 'runtime',
      action: 'run.attempt_failed',
      meta: { error: message },
    });
    throw err;
  }
}

export function toPrompt(input: unknown): string {
  if (input && typeof input === 'object' && 'prompt' in input) {
    return String((input as { prompt: unknown }).prompt);
  }
  return typeof input === 'string' ? input : JSON.stringify(input);
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

async function appendStep(repo: Repository, step: Step): Promise<void> {
  await repo.appendStep(step);
}
