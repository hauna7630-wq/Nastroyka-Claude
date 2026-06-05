// Repository port — the Billing/Data plane boundary.
//
// The runtime depends only on this interface. Production uses the Prisma
// adapter; tests use the in-memory adapter. Either way the runtime is unchanged.

import {
  Agent,
  AgentType,
  CreditGrant,
  DeadLetterRecord,
  LedgerEntry,
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

  // --- Billing (idempotent ledger) ---
  /**
   * Insert a ledger entry only if (runId, stepIndex, toolCallId) has not been
   * recorded before. Returns true if a NEW entry was written, false if it was
   * a duplicate (no-op). Implementations MUST make this atomic.
   */
  recordLedgerEntryIfAbsent(entry: LedgerEntry): Promise<boolean>;
  getRunCreditsUsed(runId: string): Promise<number>;
  /**
   * Idempotently record a credit top-up (keyed on source+externalId) and add it
   * to the org balance. Returns true if newly applied, false if a duplicate.
   */
  recordCreditGrantIfAbsent(grant: CreditGrant): Promise<boolean>;

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
