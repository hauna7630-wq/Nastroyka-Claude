// Billing plane — idempotent credit deduction.
//
// The core financial-safety property (review §2.4): a tool call identified by
// (runId, stepIndex, toolCallId) is charged exactly once, even if the run is
// retried mid-flight or a job is delivered twice. Idempotency is enforced by
// the repository's unique constraint; this module is the policy layer.

import { LedgerEntry } from '../domain/types';
import { Repository } from '../ports/repository';

export class Ledger {
  constructor(private readonly repo: Repository) {}

  /**
   * Charge `amount` credits for a specific tool call. Idempotent: repeated calls
   * with the same (runId, stepIndex, toolCallId) are no-ops.
   *
   * @returns true if a new charge was applied, false if it was a duplicate.
   */
  async charge(args: {
    orgId: string;
    runId: string;
    stepIndex: number;
    toolCallId: string;
    amount: number; // positive number of credits to debit
    reason?: string;
  }): Promise<boolean> {
    if (args.amount < 0) {
      throw new Error('charge amount must be non-negative; use credit() to add');
    }
    const entry: LedgerEntry = {
      orgId: args.orgId,
      runId: args.runId,
      stepIndex: args.stepIndex,
      toolCallId: args.toolCallId,
      amount: -args.amount, // debit
      reason: args.reason,
    };
    return this.repo.recordLedgerEntryIfAbsent(entry);
  }

  /**
   * Apply a credit top-up (e.g. a Stripe checkout). Idempotent on the external
   * id, so a redelivered webhook never double-credits.
   *
   * @returns true if newly applied, false if a duplicate.
   */
  async grant(args: {
    orgId: string;
    source: string;
    externalId: string;
    amount: number;
  }): Promise<boolean> {
    if (args.amount <= 0) {
      throw new Error('grant amount must be positive');
    }
    return this.repo.recordCreditGrantIfAbsent(args);
  }

  async totalForRun(runId: string): Promise<number> {
    // Returns credits consumed (positive number).
    const used = await this.repo.getRunCreditsUsed(runId);
    return Math.abs(used);
  }
}
