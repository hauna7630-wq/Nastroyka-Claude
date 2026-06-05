import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSpace } from '@/lib/services/spaces';
import { ask } from '@/lib/services/rag';
import Sidebar from '@/app/_components/Sidebar';

export default async function AskPage({
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
  const result = q ? await ask(space.id, q) : null;

  return (
    <div className="layout">
      <Sidebar orgId={session.orgId} activeSpaceId={space.id} />
      <main className="main">
        <h1>Спросить базу знаний</h1>
        <p className="muted">
          ИИ-ассистент отвечает только на основе содержимого базы знаний и указывает источники.
        </p>
        <form method="get" className="row" style={{ margin: '16px 0' }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Например: как проходит онбординг нового сотрудника?"
            style={{ width: '100%' }}
          />
          <button type="submit">Спросить</button>
        </form>

        {result && (
          <div className="card">
            <div style={{ whiteSpace: 'pre-wrap' }}>{result.answer}</div>
            {!result.refused && result.citations.length > 0 && (
              <div className="muted" style={{ marginTop: 12 }}>
                Источники:{' '}
                {result.citations.map((c, i) => (
                  <span key={c.pageId}>
                    {i > 0 ? ', ' : ''}
                    <Link href={`/app/pages/${c.pageId}`}>{c.title}</Link>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
