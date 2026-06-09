// Complexity gating (review §4.2): the system decides whether a task warrants a
// multi-agent workflow. Cheap, deterministic heuristic for the MVP — production
// would use a learned/model-based estimator.

export const DEFAULT_COMPLEXITY_THRESHOLD = 5;

/**
 * A rough complexity score for a task description. Higher = more decomposable.
 * Signals: length, coordinating conjunctions ("and/then/also"), sentence count,
 * and explicit list/bullet structure.
 */
export function estimateComplexity(task: string): number {
  const text = task.trim();
  if (!text) return 0;

  const words = text.split(/\s+/).filter(Boolean).length;
  const conjunctions = (text.match(/\b(and|then|after|also|plus|next|finally)\b/gi) ?? [])
    .length;
  const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim()).length;
  const bullets = (text.match(/(^|\n)\s*([-*•]|\d+[.)])\s+/g) ?? []).length;

  return Math.round(words / 20) + conjunctions * 2 + sentences + bullets * 2;
}

export function shouldOrchestrate(
  task: string,
  threshold: number = DEFAULT_COMPLEXITY_THRESHOLD,
): boolean {
  return estimateComplexity(task) >= threshold;
}
