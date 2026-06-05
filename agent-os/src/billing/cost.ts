// Cost-prediction primitives (review §4.3).
//
// MVP: a simple, deterministic credit model. In production this would be backed
// by per-model token pricing and a pre-run estimator surfaced to the user.

// Credits charged per tool call (flat, MVP).
export const CREDITS_PER_TOOL_CALL = 1;

// Credits per 1k tokens (illustrative).
export const CREDITS_PER_1K_TOKENS = 1;

export function tokensToCredits(tokensIn: number, tokensOut: number): number {
  const total = tokensIn + tokensOut;
  return Math.ceil((total / 1000) * CREDITS_PER_1K_TOKENS);
}

/**
 * Pre-run estimate the Control Plane can show the user before they confirm.
 * @param estimatedToolCalls expected number of tool invocations
 * @param estimatedTokens    expected total tokens across the run
 */
export function estimateRunCost(args: {
  estimatedToolCalls: number;
  estimatedTokens: number;
}): number {
  return (
    args.estimatedToolCalls * CREDITS_PER_TOOL_CALL +
    tokensToCredits(args.estimatedTokens, 0)
  );
}
