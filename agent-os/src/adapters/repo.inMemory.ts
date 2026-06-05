// In-memory Repository adapter for dev/tests. Zero external infra.
// Mirrors the atomicity contract of the production (Prisma) adapter:
// recordLedgerEntryIfAbsent is the idempotency chokepoint.

import {
  Agent,
  DeadLetterRecord,
  LedgerEntry,
  Org,
  Run,
  RunStatus,
  Step,
} from '../domain/types';
import { Repository } from '../ports/repository';

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
  private ledgerKeys = new Set<string>(); // key: `${runId}:${stepIndex}:${toolCallId}`
  private ledger: LedgerEntry[] = [];
  private deadLetters: DeadLetterRecord[] = [];
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

  // --- Runs ---
  async getRun(runId: string): Promise<Run | null> {
    const r = this.runs.get(runId);
    return r ? { ...r } : null;
  }
  async createRun(run: Run): Promise<Run> {
    this.runs.set(run.id, { ...run });
    return run;
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

  // --- Billing (idempotent ledger) ---
  async recordLedgerEntryIfAbsent(entry: LedgerEntry): Promise<boolean> {
    const key = `${entry.runId}:${entry.stepIndex}:${entry.toolCallId}`;
    if (this.ledgerKeys.has(key)) return false; // duplicate => no-op
    this.ledgerKeys.add(key);
    this.ledger.push({ ...entry });

    // Keep denormalised balances in sync (amount is negative for debits).
    const org = this.orgs.get(entry.orgId);
    if (org) org.creditBalance += entry.amount;
    const run = this.runs.get(entry.runId);
    if (run) run.creditsUsed += Math.abs(entry.amount);
    return true;
  }
  async getRunCreditsUsed(runId: string): Promise<number> {
    return this.ledger
      .filter((e) => e.runId === runId)
      .reduce((sum, e) => sum + e.amount, 0); // signed (negative for debits)
  }

  // --- Reliability ---
  async recordDeadLetter(record: DeadLetterRecord): Promise<void> {
    this.deadLetters.push({ ...record });
  }
  async listDeadLetters(): Promise<DeadLetterRecord[]> {
    return [...this.deadLetters];
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
