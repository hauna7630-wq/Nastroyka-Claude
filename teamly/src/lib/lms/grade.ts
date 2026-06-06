// Quiz grading. Pure + testable.

export interface GradableQuestion {
  id: string;
  correctOptionIds: string[];
}

// questionId -> selected option ids
export type QuizSubmission = Record<string, string[]>;

export interface QuizResult {
  total: number;
  correct: number;
  score: number; // percent 0..100
  passed: boolean;
  perQuestion: Record<string, boolean>;
}

export function gradeQuiz(
  questions: GradableQuestion[],
  submission: QuizSubmission,
  passingScore: number,
): QuizResult {
  const perQuestion: Record<string, boolean> = {};
  let correct = 0;
  for (const q of questions) {
    const selected = new Set(submission[q.id] ?? []);
    const expected = new Set(q.correctOptionIds);
    const ok =
      selected.size === expected.size && [...expected].every((id) => selected.has(id));
    perQuestion[q.id] = ok;
    if (ok) correct += 1;
  }
  const total = questions.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { total, correct, score, passed: total > 0 && score >= passingScore, perQuestion };
}
