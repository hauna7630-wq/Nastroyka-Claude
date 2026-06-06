// USD pricing per model (PRD M4 — Token & Cost Guard). Prices are per 1M tokens.
// Adjust to your provider contract (Bedrock / Vertex / direct).

export interface ModelPrice {
  inputPer1M: number;
  outputPer1M: number;
}

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-opus-4-8': { inputPer1M: 15, outputPer1M: 75 },
  'claude-sonnet-4-6': { inputPer1M: 3, outputPer1M: 15 },
  'claude-haiku-4-5-20251001': { inputPer1M: 0.8, outputPer1M: 4 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'llama-3.1-70b-instruct': { inputPer1M: 0, outputPer1M: 0 }, // self-hosted
};

export function usdCost(
  model: string | undefined,
  tokensIn: number,
  tokensOut: number,
): number {
  const price = MODEL_PRICES[model ?? DEFAULT_MODEL] ?? MODEL_PRICES[DEFAULT_MODEL];
  return (tokensIn / 1_000_000) * price.inputPer1M + (tokensOut / 1_000_000) * price.outputPer1M;
}
