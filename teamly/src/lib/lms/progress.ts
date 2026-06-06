// Course progress computation. Pure + testable.
//
// A course is a set of "units": every lesson and every module quiz. The course
// is complete when all lessons are done and all quizzes are passed.

export interface CourseStructure {
  modules: { lessonIds: string[]; quizId: string | null }[];
}

export interface ProgressInput {
  completedLessonIds: Iterable<string>;
  passedQuizIds: Iterable<string>;
}

export interface CourseProgress {
  totalUnits: number;
  doneUnits: number;
  percent: number;
  completed: boolean;
}

export function courseProgress(
  structure: CourseStructure,
  input: ProgressInput,
): CourseProgress {
  const doneLessons = new Set(input.completedLessonIds);
  const passedQuizzes = new Set(input.passedQuizIds);

  let total = 0;
  let done = 0;
  for (const m of structure.modules) {
    for (const lessonId of m.lessonIds) {
      total += 1;
      if (doneLessons.has(lessonId)) done += 1;
    }
    if (m.quizId) {
      total += 1;
      if (passedQuizzes.has(m.quizId)) done += 1;
    }
  }
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { totalUnits: total, doneUnits: done, percent, completed: total > 0 && done === total };
}
