import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { listWorkspaces, listSpaces } from '@/lib/services/spaces';

export default async function AppHome() {
  const session = getSession();
  if (!session) redirect('/login');

  const workspaces = await listWorkspaces(session.orgId);
  for (const w of workspaces) {
    const spaces = await listSpaces(w.id);
    if (spaces[0]) redirect(`/app/spaces/${spaces[0].id}`);
  }

  return (
    <div className="main">
      <h2>Нет пространств</h2>
      <p className="muted">
        Запустите <code>npm run db:seed</code> для демо-данных, затем обновите страницу.
      </p>
    </div>
  );
}
