// T3 integration: the full LMS flow on live Postgres. Gated on DATABASE_URL.

import { prisma } from '@/lib/db';
import { bootstrapOrg } from '@/lib/services/org';
import { createPage, savePageContent } from '@/lib/services/pages';
import {
  generateCourseFromSpace,
  getCourseTree,
  createQuizForModule,
  addQuestion,
} from '@/lib/services/courses';
import { enroll, completeLesson, submitQuiz, getProgress, getEnrollment } from '@/lib/services/enrollment';

const describeIf = process.env.DATABASE_URL ? describe : describe.skip;

function doc(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

describeIf('T3 LMS (live Postgres)', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapOrg>>;
  let courseId: string;
  let quizId: string;
  let lessonIds: string[];
  let correctByQuestion: Record<string, string[]>;
  let wrongByQuestion: Record<string, string[]>;

  beforeAll(async () => {
    ctx = await bootstrapOrg({
      orgName: 'LmsCo ' + Date.now(),
      userEmail: `lms_${Date.now()}@example.com`,
      userName: 'Учащийся',
      password: 'secret123',
    });
    const p1 = await createPage({ spaceId: ctx.space.id, title: 'Урок 1' });
    await savePageContent({ pageId: p1.id, title: 'Урок 1', contentJson: doc('Материал первого урока.'), authorId: ctx.user.id });
    const p2 = await createPage({ spaceId: ctx.space.id, title: 'Урок 2' });
    await savePageContent({ pageId: p2.id, title: 'Урок 2', contentJson: doc('Материал второго урока.'), authorId: ctx.user.id });

    const course = await generateCourseFromSpace(ctx.workspace.id, ctx.space.id, 'Вводный курс');
    courseId = course.id;

    const tree = await getCourseTree(courseId);
    const moduleId = tree!.modules[0].id;
    lessonIds = tree!.modules[0].lessons.map((l) => l.id);

    const quiz = await createQuizForModule(moduleId, 'Итоговый тест', 70);
    quizId = quiz.id;
    const q1 = await addQuestion(quiz.id, '2 + 2 = ?', [
      { text: '3', isCorrect: false },
      { text: '4', isCorrect: true },
    ]);
    const q2 = await addQuestion(quiz.id, 'Столица России?', [
      { text: 'Москва', isCorrect: true },
      { text: 'Париж', isCorrect: false },
    ]);
    correctByQuestion = {
      [q1.id]: [q1.options.find((o) => o.isCorrect)!.id],
      [q2.id]: [q2.options.find((o) => o.isCorrect)!.id],
    };
    wrongByQuestion = {
      [q1.id]: [q1.options.find((o) => !o.isCorrect)!.id],
      [q2.id]: [q2.options.find((o) => !o.isCorrect)!.id],
    };
  });

  afterAll(async () => {
    await prisma.org.delete({ where: { id: ctx.org.id } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('generates a course from the knowledge base (one lesson per page)', async () => {
    const tree = await getCourseTree(courseId);
    expect(tree!.modules).toHaveLength(1);
    expect(tree!.modules[0].lessons.map((l) => l.title)).toEqual(['Урок 1', 'Урок 2']);
    expect(tree!.modules[0].lessons[0].pageId).toBeTruthy(); // linked to a KB page
  });

  it('tracks progress to completion (lessons + passing the quiz)', async () => {
    const e = await enroll(courseId, ctx.user.id);
    expect((await getProgress(e.id)).percent).toBe(0); // 2 lessons + 1 quiz = 3 units

    await completeLesson(e.id, lessonIds[0]);
    await completeLesson(e.id, lessonIds[1]);
    let p = await getProgress(e.id);
    expect(p.doneUnits).toBe(2);
    expect(p.completed).toBe(false); // quiz not passed yet

    const result = await submitQuiz(e.id, quizId, correctByQuestion);
    expect(result).toMatchObject({ score: 100, passed: true });

    p = await getProgress(e.id);
    expect(p).toMatchObject({ percent: 100, completed: true });
    const fresh = await getEnrollment(courseId, ctx.user.id);
    expect(fresh!.completedAt).not.toBeNull();
  });

  it('does not complete the course when the quiz is failed', async () => {
    const other = await prisma.user.create({
      data: { orgId: ctx.org.id, email: `fail_${Date.now()}@e.com`, name: 'Двоечник', passwordHash: 'x' },
    });
    const e = await enroll(courseId, other.id);
    await completeLesson(e.id, lessonIds[0]);
    await completeLesson(e.id, lessonIds[1]);
    const result = await submitQuiz(e.id, quizId, wrongByQuestion);
    expect(result.passed).toBe(false);
    expect((await getProgress(e.id)).completed).toBe(false);
    expect((await getEnrollment(courseId, other.id))!.completedAt).toBeNull();
  });
});
