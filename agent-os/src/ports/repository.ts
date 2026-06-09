// Repository port — the Data plane boundary.
//
// The runtime depends only on this interface. Production uses the Prisma
// adapter; tests use the in-memory adapter. Either way the runtime is unchanged.

import {
  Agent,
  AgentType,
  DeadLetterRecord,
  MemoryKind,
  MemoryRecord,
  Org,
  Run,
  RunStatus,
  Step,
} from '../domain/types';

export interface Repository {
  // --- Tenancy / agents ---
  getOrg(orgId: string): Promise<Org | null>;
  getAgent(agentId: string): Promise<Agent | null>;
  // Find an agent of a given type within an org (used by the orchestrator to
  // assign subtasks to typed agents). Returns the first match, or null.
  findAgentByType(orgId: string, type: AgentType): Promise<Agent | null>;
  // Agent Factory (PRD M2): create a "digital employee" with a role + prompt +
  // tool allowlist (an initial PromptVersion is created), and list an org's agents.
  createAgent(input: {
    orgId: string;
    name: string;
    type: AgentType;
    systemPrompt: string;
    allowedTools?: string[];
  }): Promise<Agent>;
  listAgents(orgId: string): Promise<Agent[]>;

  // --- Runs ---
  getRun(runId: string): Promise<Run | null>;
  // Idempotent by run id: if a run with this id already exists it is returned
  // unchanged (so orchestration retries don't reset completed child runs).
  createRun(run: Run): Promise<Run>;
  listChildRuns(parentRunId: string): Promise<Run[]>;
  // Control-plane reads (observability).
  listRunsByOrg(orgId: string): Promise<Run[]>;
  updateRunStatus(runId: string, status: RunStatus, patch?: Partial<Run>): Promise<void>;
  incrementRunAttempts(runId: string): Promise<number>;

  // --- Steps (trace) ---
  appendStep(step: Step): Promise<void>;
  listSteps(runId: string): Promise<Step[]>;

  // --- Agent memory (F5) ---
  appendMemory(memory: MemoryRecord): Promise<void>;
  listMemories(agentId: string, kinds?: MemoryKind[]): Promise<MemoryRecord[]>;

  // --- Reliability ---
  recordDeadLetter(record: DeadLetterRecord): Promise<void>;
  listDeadLetters(): Promise<DeadLetterRecord[]>;
  markDeadLetterRequeued(runId: string): Promise<void>;

  // --- Audit ---
  audit(entry: {
    orgId: string;
    runId?: string;
    actor: string;
    action: string;
    meta?: unknown;
  }): Promise<void>;
}
