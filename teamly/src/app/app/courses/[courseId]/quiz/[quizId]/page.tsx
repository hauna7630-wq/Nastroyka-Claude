import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getEnrollmentDetail } from '@/lib/services/enrollment';
import Sidebar from '@/app/_components/Sidebar';
import { submitQuizAction } from '@/app/lms-actions';

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: { courseId: string; quizId: string };
  searchParams: { score?: string; passed?: string };
}) {
  const session = getSession();
  if (!session) redirect('/login');
  const quiz = await prisma.quiz.findUnique({
    where: { id: params.quizId },
    include: {
      questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
    },
  });
  if (!quiz) notFound();
  const detail = await getEnrollmentDetail(params.courseId, session.userId);

  const hasResult = searchParams.score !== undefined;
  const passed = searchParams.passed === '1';

  return (
    <div className="layout">
      <Sidebar orgId={session.orgId} />
      <main className="main">
        <p className="muted">
          <Link href={`/app/courses/${params.courseId}`}>← к курсу</Link>
        </p>
        <h1>{quiz.title}</h1>

        {hasResult && (
          <div className="card" style={{ marginBottom: 16, borderColor: passed ? '#1a7f37' : '#cf222e' }}>
            Результат: <strong>{searchParams.score}%</strong> —{' '}
            {passed ? 'тест пройден ✓' : 'не пройден'} (порог {quiz.passingScore}%)
          </div>
        )}

        {!detail ? (
          <p className="muted">Запишитесь на курс, чтобы пройти тест.</p>
        ) : (
          <form action={submitQuizAction}>
            <input type="hidden" name="courseId" value={params.courseId} />
            <input type="hidden" name="quizId" value={quiz.id} />
            <input type="hidden" name="enrollmentId" value={detail.enrollmentId} />
            {quiz.questions.map((q, i) => (
              <div key={q.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {i + 1}. {q.prompt}
                </div>
                {q.options.map((o) => (
                  <label key={o.id} style={{ display: 'block' }}>
                    <input type="radio" name={`q:${q.id}`} value={o.id} required /> {o.text}
                  </label>
                ))}
              </div>
            ))}
            <button type="submit">Отправить ответы</button>
          </form>
        )}
      </main>
    </div>
  );
}
