// In-memory Repository adapter for dev/tests. Zero external infra.

import {
  Agent,
  AgentType,
  ChatMessageRecord,
  DeadLetterRecord,
  MemoryKind,
  MemoryRecord,
  Org,
  Run,
  RunStatus,
  Step,
} from '../domain/types';
import { Repository } from '../ports/repository';
import { randomUUID } from 'crypto';

interface AuditRecord {
  orgId: string;
  runId?: string;
  actor: string;
  action: string;
  meta?: unknown;
  at: number;
}

export class InMemoryRepository implements Repository {
  private orgs = new Map<string, Org>();
  private agents = new Map<string, Agent>();
  private runs = new Map<string, Run>();
  private steps = new Map<string, Step>(); // key: `${runId}:${index}`
  private deadLetters: DeadLetterRecord[] = [];
  private memories: MemoryRecord[] = [];
  private chatMessages: ChatMessageRecord[] = [];
  public readonly auditLog: AuditRecord[] = [];

  // --- Test seeding helpers (not part of the port) ---
  seedOrg(org: Org): void {
    this.orgs.set(org.id, org);
  }
  seedAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  // --- Tenancy / agents ---
  async getOrg(orgId: string): Promise<Org | null> {
    return this.orgs.get(orgId) ?? null;
  }
  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agents.get(agentId) ?? null;
  }
  async findAgentByType(orgId: string, type: AgentType): Promise<Agent | null> {
    for (const a of this.agents.values()) {
      if (a.orgId === orgId && a.type === type) return a;
    }
    return null;
  }
  async createAgent(input: {
    orgId: string;
    name: string;
    type: AgentType;
    systemPrompt: string;
    allowedTools?: string[];
  }): Promise<Agent> {
    const agent: Agent = {
      id: `agent_${randomUUID()}`,
      orgId: input.orgId,
      name: input.name,
      type: input.type,
      systemPrompt: input.systemPrompt,
      allowedTools: input.allowedTools ?? [],
    };
    this.agents.set(agent.id, agent);
    return { ...agent };
  }
  async listAgents(orgId: string): Promise<Agent[]> {
    return [...this.agents.values()].filter((a) => a.orgId === orgId).map((a) => ({ ...a }));
  }

  // --- Chat thread (dialog memory) ---
  async appendChatMessage(msg: ChatMessageRecord): Promise<ChatMessageRecord> {
    const stored: ChatMessageRecord = {
      ...msg,
      id: msg.id ?? `msg_${randomUUID()}`,
      createdAt: msg.createdAt ?? Date.now(),
    };
    this.chatMessages.push(stored);
    return { ...stored };
  }
  async appendChatReplyIfAbsent(
    msg: ChatMessageRecord & { runId: string },
  ): Promise<boolean> {
    const exists = this.chatMessages.some(
      (m) => m.runId === msg.runId && m.role === msg.role,
    );
    if (exists) return false;
    await this.appendChatMessage(msg);
    return true;
  }
  async listChatMessages(
    orgId: string,
    agentId: string,
    limit = 100,
  ): Promise<ChatMessageRecord[]> {
    const all = this.chatMessages
      .filter((m) => m.orgId === orgId && m.agentId === agentId)
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    return all.slice(-limit).map((m) => ({ ...m, reactions: m.reactions ? [...m.reactions] : undefined }));
  }
  async clearChatMessages(orgId: string, agentId: string): Promise<number> {
    const before = this.chatMessages.length;
    this.chatMessages = this.chatMessages.filter((m) => !(m.orgId === orgId && m.agentId === agentId));
    return before - this.chatMessages.length;
  }
  async toggleChatReaction(
    orgId: string,
    agentId: string,
    messageId: string,
    emoji: string,
  ): Promise<ChatMessageRecord | null> {
    const m = this.chatMessages.find(
      (x) => x.id === messageId && x.orgId === orgId && x.agentId === agentId,
    );
    if (!m) return null;
    const set = new Set(m.reactions ?? []);
    if (set.has(emoji)) set.delete(emoji);
    else set.add(emoji);
    m.reactions = [...set];
    return { ...m, reactions: [...m.reactions] };
  }

  // --- Runs ---
  async getRun(runId: string): Promise<Run | null> {
    const r = this.runs.get(runId);
    return r ? { ...r } : null;
  }
  async createRun(run: Run): Promise<Run> {
    // Idempotent: never clobber an existing run (orchestration retries reuse
    // deterministic child run ids).
    const existing = this.runs.get(run.id);
    if (existing) return { ...existing };
    this.runs.set(run.id, { ...run });
    return run;
  }
  async listChildRuns(parentRunId: string): Promise<Run[]> {
    return [...this.runs.values()]
      .filter((r) => r.parentRunId === parentRunId)
      .map((r) => ({ ...r }));
  }
  async listRunsByOrg(
    orgId: string,
    opts: { agentId?: string; limit?: number } = {},
  ): Promise<Run[]> {
    const all = [...this.runs.values()].filter(
      (r) => r.orgId === orgId && (!opts.agentId || r.agentId === opts.agentId),
    );
    const capped = opts.limit ? all.slice(-opts.limit) : all;
    return capped.map((r) => ({ ...r }));
  }
  async updateRunStatus(
    runId: string,
    status: RunStatus,
    patch: Partial<Run> = {},
  ): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`updateRunStatus: run not found ${runId}`);
    this.runs.set(runId, { ...run, ...patch, status });
  }
  async incrementRunAttempts(runId: string): Promise<number> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`incrementRunAttempts: run not found ${runId}`);
    run.attempts += 1;
    return run.attempts;
  }

  // --- Steps ---
  async appendStep(step: Step): Promise<void> {
    // Upsert by (runId,index) so deterministic retries overwrite rather than
    // violate the (runId,index) uniqueness.
    this.steps.set(`${step.runId}:${step.index}`, { ...step });
  }
  async listSteps(runId: string): Promise<Step[]> {
    return [...this.steps.values()]
      .filter((s) => s.runId === runId)
      .sort((a, b) => a.index - b.index);
  }

  // --- Agent memory ---
  async appendMemory(memory: MemoryRecord): Promise<void> {
    this.memories.push({ ...memory, createdAt: memory.createdAt ?? Date.now() });
  }
  async listMemories(agentId: string, kinds?: MemoryKind[]): Promise<MemoryRecord[]> {
    return this.memories
      .filter((m) => m.agentId === agentId && (!kinds || kinds.includes(m.kind)))
      .map((m) => ({ ...m }));
  }

  // --- Reliability ---
  async recordDeadLetter(record: DeadLetterRecord): Promise<void> {
    this.deadLetters.push({ ...record });
  }
  async listDeadLetters(): Promise<DeadLetterRecord[]> {
    return [...this.deadLetters];
  }
  async markDeadLetterRequeued(runId: string): Promise<void> {
    this.deadLetters = this.deadLetters.filter((d) => d.runId !== runId);
  }

  // --- Audit ---
  async audit(entry: {
    orgId: string;
    runId?: string;
    actor: string;
    action: string;
    meta?: unknown;
  }): Promise<void> {
    this.auditLog.push({ ...entry, at: Date.now() });
  }
}
