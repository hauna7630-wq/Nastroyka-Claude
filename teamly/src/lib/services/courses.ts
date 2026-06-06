import { prisma } from '../db';
import { uniqueSlug } from '../slug';

export async function listCourses(workspaceId: string) {
  return prisma.course.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { modules: true, enrollments: true } } },
  });
}

// Full course tree for rendering + progress.
export async function getCourseTree(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { position: 'asc' },
        include: {
          lessons: {
            orderBy: { position: 'asc' },
            include: { page: { select: { title: true } } },
          },
          quiz: { include: { questions: { include: { options: true }, orderBy: { position: 'asc' } } } },
        },
      },
    },
  });
}

export async function createCourse(input: {
  workspaceId: string;
  title: string;
  description?: string;
  spaceId?: string;
}) {
  const existing = await prisma.course.findMany({
    where: { workspaceId: input.workspaceId },
    select: { slug: true },
  });
  const slug = uniqueSlug(input.title, existing.map((c) => c.slug));
  return prisma.course.create({
    data: {
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.description ?? '',
      spaceId: input.spaceId,
      slug,
    },
  });
}

export async function addModule(courseId: string, title: string) {
  const count = await prisma.module.count({ where: { courseId } });
  return prisma.module.create({ data: { courseId, title, position: count } });
}

export async function addLesson(moduleId: string, title: string, pageId?: string) {
  const count = await prisma.lesson.count({ where: { moduleId } });
  return prisma.lesson.create({ data: { moduleId, title, pageId: pageId ?? null, position: count } });
}

export async function createQuizForModule(moduleId: string, title: string, passingScore = 70) {
  return prisma.quiz.create({ data: { moduleId, title, passingScore } });
}

export async function addQuestion(
  quizId: string,
  prompt: string,
  options: { text: string; isCorrect: boolean }[],
) {
  const count = await prisma.question.count({ where: { quizId } });
  return prisma.question.create({
    data: {
      quizId,
      prompt,
      position: count,
      options: { create: options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, position: i })) },
    },
    include: { options: true },
  });
}

export async function publishCourse(courseId: string, published = true) {
  return prisma.course.update({ where: { id: courseId }, data: { published } });
}

/**
 * Generate a course from a knowledge-base space: one module with a lesson per
 * (non-archived) page, each lesson linked to its page. This is the "course from
 * the knowledge base" generation; AI-authored modules/quizzes plug in on top via
 * the ChatModel port (T2) as a follow-up.
 */
export async function generateCourseFromSpace(
  workspaceId: string,
  spaceId: string,
  title: string,
) {
  const pages = await prisma.page.findMany({
    where: { spaceId, archived: false },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, title: true },
  });
  const course = await createCourse({
    workspaceId,
    title,
    spaceId,
    description: 'Курс, сгенерированный из базы знаний.',
  });
  const mod = await addModule(course.id, 'Материалы');
  for (const p of pages) {
    await addLesson(mod.id, p.title, p.id);
  }
  return course;
}
