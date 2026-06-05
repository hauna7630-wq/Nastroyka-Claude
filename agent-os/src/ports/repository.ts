// Repository port — the Billing/Data plane boundary.
//
// The runtime depends only on this interface. Production uses the Prisma
// adapter; tests use the in-memory adapter. Either way the runtime is unchanged.

import {
  Agent,
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

  // --- Runs ---
  getRun(runId: string): Promise<Run | null>;
  createRun(run: Run): Promise<Run>;
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

  // --- Reliability ---
  recordDeadLetter(record: DeadLetterRecord): Promise<void>;
  listDeadLetters(): Promise<DeadLetterRecord[]>;

  // --- Audit ---
  audit(entry: {
    orgId: string;
    runId?: string;
    actor: string;
    action: string;
    meta?: unknown;
  }): Promise<void>;
}
