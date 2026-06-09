import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { listWorkspaces, listSpaces } from '@/lib/services/spaces';
import { listCourses } from '@/lib/services/courses';
import Sidebar from '@/app/_components/Sidebar';
import { createCourseFromSpaceAction } from '@/app/lms-actions';

export default async function CoursesPage() {
  const session = getSession();
  if (!session) redirect('/login');
  const workspaces = await listWorkspaces(session.orgId);
  const ws = workspaces[0];

  const [courses, spaces] = ws
    ? await Promise.all([listCourses(ws.id), listSpaces(ws.id)])
    : [[], []];

  return (
    <div className="layout">
      <Sidebar orgId={session.orgId} />
      <main className="main">
        <h1>Курсы</h1>
        {courses.length === 0 ? (
          <p className="muted">Пока нет курсов. Сгенерируйте курс из базы знаний ниже.</p>
        ) : (
          <ul>
            {courses.map((c) => (
              <li key={c.id}>
                <Link href={`/app/courses/${c.id}`}>{c.title}</Link>{' '}
                <span className="muted">
                  · модулей: {c._count.modules} · записаны: {c._count.enrollments}
                </span>
              </li>
            ))}
          </ul>
        )}

        {ws && (
          <div className="card" style={{ marginTop: 20, maxWidth: 480 }}>
            <h3>Создать курс из базы знаний</h3>
            <form action={createCourseFromSpaceAction} style={{ display: 'grid', gap: 8 }}>
              <input type="hidden" name="workspaceId" value={ws.id} />
              <input name="title" placeholder="Название курса" required />
              <select name="spaceId" required>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button type="submit">Сгенерировать курс</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
