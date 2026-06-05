// Agent-core runtime: the tool-use loop.
//
// Responsibilities:
//   - Drive the Run through the formal state machine (never mutate status directly).
//   - Call the model, execute requested tools, and persist a full Step trace.
//   - Charge the ledger idempotently per tool call.
//   - Surface failure by throwing, so the execution plane can retry / DLQ.

import { isTerminal, transition } from '../domain/runStateMachine';
import { ModelMessage, ModelProvider } from '../ports/model';
import { Repository } from '../ports/repository';
import { ToolRegistry } from '../tools/registry';
import { Ledger } from '../billing/ledger';
import { tokensToCredits, CREDITS_PER_TOOL_CALL } from '../billing/cost';
import { Step } from '../domain/types';
import { EventBus, emit } from '../events/bus';
import { MemoryStore, memoryText } from '../ports/memory';
import { Sandbox } from '../ports/sandbox';

export interface RuntimeDeps {
  repo: Repository;
  model: ModelProvider;
  tools: ToolRegistry;
  ledger: Ledger;
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
}

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Run not found: ${runId}`);
    this.name = 'RunNotFoundError';
  }
}

export async function executeRun(runId: string, deps: RuntimeDeps): Promise<void> {
  const { repo, model, tools, ledger } = deps;
  const maxIterations = deps.maxIterations ?? 10;

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

  // Step index is deterministic across retries so ledger charges stay idempotent.
  let stepIndex = 0;
  const messages: ModelMessage[] = [{ role: 'user', content: task }];

  try {
    for (let iter = 0; iter < maxIterations; iter++) {
      const started = Date.now();
      const turn = await model.complete({
        system,
        messages,
        tools: tools.schemas(),
      });

      // Persist the assistant turn.
      await appendStep(repo, {
        runId,
        index: stepIndex++,
        role: 'assistant',
        input: undefined,
        output: turn.text ?? '',
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

      // Charge token usage for the assistant turn (idempotent on toolCallId="turn:<i>").
      const tokenCredits = tokensToCredits(turn.tokensIn, turn.tokensOut);
      if (tokenCredits > 0) {
        await ledger.charge({
          orgId: run.orgId,
          runId,
          stepIndex: stepIndex - 1,
          toolCallId: `turn:${iter}`,
          amount: tokenCredits,
          reason: 'model tokens',
        });
      }

      if (turn.toolCalls.length === 0) {
        // No tools requested => final answer.
        const credits = await ledger.totalForRun(runId);
        await repo.updateRunStatus(runId, transition('running', 'succeeded'), {
          output: turn.text ?? '',
          creditsUsed: credits,
        });
        await repo.audit({
          orgId: run.orgId,
          runId,
          actor: 'runtime',
          action: 'run.succeeded',
          meta: { creditsUsed: credits },
        });
        emit(deps.events, 'run.succeeded', runId, run.orgId, { creditsUsed: credits });

        // F5: persist an episodic summary of this run for future recall.
        if (deps.memory) {
          await deps.memory.remember({
            agentId: agent.id,
            kind: 'episodic',
            runId,
            content: { task, summary: truncate(turn.text ?? '', 500) },
          });
        }
        return;
      }

      if (turn.text) {
        messages.push({ role: 'assistant', content: turn.text });
      }

      // Execute each requested tool call.
      for (const call of turn.toolCalls) {
        const toolStarted = Date.now();
        const result = await tools.run(call.name, call.input, {
          allowlistDomains: deps.allowlistDomains,
          sandbox: deps.sandbox,
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

        // Idempotent per-tool-call charge.
        await ledger.charge({
          orgId: run.orgId,
          runId,
          stepIndex: stepIndex - 1,
          toolCallId: call.id,
          amount: CREDITS_PER_TOOL_CALL,
          reason: `tool:${call.name}`,
        });

        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    throw new Error(`Run exceeded max iterations (${maxIterations})`);
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
