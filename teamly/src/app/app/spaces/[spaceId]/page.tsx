import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSpace } from '@/lib/services/spaces';
import { listTree } from '@/lib/services/pages';
import Sidebar from '@/app/_components/Sidebar';

export default async function SpacePage({ params }: { params: { spaceId: string } }) {
  const session = getSession();
  if (!session) redirect('/login');
  const space = await getSpace(params.spaceId);
  if (!space) notFound();
  const tree = await listTree(space.id);

  return (
    <div className="layout">
      <Sidebar orgId={session.orgId} activeSpaceId={space.id} />
      <main className="main">
        <h1>{space.name}</h1>
        {tree.length === 0 ? (
          <p className="muted">Пока нет страниц. Создайте первую в боковой панели.</p>
        ) : (
          <ul>
            {tree.map((n) => (
              <li key={n.id}>
                <Link href={`/app/pages/${n.id}`}>{n.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
