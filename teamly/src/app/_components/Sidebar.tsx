import Link from 'next/link';
import { listWorkspaces, listSpaces } from '@/lib/services/spaces';
import { listTree } from '@/lib/services/pages';
import { PageTreeNode } from '@/lib/tree';
import { createPageAction, logoutAction } from '../actions';

function TreeNav({ nodes, activePageId }: { nodes: PageTreeNode[]; activePageId?: string }) {
  if (nodes.length === 0) return null;
  return (
    <ul className="tree">
      {nodes.map((n) => (
        <li key={n.id}>
          <Link href={`/app/pages/${n.id}`} className={n.id === activePageId ? 'active' : ''}>
            {n.title}
          </Link>
          <TreeNav nodes={n.children} activePageId={activePageId} />
        </li>
      ))}
    </ul>
  );
}

export default async function Sidebar({
  orgId,
  activeSpaceId,
  activePageId,
}: {
  orgId: string;
  activeSpaceId?: string;
  activePageId?: string;
}) {
  const workspaces = await listWorkspaces(orgId);
  const spacesByWs = await Promise.all(
    workspaces.map(async (w) => ({ w, spaces: await listSpaces(w.id) })),
  );
  const tree = activeSpaceId ? await listTree(activeSpaceId) : [];

  return (
    <aside className="sidebar">
      <div className="brand">Teamly</div>

      {activeSpaceId && (
        <>
          <form action={`/app/spaces/${activeSpaceId}/search`} method="get" className="row" style={{ marginBottom: 6 }}>
            <input name="q" placeholder="Поиск в базе знаний" style={{ width: '100%' }} />
          </form>
          <div style={{ marginBottom: 10 }}>
            <Link href={`/app/spaces/${activeSpaceId}/ask`}>🤖 Спросить ИИ</Link>
          </div>
        </>
      )}

      {spacesByWs.map(({ w, spaces }) => (
        <div key={w.id}>
          <div className="section-title">{w.name}</div>
          {spaces.map((s) => (
            <div key={s.id}>
              <Link
                href={`/app/spaces/${s.id}`}
                style={{ fontWeight: s.id === activeSpaceId ? 700 : 400 }}
              >
                {s.name}
              </Link>
              {s.id === activeSpaceId && <TreeNav nodes={tree} activePageId={activePageId} />}
            </div>
          ))}
        </div>
      ))}

      {activeSpaceId && (
        <form action={createPageAction} className="row" style={{ marginTop: 14 }}>
          <input type="hidden" name="spaceId" value={activeSpaceId} />
          <input name="title" placeholder="Новая страница" style={{ width: '100%' }} />
          <button type="submit" className="secondary">+</button>
        </form>
      )}

      <form action={logoutAction} style={{ marginTop: 24 }}>
        <button type="submit" className="secondary">Выйти</button>
      </form>
    </aside>
  );
}
