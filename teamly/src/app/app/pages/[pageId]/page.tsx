import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getPage } from '@/lib/services/pages';
import { listComments } from '@/lib/services/comments';
import Sidebar from '@/app/_components/Sidebar';
import Editor from '@/app/_components/Editor';
import { savePageAction, addCommentAction } from '@/app/actions';

export default async function PageView({ params }: { params: { pageId: string } }) {
  const session = getSession();
  if (!session) redirect('/login');
  const page = await getPage(params.pageId);
  if (!page) notFound();
  const comments = await listComments(page.id);

  return (
    <div className="layout">
      <Sidebar orgId={session.orgId} activeSpaceId={page.spaceId} activePageId={page.id} />
      <main className="main">
        <Editor
          pageId={page.id}
          initialTitle={page.title}
          initialContent={page.contentJson}
          save={savePageAction}
        />

        <section style={{ marginTop: 32 }}>
          <h3>Комментарии</h3>
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <strong>{c.author.name}</strong>{' '}
              <span className="muted">{new Date(c.createdAt).toLocaleString('ru-RU')}</span>
              <div>{c.body}</div>
            </div>
          ))}
          <form action={addCommentAction} className="row" style={{ marginTop: 10 }}>
            <input type="hidden" name="pageId" value={page.id} />
            <input name="body" placeholder="Оставить комментарий" style={{ width: '100%' }} />
            <button type="submit">Отправить</button>
          </form>
        </section>
      </main>
    </div>
  );
}
