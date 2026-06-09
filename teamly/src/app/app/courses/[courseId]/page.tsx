import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getCourseTree } from '@/lib/services/courses';
import { getEnrollmentDetail } from '@/lib/services/enrollment';
import Sidebar from '@/app/_components/Sidebar';
import { enrollAction } from '@/app/lms-actions';

export default async function CoursePage({ params }: { params: { courseId: string } }) {
  const session = getSession();
  if (!session) redirect('/login');
  const course = await getCourseTree(params.courseId);
  if (!course) notFound();
  const detail = await getEnrollmentDetail(course.id, session.userId);

  return (
    <div className="layout">
      <Sidebar orgId={session.orgId} />
      <main className="main">
        <p className="muted">
          <Link href="/app/courses">← все курсы</Link>
        </p>
        <h1>{course.title}</h1>
        <p className="muted">{course.description}</p>

        {!detail ? (
          <form action={enrollAction}>
            <input type="hidden" name="courseId" value={course.id} />
            <button type="submit">Записаться на курс</button>
          </form>
        ) : (
          <div className="card" style={{ marginBottom: 16 }}>
            Прогресс: <strong>{detail.progress.percent}%</strong> ({detail.progress.doneUnits}/
            {detail.progress.totalUnits})
            {detail.completedAt && <span className="muted"> · Курс пройден ✓</span>}
          </div>
        )}

        {course.modules.map((m) => (
          <div key={m.id} style={{ marginBottom: 16 }}>
            <h3>{m.title}</h3>
            <ul className="tree">
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <Link href={`/app/courses/${course.id}/lessons/${l.id}`}>
                    {detail?.completedLessonIds.has(l.id) ? '✓ ' : '○ '}
                    {l.title}
                  </Link>
                </li>
              ))}
              {m.quiz && (
                <li>
                  <Link href={`/app/courses/${course.id}/quiz/${m.quiz.id}`}>
                    {detail?.passedQuizIds.has(m.quiz.id) ? '✓ ' : '📝 '}
                    {m.quiz.title}
                  </Link>
                </li>
              )}
            </ul>
          </div>
        ))}
      </main>
    </div>
  );
}
