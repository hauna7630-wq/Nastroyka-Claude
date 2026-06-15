// Control Plane (F4): the API surface that creates work, reports status, exposes
// observability and manages the DLQ. Framework-agnostic — these are plain async
// methods so they're trivially testable; the HTTP/SSE server (src/api/server.ts)
// is a thin adapter over them.

import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { Repository } from '../ports/repository';
import { Queue } from '../ports/queue';
import { Observability } from '../observability/metrics';
import { EventBus } from '../events/bus';
import { DocumentParser } from '../ports/documents';
import { humanizeRunError } from '../domain/errors';
import { assembleChatPrompt, outputToReplyText } from '../agent/chatPrompt';
import { deriveTeamPhase, isReviewId, isRevisionId, PHASE_LABEL, subtaskIdOf, TeamPhase } from '../orchestrator/phase';
import { verdictNeedsRework } from '../orchestrator/orchestrator';
import { findTemplate, TEAM_TEMPLATES } from '../teams/templates';
import {
  Agent,
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
  async submitTask(args: { orgId: string; task: string; autoRun?: boolean }) {
    const org = await this.deps.repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    if (!args.task?.trim()) throw new ValidationError('task is required');
    const orchestrator = await this.deps.repo.findAgentByType(args.orgId, 'orchestrator');
    if (!orchestrator) {
      throw new ValidationError(`org ${args.orgId} has no orchestrator agent`);
    }
    return this.createRun({
      orgId: args.orgId,
      agentId: orchestrator.id,
      input: { prompt: args.task, autoRun: args.autoRun },
    });
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

  // --- Team catalog: ready-made teams hired in one click ---

  listTeamTemplates() {
    return TEAM_TEMPLATES.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      recommended: t.recommended === true,
      members: t.members.map((m) => ({ name: m.name, type: m.type })),
    }));
  }

  // Idempotent by member name: re-hiring a team only creates the missing agents.
  async hireTeam(args: { orgId: string; templateId: string }) {
    const org = await this.deps.repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    const template = findTemplate(args.templateId);
    if (!template) throw new NotFoundError(`team template ${args.templateId}`);

    const existing = await this.deps.repo.listAgents(args.orgId);
    const names = new Set(existing.map((a) => a.name));
    const hired = [];
    for (const m of template.members) {
      if (names.has(m.name)) continue;
      const agent = await this.deps.repo.createAgent({
        orgId: args.orgId,
        name: m.name,
        type: m.type,
        systemPrompt: m.systemPrompt,
      });
      hired.push({ id: agent.id, name: agent.name, type: agent.type });
    }
    await this.deps.repo.audit({
      orgId: args.orgId,
      actor: 'control-plane',
      action: 'team.hired',
      meta: { templateId: template.id, hired: hired.length },
    });
    return { templateId: template.id, title: template.title, hired };
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
      const kind = isReviewId(sid) ? 'review' : isRevisionId(sid) ? 'revision' : 'contribution';
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

  // Org-level task list: top-level runs only (chat + team), newest first.
  async listOrgTasks(orgId: string) {
    const org = await this.deps.repo.getOrg(orgId);
    if (!org) throw new NotFoundError(`org ${orgId}`);
    const runs = await this.deps.repo.listRunsByOrg(orgId, { limit: 200 });
    return runs
      .filter((r) => !r.parentRunId)
      .slice(-30)
      .reverse()
      .map((run) => {
        const input = run.input as { prompt?: unknown; chat?: unknown } | null;
        const prompt =
          input && typeof input.prompt === 'string' ? input.prompt.slice(0, 140) : '';
        return {
          runId: run.id,
          status: run.status,
          chat: input?.chat === true,
          prompt,
          errorHuman: humanizeRunError(run.error, run.status),
        };
      });
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
    // Many files / whole folders: each extracted file is inlined into the prompt.
    attachments?: Array<{ filename: string; text: string }>;
    // Files also saved to the agent's workspace (uploads/…): for code-capable
    // agents to read with tools on demand (no prompt-size limit).
    workspaceFiles?: string[];
    // Reply-to: the user answers a specific earlier message; the quote goes
    // into the model prompt and is encoded into the stored display text
    // (leading "↪ …" line — no schema change, survives reload/devices).
    replyTo?: { role: 'user' | 'agent'; text: string };
    // Work mode: false = «Подтверждение» (agent proposes, no execution).
    autoRun?: boolean;
  }): Promise<{ runId: string; status: string; message: ChatMessageRecord; delegated?: boolean; reply?: string; to?: string }> {
    const { repo } = this.deps;
    const atts =
      args.attachments && args.attachments.length
        ? args.attachments
        : args.attachment
          ? [args.attachment]
          : [];
    if (!args.text?.trim() && !atts.length) {
      throw new ValidationError('текст сообщения пуст');
    }
    const org = await repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    const agent = await repo.getAgent(args.agentId);
    if (!agent || agent.orgId !== args.orgId) {
      throw new NotFoundError(`agent ${args.agentId}`);
    }

    const text = args.text?.trim() || 'Изучи приложенные файлы и дай краткие выводы.';

    // Delegation: "поручи <Имя>: <задача>" routes the task to that employee's
    // inbox (a dormant assignment run) instead of running the current agent. The
    // current agent just confirms — no LLM call needed.
    if (!atts.length) {
      const roster = await repo.listAgents(args.orgId);
      const deleg = this.parseDelegation(text, roster);
      if (deleg && deleg.agent.id !== args.agentId) {
        const userMsg = await repo.appendChatMessage({
          orgId: args.orgId,
          agentId: args.agentId,
          role: 'user',
          text,
          runId: randomUUID(),
        });
        await this.createAssignment({
          orgId: args.orgId,
          toAgentId: deleg.agent.id,
          from: this.shortNameOf(agent.name),
          task: deleg.task,
        });
        const to = this.shortNameOf(deleg.agent.name);
        const reply =
          'Передал(а) поручение: ' + to + ' — «' + deleg.task + '». Оно появилось у него в разделе ' +
          '«📥 Поручения» — открой его чат и нажми «Приступить».';
        await repo.appendChatMessage({
          orgId: args.orgId,
          agentId: args.agentId,
          role: 'agent',
          text: reply,
          runId: randomUUID(),
        });
        return { runId: '', status: 'delegated', message: userMsg, delegated: true, reply, to };
      }
    }

    // Context: the persisted thread (with any completed replies backfilled
    // first, so the prompt sees them).
    const history = await repo.listChatMessages(args.orgId, args.agentId, 12);
    await this.backfillChatReplies(args.orgId, args.agentId, history);
    const fresh = await repo.listChatMessages(args.orgId, args.agentId, 12);

    // The new user turn: inline the attachment for the model, keep the thread
    // display text short.
    let promptPart = text;
    if (atts.length) {
      const blocks = atts
        .map((a) => 'Файл "' + a.filename + '":\n"""\n' + a.text + '\n"""')
        .join('\n\n');
      promptPart = blocks + '\n\n' + text;
    }
    if (args.workspaceFiles && args.workspaceFiles.length) {
      const flist = args.workspaceFiles.slice(0, 80).join(', ');
      promptPart =
        promptPart +
        '\n\n[Файлы и папки, которые дал пользователь, сохранены в твоей рабочей папке в ' +
        './uploads/ (структура папок сохранена, всего ' + args.workspaceFiles.length + '). ' +
        'Открывай папки/подпапки и читай документы инструментами (LS, Read, Glob, Grep) ' +
        'по мере необходимости — работай с ними напрямую, не полагаясь только на текст ' +
        'выше. Файлы: ' + flist + (args.workspaceFiles.length > 80 ? ' …' : '') + ']';
    }
    let displayText = text;
    if (atts.length === 1) displayText = text + ' 📎 ' + atts[0].filename;
    else if (atts.length > 1) displayText = text + ' 📎 ' + atts.length + ' файлов';
    if (args.replyTo && typeof args.replyTo.text === 'string' && args.replyTo.text.trim()) {
      const quote = args.replyTo.text.trim();
      const whose = args.replyTo.role === 'agent' ? 'твоё сообщение' : 'своё более раннее сообщение';
      promptPart =
        'Пользователь отвечает на ' + whose + ':\n"""\n' + quote.slice(0, 400) +
        '\n"""\n\n' + promptPart;
      displayText = '↪ ' + quote.slice(0, 120).replace(/\s*\n\s*/g, ' ') + '\n' + displayText;
    }

    const runId = randomUUID();
    const message = await repo.appendChatMessage({
      orgId: args.orgId,
      agentId: args.agentId,
      role: 'user',
      text: this.sanitizeText(displayText),
      runId,
    });

    const prompt = this.sanitizeText(assembleChatPrompt(fresh, promptPart));
    const { status } = await this.createRun({
      orgId: args.orgId,
      agentId: args.agentId,
      runId,
      input: { prompt, chat: true, message: text, autoRun: args.autoRun },
    });
    return { runId, status, message };
  }

  // --- Delegation: a coordinator hands a task to a specific employee. Modeled as
  // a dormant Run (input.assignment) sitting in the employee's «Поручения» inbox
  // until «Приступить» enqueues it for real execution — reusing the run pipeline,
  // streaming and polling (no new table). ---
  private shortNameOf(name: string): string {
    return name.split(' — ')[0];
  }

  // Detect "поручи/делегируй/передай <Имя> [:,-] <задача>" or "@<Имя> <задача>".
  parseDelegation(text: string, agents: Agent[]): { agent: Agent; task: string } | null {
    const t = (text || '').trim();
    let namePart: string | undefined;
    let taskPart: string | undefined;
    let m = /^@(\S+)\s+([\s\S]+)/.exec(t);
    if (m) {
      namePart = m[1];
      taskPart = m[2];
    } else {
      m = /^(?:поручи(?:те)?|делегируй(?:те)?|передай(?:те)?)\s+([A-Za-zА-Яа-яЁё]+)\s*[:,\-—]?\s*([\s\S]+)/i.exec(t);
      if (m) {
        namePart = m[1];
        taskPart = m[2];
      }
    }
    if (!namePart || !taskPart) return null;
    const lc = namePart.toLowerCase();
    const agent = agents.find((a) => this.shortNameOf(a.name).toLowerCase() === lc);
    if (!agent) return null;
    const task = taskPart.replace(/^(?:сделать|сделай|выполни(?:ть)?)\s+/i, '').trim();
    if (!task) return null;
    return { agent, task };
  }

  async createAssignment(args: {
    orgId: string;
    toAgentId: string;
    from: string;
    task: string;
  }): Promise<{ runId: string; agentName: string }> {
    const { repo } = this.deps;
    const org = await repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    const agent = await repo.getAgent(args.toAgentId);
    if (!agent || agent.orgId !== args.orgId) throw new NotFoundError(`agent ${args.toAgentId}`);
    if (!args.task.trim()) throw new ValidationError('task is required');
    const runId = randomUUID();
    const prompt =
      'Тебе поручение от ' + args.from + ' (координатор команды). Выполни его полностью и дай ' +
      'готовый результат.\n\nЗадача:\n' + args.task;
    await repo.createRun({
      id: runId,
      orgId: args.orgId,
      agentId: args.toAgentId,
      status: 'queued', // dormant: NOT enqueued until «Приступить»
      input: { prompt, assignment: true, from: args.from, task: args.task, chat: true },
      attempts: 0,
    });
    await repo.audit({
      orgId: args.orgId,
      runId,
      actor: 'control-plane',
      action: 'assignment.created',
      meta: { from: args.from, to: agent.name },
    });
    return { runId, agentName: agent.name };
  }

  async listAssignments(
    orgId: string,
    agentId: string,
  ): Promise<Array<{ id: string; from: string; task: string; status: string; started: boolean; output?: unknown }>> {
    const runs = await this.deps.repo.listRunsByOrg(orgId, { agentId, limit: 50 });
    return runs
      .filter((r) => (r.input as { assignment?: boolean } | null)?.assignment === true)
      .map((r) => {
        const inp = (r.input as { from?: string; task?: string }) || {};
        return {
          id: r.id,
          from: inp.from ?? 'Координатор',
          task: inp.task ?? '',
          status: r.status,
          started: (r.input as { started?: boolean } | null)?.started === true,
          output: r.output,
        };
      })
      .reverse(); // newest first
  }

  async startAssignment(args: { orgId: string; runId: string }): Promise<{ runId: string; status: string }> {
    const run = await this.deps.repo.getRun(args.runId);
    if (!run || run.orgId !== args.orgId) throw new NotFoundError(`assignment ${args.runId}`);
    const inp = (run.input as Record<string, unknown> | null) || {};
    if (inp.assignment !== true) {
      throw new ValidationError('run is not an assignment');
    }
    // Mark started so the inbox stops offering «Приступить» (status alone is
    // ambiguous: a freshly-enqueued run is still 'queued' for a moment).
    await this.deps.repo.updateRunStatus(args.runId, run.status, {
      input: { ...inp, started: true },
    });
    await this.deps.repo.audit({
      orgId: args.orgId,
      runId: args.runId,
      actor: 'control-plane',
      action: 'assignment.started',
    });
    await this.deps.queue.enqueue({ runId: args.runId });
    return { runId: args.runId, status: 'queued' };
  }

  private agentWorkspace(orgId: string, agentId: string): string {
    const seg = (s: string): string => String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(process.env.AGENT_WORKSPACE_DIR || '/workspace', seg(orgId), seg(agentId));
  }

  // Resolve (and ensure) the agent's workspace dir — used to stream it as an
  // archive for download.
  async resolveWorkspaceDir(orgId: string, agentId: string): Promise<string> {
    const org = await this.deps.repo.getOrg(orgId);
    if (!org) throw new NotFoundError(`org ${orgId}`);
    const agent = await this.deps.repo.getAgent(agentId);
    if (!agent || agent.orgId !== orgId) throw new NotFoundError(`agent ${agentId}`);
    const dir = this.agentWorkspace(orgId, agentId);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  // Save uploaded files into the agent's persistent workspace (under uploads/), so
  // a code-capable agent can read them with tools on demand — no prompt-size limit.
  // Paths are sanitized against traversal; content is base64.
  async uploadWorkspaceFiles(args: {
    orgId: string;
    agentId: string;
    files: Array<{ path: string; content: string }>;
  }): Promise<{ dir: string; saved: string[] }> {
    const org = await this.deps.repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    const agent = await this.deps.repo.getAgent(args.agentId);
    if (!agent || agent.orgId !== args.orgId) throw new NotFoundError(`agent ${args.agentId}`);
    const base = join(this.agentWorkspace(args.orgId, args.agentId), 'uploads');
    mkdirSync(base, { recursive: true });
    const saved: string[] = [];
    let totalBytes = 0;
    for (const f of (args.files || []).slice(0, 500)) {
      const rel =
        String(f.path || 'file')
          .split(/[\\/]+/)
          .filter((s) => s && s !== '.' && s !== '..')
          .join('/') || 'file';
      const dest = join(base, rel);
      if (dest !== base && !dest.startsWith(base + '/')) continue; // traversal guard
      const buf = Buffer.from(f.content || '', 'base64');
      if (buf.length > 25 * 1024 * 1024) continue;
      totalBytes += buf.length;
      if (totalBytes > 120 * 1024 * 1024) break;
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, buf);
      saved.push('uploads/' + rel);
    }
    return { dir: 'uploads', saved };
  }

  async clearChatHistory(args: { orgId: string; agentId: string }): Promise<{ cleared: number }> {
    const { repo } = this.deps;
    const agent = await repo.getAgent(args.agentId);
    if (!agent || agent.orgId !== args.orgId) {
      throw new NotFoundError(`agent ${args.agentId}`);
    }
    const cleared = await repo.clearChatMessages(args.orgId, args.agentId);
    return { cleared };
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

  // Toggle an emoji reaction on a chat message (set «Поставить реакцию»).
  async reactToMessage(args: {
    orgId: string;
    agentId: string;
    messageId: string;
    emoji: string;
  }): Promise<ChatMessageRecord> {
    if (!args.emoji || args.emoji.length > 8) throw new ValidationError('недопустимая реакция');
    const updated = await this.deps.repo.toggleChatReaction(
      args.orgId,
      args.agentId,
      args.messageId,
      args.emoji,
    );
    if (!updated) throw new NotFoundError(`message ${args.messageId}`);
    return updated;
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
  // Postgres text/jsonb rejects the NUL byte ( → error 22P05). Extracted
  // file text (binary/PDF) can contain it, so strip it before it reaches the DB.
  private sanitizeText(s: string): string {
    return typeof s === 'string' ? s.replace(/\u0000/g, '') : s;
  }

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
      return { text: this.sanitizeText(text), filename: args.filename };
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
