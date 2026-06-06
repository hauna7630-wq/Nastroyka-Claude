// Cost guard (PRD M4): tracks USD spend for a run and enforces a hard budget.
// When the budget is exceeded the run is stopped (auto-stop), realising the
// "не более $X на задачу" requirement.

import { usdCost } from './pricing';

export class BudgetExceededError extends Error {
  constructor(
    public readonly limitUsd: number,
    public readonly spentUsd: number,
  ) {
    super(`Budget exceeded: spent $${spentUsd.toFixed(4)} of $${limitUsd.toFixed(2)} limit`);
    this.name = 'BudgetExceededError';
  }
}

export class CostMeter {
  private spent = 0;

  /** Add a model turn's cost and return the new cumulative USD spend. */
  addTurn(model: string | undefined, tokensIn: number, tokensOut: number): number {
    this.spent += usdCost(model, tokensIn, tokensOut);
    return this.spent;
  }

  addUsd(usd: number): number {
    this.spent += usd;
    return this.spent;
  }

  usd(): number {
    return this.spent;
  }

  /** Throw if a (hard) limit is set and has been exceeded. */
  enforce(limitUsd?: number): void {
    if (limitUsd != null && this.spent > limitUsd) {
      throw new BudgetExceededError(limitUsd, this.spent);
    }
  }
}
