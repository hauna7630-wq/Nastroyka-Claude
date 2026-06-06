import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getEnrollmentDetail } from '@/lib/services/enrollment';
import Sidebar from '@/app/_components/Sidebar';
import { completeLessonAction } from '@/app/lms-actions';

export default async function LessonPage({
  params,
}: {
  params: { courseId: string; lessonId: string };
}) {
  const session = getSession();
  if (!session) redirect('/login');
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: { page: { select: { id: true, contentText: true } } },
  });
  if (!lesson) notFound();
  const detail = await getEnrollmentDetail(params.courseId, session.userId);
  const done = detail?.completedLessonIds.has(lesson.id);

  return (
    <div className="layout">
      <Sidebar orgId={session.orgId} />
      <main className="main">
        <p className="muted">
          <Link href={`/app/courses/${params.courseId}`}>← к курсу</Link>
        </p>
        <h1>{lesson.title}</h1>

        {lesson.page ? (
          <>
            <div className="card" style={{ whiteSpace: 'pre-wrap' }}>
              {lesson.page.contentText || 'Материал пуст.'}
            </div>
            <p style={{ marginTop: 8 }}>
              <Link href={`/app/pages/${lesson.page.id}`}>Открыть страницу в базе знаний →</Link>
            </p>
          </>
        ) : (
          <p className="muted">К уроку не привязан материал.</p>
        )}

        {!detail ? (
          <p className="muted" style={{ marginTop: 16 }}>
            Запишитесь на курс, чтобы отмечать прогресс.
          </p>
        ) : done ? (
          <p style={{ marginTop: 16 }}>✓ Урок пройден</p>
        ) : (
          <form action={completeLessonAction} style={{ marginTop: 16 }}>
            <input type="hidden" name="enrollmentId" value={detail.enrollmentId} />
            <input type="hidden" name="lessonId" value={lesson.id} />
            <input type="hidden" name="courseId" value={params.courseId} />
            <button type="submit">Отметить пройденным</button>
          </form>
        )}
      </main>
    </div>
  );
}
