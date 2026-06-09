import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSpace } from '@/lib/services/spaces';
import { searchPages } from '@/lib/services/search';
import Sidebar from '@/app/_components/Sidebar';

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: { spaceId: string };
  searchParams: { q?: string };
}) {
  const session = getSession();
  if (!session) redirect('/login');
  const space = await getSpace(params.spaceId);
  if (!space) notFound();

  const q = (searchParams.q ?? '').trim();
  const hits = q ? await searchPages(space.id, q) : [];

  return (
    <div className="layout">
      <Sidebar orgId={session.orgId} activeSpaceId={space.id} />
      <main className="main">
        <h1>Поиск: «{q}»</h1>
        {hits.length === 0 ? (
          <p className="muted">Ничего не найдено.</p>
        ) : (
          hits.map((h) => (
            <div key={h.id} className="card" style={{ marginBottom: 10 }}>
              <Link href={`/app/pages/${h.id}`}>
                <strong>{h.title}</strong>
              </Link>
              {/* snippet is plain text + our own <mark> tags (page text is HTML-stripped on extract). */}
              <div className="muted" dangerouslySetInnerHTML={{ __html: h.snippet }} />
            </div>
          ))
        )}
      </main>
    </div>
  );
}
