import { prisma } from '../db';
import { gradeQuiz, GradableQuestion, QuizResult, QuizSubmission } from '../lms/grade';
import { courseProgress, CourseProgress, CourseStructure } from '../lms/progress';

export async function enroll(courseId: string, userId: string) {
  return prisma.enrollment.upsert({
    where: { courseId_userId: { courseId, userId } },
    update: {},
    create: { courseId, userId },
  });
}

export async function getEnrollment(courseId: string, userId: string) {
  return prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId } } });
}

export async function completeLesson(enrollmentId: string, lessonId: string) {
  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    update: {},
    create: { enrollmentId, lessonId },
  });
  await recomputeCompletion(enrollmentId);
}

export async function submitQuiz(
  enrollmentId: string,
  quizId: string,
  submission: QuizSubmission,
): Promise<QuizResult> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { include: { options: true } } },
  });
  if (!quiz) throw new Error(`quiz not found: ${quizId}`);

  const gradable: GradableQuestion[] = quiz.questions.map((q) => ({
    id: q.id,
    correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
  }));
  const result = gradeQuiz(gradable, submission, quiz.passingScore);

  await prisma.quizAttempt.create({
    data: { enrollmentId, quizId, score: result.score, passed: result.passed },
  });
  await recomputeCompletion(enrollmentId);
  return result;
}

export async function getProgress(enrollmentId: string): Promise<CourseProgress> {
  const { structure, completedLessonIds, passedQuizIds } = await loadProgressInputs(enrollmentId);
  return courseProgress(structure, { completedLessonIds, passedQuizIds });
}

export interface EnrollmentDetail {
  enrollmentId: string;
  completedLessonIds: Set<string>;
  passedQuizIds: Set<string>;
  progress: CourseProgress;
  completedAt: Date | null;
}

// Current user's state for a course (null if not enrolled). For UI rendering.
export async function getEnrollmentDetail(
  courseId: string,
  userId: string,
): Promise<EnrollmentDetail | null> {
  const e = await getEnrollment(courseId, userId);
  if (!e) return null;
  const { structure, completedLessonIds, passedQuizIds } = await loadProgressInputs(e.id);
  return {
    enrollmentId: e.id,
    completedLessonIds: new Set(completedLessonIds),
    passedQuizIds: new Set(passedQuizIds),
    progress: courseProgress(structure, { completedLessonIds, passedQuizIds }),
    completedAt: e.completedAt,
  };
}

// --- internals ---

async function loadProgressInputs(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      course: {
        include: {
          modules: { include: { lessons: { select: { id: true } }, quiz: { select: { id: true } } } },
        },
      },
      lessonProgress: { select: { lessonId: true } },
      attempts: { where: { passed: true }, select: { quizId: true } },
    },
  });
  if (!enrollment) throw new Error(`enrollment not found: ${enrollmentId}`);

  const structure: CourseStructure = {
    modules: enrollment.course.modules.map((m) => ({
      lessonIds: m.lessons.map((l) => l.id),
      quizId: m.quiz?.id ?? null,
    })),
  };
  return {
    enrollment,
    structure,
    completedLessonIds: enrollment.lessonProgress.map((p) => p.lessonId),
    passedQuizIds: enrollment.attempts.map((a) => a.quizId),
  };
}

async function recomputeCompletion(enrollmentId: string): Promise<void> {
  const { enrollment, structure, completedLessonIds, passedQuizIds } =
    await loadProgressInputs(enrollmentId);
  const progress = courseProgress(structure, { completedLessonIds, passedQuizIds });
  if (progress.completed && !enrollment.completedAt) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { completedAt: new Date() },
    });
  } else if (!progress.completed && enrollment.completedAt) {
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { completedAt: null } });
  }
}
