// T1 integration: knowledge-base services against live Postgres. Gated on DATABASE_URL.
//
//   DATABASE_URL=... npm run db:migrate
//   DATABASE_URL=... npm run test:integration

import { prisma } from '@/lib/db';
import { bootstrapOrg, login, roleInWorkspace } from '@/lib/services/org';
import {
  createPage,
  savePageContent,
  listTree,
  listVersions,
  getPage,
} from '@/lib/services/pages';
import { searchPages } from '@/lib/services/search';
import { addComment, listComments } from '@/lib/services/comments';

const describeIf = process.env.DATABASE_URL ? describe : describe.skip;

describeIf('T1 knowledge base (live Postgres)', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapOrg>>;

  beforeAll(async () => {
    ctx = await bootstrapOrg({
      orgName: 'Acme ' + Date.now(),
      userEmail: `owner_${Date.now()}@example.com`,
      userName: 'Owner',
      password: 'secret123',
    });
  });

  afterAll(async () => {
    await prisma.org.delete({ where: { id: ctx.org.id } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('bootstraps org → workspace → space and assigns the owner role', async () => {
    expect(ctx.space.id).toBeTruthy();
    expect(await roleInWorkspace(ctx.user.id, ctx.workspace.id)).toBe('owner');
  });

  it('creates pages, versions content, and builds a tree', async () => {
    const root = await createPage({ spaceId: ctx.space.id, title: 'Onboarding' });
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Welcome to the team.' }] }],
    };
    const v1 = await savePageContent({ pageId: root.id, title: 'Onboarding', contentJson: doc, authorId: ctx.user.id });
    const v2 = await savePageContent({ pageId: root.id, title: 'Onboarding', contentJson: doc, authorId: ctx.user.id });
    expect([v1, v2]).toEqual([1, 2]);
    expect(await listVersions(root.id)).toHaveLength(2);

    const fresh = await getPage(root.id);
    expect(fresh?.contentText).toContain('Welcome to the team');

    await createPage({ spaceId: ctx.space.id, parentId: root.id, title: 'Tools' });
    const tree = await listTree(ctx.space.id);
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('Onboarding');
    expect(tree[0].children.map((c) => c.title)).toEqual(['Tools']);
  });

  it('full-text searches page content', async () => {
    const hits = await searchPages(ctx.space.id, 'welcome team');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].snippet).toContain('<mark>');
  });

  it('adds and lists comments', async () => {
    const tree = await listTree(ctx.space.id);
    const pageId = tree[0].id;
    await addComment({ pageId, authorId: ctx.user.id, body: 'Looks good!' });
    const comments = await listComments(pageId);
    expect(comments).toHaveLength(1);
    expect(comments[0].author.name).toBe('Owner');
  });

  it('logs in with the right password only', async () => {
    expect(await login(ctx.user.email, 'secret123')).toMatchObject({ id: ctx.user.id });
    expect(await login(ctx.user.email, 'wrong')).toBeNull();
  });
});
