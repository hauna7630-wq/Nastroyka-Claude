// Control Plane (F4): the API surface that creates work, reports status, exposes
// observability and manages the DLQ. Framework-agnostic — these are plain async
// methods so they're trivially testable; the HTTP/SSE server (src/api/server.ts)
// is a thin adapter over them.

import { randomUUID } from 'crypto';
import { Repository } from '../ports/repository';
import { Queue } from '../ports/queue';
import { Observability } from '../observability/metrics';
import { EventBus } from '../events/bus';
import { DocumentParser } from '../ports/documents';
import { humanizeRunError } from '../domain/errors';
import { assembleChatPrompt, outputToReplyText } from '../agent/chatPrompt';
import { deriveTeamPhase, PHASE_LABEL, subtaskIdOf, TeamPhase } from '../orchestrator/phase';
import { verdictNeedsRework } from '../orchestrator/orchestrator';
import {
  AgentType,
  ChatMessageRecord,
  DeadLetterRecord,
  Run,
  RunStatus,
} from '../domain/types';

export interface ControlPlaneDeps {
  repo: Repository;
  queue: Queue;
  observability: Observability;
  events?: EventBus;
  // Doc-1 file handling: lets the chat UI extract text from an uploaded file
  // before it goes into the agent prompt.
  documents?: DocumentParser;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`Not found: ${what}`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ControlPlane {
  constructor(private readonly deps: ControlPlaneDeps) {}

  // --- Agent Factory (PRD M2) ---

  async createAgent(args: {
    orgId: string;
    name: string;
    type: AgentType;
    systemPrompt: string;
    allowedTools?: string[];
  }) {
    const org = await this.deps.repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    if (!args.name?.trim()) throw new ValidationError('agent name is required');
    const agent = await this.deps.repo.createAgent(args);
    await this.deps.repo.audit({
      orgId: args.orgId,
      actor: 'control-plane',
      action: 'agent.created',
      meta: { agentId: agent.id, type: agent.type },
    });
    return agent;
  }

  async listAgents(orgId: string) {
    return this.deps.repo.listAgents(orgId);
  }

  // --- Runs ---

  async createRun(args: {
    orgId: string;
    agentId: string;
    input: unknown;
    // Caller-supplied id (chat persists the user message linked to the run
    // BEFORE enqueue, so it needs the id up front). Defaults to a fresh UUID.
    runId?: string;
  }): Promise<{ runId: string; status: string }> {
    const org = await this.deps.repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    const agent = await this.deps.repo.getAgent(args.agentId);
    if (!agent || agent.orgId !== args.orgId) {
      throw new NotFoundError(`agent ${args.agentId}`);
    }

    const runId = args.runId ?? randomUUID();
    const run: Run = {
      id: runId,
      orgId: args.orgId,
      agentId: args.agentId,
      status: 'queued',
      input: args.input,
      attempts: 0,
    };
    await this.deps.repo.createRun(run);
    await this.deps.repo.audit({
      orgId: args.orgId,
      runId,
      actor: 'control-plane',
      action: 'run.created',
    });
    await this.deps.queue.enqueue({ runId });

    return { runId, status: 'queued' };
  }

  // Coordinator entry point (PRD M1/M5): submit a natural-language task; it is
  // routed to the org's orchestrator agent, which decomposes + assigns it.
  async submitTask(args: { orgId: string; task: string }) {
    const org = await this.deps.repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    if (!args.task?.trim()) throw new ValidationError('task is required');
    const orchestrator = await this.deps.repo.findAgentByType(args.orgId, 'orchestrator');
    if (!orchestrator) {
      throw new ValidationError(`org ${args.orgId} has no orchestrator agent`);
    }
    return this.createRun({ orgId: args.orgId, agentId: orchestrator.id, input: { prompt: args.task } });
  }

  async getRun(runId: string) {
    const run = await this.deps.repo.getRun(runId);
    if (!run) throw new NotFoundError(`run ${runId}`);
    const trace = await this.deps.observability.runTrace(runId);
    // Honest error surface: a human-readable reason alongside the raw error.
    const errorHuman = humanizeRunError(run.error, run.status);
    return { run, trace, ...(errorHuman ? { errorHuman } : {}) };
  }

  // Operator "Повторить" for a failed run (chat retry button). Reuses the DLQ
  // requeue path: validates the failed state, resets the attempt budget,
  // audits, and re-enqueues the SAME run id (the chat reply backfill then
  // attaches to the same thread message).
  async retryRun(runId: string): Promise<{ runId: string; status: string }> {
    return this.requeueDeadLetter(runId);
  }

  // --- Task lifecycle: phases + internal team discussion (Doc-A stages 5-8) ---

  // Everything here is derived from already-persisted runs: child runs ARE the
  // internal discussion (contributions, review critique, revision), so the
  // feed survives reloads/restarts for free.
  async getRunTeam(runId: string): Promise<{
    run: Run;
    phase: TeamPhase;
    phaseLabel: string;
    children: Array<{
      runId: string;
      subtaskId: string;
      agentName: string;
      agentType: string;
      status: string;
      errorHuman?: string;
      outputPreview?: string;
    }>;
    review?: { agentName: string; verdict: 'approved' | 'rework' | null; text: string };
    discussion: Array<{
      author: string;
      agentType: string;
      kind: 'contribution' | 'review' | 'revision';
      text: string;
    }>;
  }> {
    const { repo } = this.deps;
    const run = await repo.getRun(runId);
    if (!run) throw new NotFoundError(`run ${runId}`);
    const children = await repo.listChildRuns(runId);
    const phase = deriveTeamPhase(run, children);

    const agentNames = new Map<string, { name: string; type: string }>();
    const childViews = [] as Array<{
      runId: string; subtaskId: string; agentName: string; agentType: string;
      status: string; errorHuman?: string; outputPreview?: string;
    }>;
    const discussion = [] as Array<{
      author: string; agentType: string; kind: 'contribution' | 'review' | 'revision'; text: string;
    }>;
    let review: { agentName: string; verdict: 'approved' | 'rework' | null; text: string } | undefined;

    for (const child of children) {
      let who = agentNames.get(child.agentId);
      if (!who) {
        const agent = await repo.getAgent(child.agentId);
        who = { name: agent?.name ?? child.agentId, type: agent?.type ?? 'researcher' };
        agentNames.set(child.agentId, who);
      }
      const sid = subtaskIdOf(child);
      const text = child.output !== undefined ? outputToReplyText(child.output) : '';
      childViews.push({
        runId: child.id,
        subtaskId: sid,
        agentName: who.name,
        agentType: who.type,
        status: child.status,
        errorHuman: humanizeRunError(child.error, child.status),
        outputPreview: text ? text.slice(0, 280) : undefined,
      });
      if (!text) continue;
      const kind = sid === 'review' ? 'review' : sid === 'rev1' ? 'revision' : 'contribution';
      discussion.push({ author: who.name, agentType: who.type, kind, text });
      if (kind === 'review') {
        review = {
          agentName: who.name,
          verdict: verdictNeedsRework(child.output)
            ? 'rework'
            : /готово к выпуску/i.test(text)
              ? 'approved'
              : null,
          text,
        };
      }
    }

    return { run, phase, phaseLabel: PHASE_LABEL[phase], children: childViews, review, discussion };
  }

  // Per-agent run journal (observability / debug).
  async listAgentRuns(orgId: string, agentId: string, limit = 20) {
    const agent = await this.deps.repo.getAgent(agentId);
    if (!agent || agent.orgId !== orgId) throw new NotFoundError(`agent ${agentId}`);
    const runs = await this.deps.repo.listRunsByOrg(orgId, { agentId, limit });
    return runs.map((run) => ({
      run,
      errorHuman: humanizeRunError(run.error, run.status),
    }));
  }

  // --- Personal chat (dialog memory; one persistent thread per org+agent) ---

  async sendChatMessage(args: {
    orgId: string;
    agentId: string;
    text: string;
    attachment?: { filename: string; text: string };
  }): Promise<{ runId: string; status: string; message: ChatMessageRecord }> {
    const { repo } = this.deps;
    if (!args.text?.trim() && !args.attachment) {
      throw new ValidationError('текст сообщения пуст');
    }
    const org = await repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    const agent = await repo.getAgent(args.agentId);
    if (!agent || agent.orgId !== args.orgId) {
      throw new NotFoundError(`agent ${args.agentId}`);
    }

    const text = args.text?.trim() || 'Изучи приложенный файл и дай краткие выводы.';

    // Context: the persisted thread (with any completed replies backfilled
    // first, so the prompt sees them).
    const history = await repo.listChatMessages(args.orgId, args.agentId, 12);
    await this.backfillChatReplies(args.orgId, args.agentId, history);
    const fresh = await repo.listChatMessages(args.orgId, args.agentId, 12);

    // The new user turn: inline the attachment for the model, keep the thread
    // display text short.
    const promptPart = args.attachment
      ? 'Файл "' + args.attachment.filename + '":\n"""\n' + args.attachment.text + '\n"""\n\n' + text
      : text;
    const displayText = args.attachment ? text + ' 📎 ' + args.attachment.filename : text;

    const runId = randomUUID();
    const message = await repo.appendChatMessage({
      orgId: args.orgId,
      agentId: args.agentId,
      role: 'user',
      text: displayText,
      runId,
    });

    const prompt = assembleChatPrompt(fresh, promptPart);
    const { status } = await this.createRun({
      orgId: args.orgId,
      agentId: args.agentId,
      runId,
      input: { prompt, chat: true, message: text },
    });
    return { runId, status, message };
  }

  async getChatHistory(args: {
    orgId: string;
    agentId: string;
    limit?: number;
  }): Promise<{
    messages: ChatMessageRecord[];
    pending: Array<{ runId: string; status: RunStatus; errorHuman?: string }>;
  }> {
    const { repo } = this.deps;
    const agent = await repo.getAgent(args.agentId);
    if (!agent || agent.orgId !== args.orgId) {
      throw new NotFoundError(`agent ${args.agentId}`);
    }
    const history = await repo.listChatMessages(args.orgId, args.agentId, args.limit ?? 100);
    const pending = await this.backfillChatReplies(args.orgId, args.agentId, history);
    const messages = await repo.listChatMessages(args.orgId, args.agentId, args.limit ?? 100);
    return { messages, pending };
  }

  // Lazy reply backfill: Postgres Run.output is the source of truth. For every
  // user message whose run has succeeded but whose reply row is missing, insert
  // it (idempotent via the (runId, role) unique key — crash- and race-safe).
  // Failed/non-terminal runs are reported as `pending` with an honest reason,
  // NOT materialized as messages (a later retry of the same run id can still
  // land its one reply).
  private async backfillChatReplies(
    orgId: string,
    agentId: string,
    history: ChatMessageRecord[],
  ): Promise<Array<{ runId: string; status: RunStatus; errorHuman?: string }>> {
    const { repo } = this.deps;
    const replied = new Set(
      history.filter((m) => m.role === 'agent' && m.runId).map((m) => m.runId),
    );
    const pending: Array<{ runId: string; status: RunStatus; errorHuman?: string }> = [];
    for (const m of history) {
      if (m.role !== 'user' || !m.runId || replied.has(m.runId)) continue;
      const run = await repo.getRun(m.runId);
      if (!run) continue;
      if (run.status === 'succeeded') {
        await repo.appendChatReplyIfAbsent({
          orgId,
          agentId,
          role: 'agent',
          text: outputToReplyText(run.output),
          runId: m.runId,
        });
        replied.add(m.runId);
      } else {
        pending.push({
          runId: m.runId,
          status: run.status,
          errorHuman: humanizeRunError(run.error, run.status),
        });
      }
    }
    return pending;
  }

  // --- Observability ---

  async runMetrics(runId: string) {
    const metrics = await this.deps.observability.runMetrics(runId);
    if (!metrics) throw new NotFoundError(`run ${runId}`);
    return metrics;
  }

  async tokenBurn(orgId: string) {
    return this.deps.observability.tokenBurnByAgent(orgId);
  }

  // --- Dead letter queue ---

  async listDeadLetters(): Promise<DeadLetterRecord[]> {
    return this.deps.repo.listDeadLetters();
  }

  async requeueDeadLetter(runId: string): Promise<{ runId: string; status: string }> {
    const run = await this.deps.repo.getRun(runId);
    if (!run) throw new NotFoundError(`run ${runId}`);
    if (run.status !== 'failed') {
      throw new ValidationError(`run ${runId} is not in a failed state (${run.status})`);
    }
    // Operator re-open: reset the attempt budget and re-queue. This deliberately
    // re-opens a terminal run, so it is audited explicitly.
    this.deps.queue.reset(runId);
    await this.deps.repo.updateRunStatus(runId, 'queued', { attempts: 0, error: undefined });
    await this.deps.repo.markDeadLetterRequeued(runId);
    await this.deps.repo.audit({
      orgId: run.orgId,
      runId,
      actor: 'control-plane',
      action: 'run.requeued',
    });
    await this.deps.queue.enqueue({ runId });
    return { runId, status: 'queued' };
  }

  // --- Documents (Doc-1 file handling) ---

  // Extract text from an uploaded file so the chat can inline it into the
  // prompt. Unreadable files surface their honest, actionable message (the
  // parser proposes a concrete fix) as a ValidationError, not a 500.
  async extractDocument(args: {
    mime?: string;
    filename?: string;
    content?: string;
    base64?: boolean;
  }): Promise<{ text: string; filename?: string }> {
    if (!this.deps.documents) throw new ValidationError('document parsing is not configured');
    if (!args.content) throw new ValidationError('content is required');
    try {
      const text = await this.deps.documents.extractText({
        mime: args.mime || 'application/octet-stream',
        filename: args.filename,
        content: args.content,
        base64: args.base64 !== false,
      });
      return { text, filename: args.filename };
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : 'не удалось прочитать файл');
    }
  }

  // --- Live events (SSE/WS) ---

  subscribe(runId: string, listener: Parameters<EventBus['subscribe']>[1]): () => void {
    if (!this.deps.events) throw new Error('event bus not configured');
    return this.deps.events.subscribe(runId, listener);
  }
}
