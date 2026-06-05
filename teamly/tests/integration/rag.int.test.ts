// T2 integration: RAG over the knowledge base on live Postgres + pgvector.
// Uses the default offline HashEmbedder + ExtractiveChatModel (no API keys), so
// the whole pipeline runs deterministically. Gated on DATABASE_URL.

import { prisma } from '@/lib/db';
import { bootstrapOrg } from '@/lib/services/org';
import { createSpace } from '@/lib/services/spaces';
import { createPage, savePageContent } from '@/lib/services/pages';
import { semanticSearch, ask } from '@/lib/services/rag';

const describeIf = process.env.DATABASE_URL ? describe : describe.skip;

function doc(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

async function addPage(spaceId: string, authorId: string, title: string, text: string) {
  const page = await createPage({ spaceId, title });
  await savePageContent({ pageId: page.id, title, contentJson: doc(text), authorId });
  return page;
}

describeIf('T2 RAG (live Postgres + pgvector)', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapOrg>>;
  let financeSpaceId: string;

  beforeAll(async () => {
    ctx = await bootstrapOrg({
      orgName: 'RagCo ' + Date.now(),
      userEmail: `rag_${Date.now()}@example.com`,
      userName: 'Автор',
      password: 'secret123',
    });
    // Space A: the seeded "База знаний".
    await addPage(
      ctx.space.id,
      ctx.user.id,
      'Онбординг',
      'Онбординг нового сотрудника. В первый день получите доступы, изучите регламент компании и пройдите вводный инструктаж.',
    );
    await addPage(
      ctx.space.id,
      ctx.user.id,
      'Отпуска',
      'Политика отпусков: сотрудник имеет право на 28 календарных дней оплачиваемого отпуска в год.',
    );
    // Space B (same org, different space) — for isolation.
    const finance = await createSpace(ctx.workspace.id, 'Финансы');
    financeSpaceId = finance.id;
    await addPage(
      financeSpaceId,
      ctx.user.id,
      'Бюджет',
      'Квартальный бюджет на маркетинг и закупку оборудования утверждается финансовым отделом.',
    );
  });

  afterAll(async () => {
    await prisma.org.delete({ where: { id: ctx.org.id } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('semantic search ranks the relevant page first', async () => {
    const hits = await semanticSearch(ctx.space.id, 'онбординг регламент доступы', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].pageTitle).toBe('Онбординг');
    expect(hits[0].score).toBeGreaterThan(0.12);
  });

  it('answers grounded questions with citations', async () => {
    const a = await ask(ctx.space.id, 'как проходит онбординг нового сотрудника?');
    expect(a.refused).toBe(false);
    expect(a.citations.map((c) => c.title)).toContain('Онбординг');
    expect(a.answer.toLowerCase()).toContain('регламент');
  });

  it('refuses (no hallucination) when nothing relevant is found', async () => {
    const a = await ask(ctx.space.id, 'рецепт борща с пампушками и чесноком');
    expect(a.refused).toBe(true);
    expect(a.citations).toHaveLength(0);
  });

  it('does not leak across spaces (tenant/space isolation)', async () => {
    // The "Бюджет" page lives only in Space B.
    const inA = await semanticSearch(ctx.space.id, 'квартальный бюджет маркетинг оборудование', 5);
    expect(inA.every((h) => h.pageTitle !== 'Бюджет')).toBe(true);

    const inB = await semanticSearch(financeSpaceId, 'квартальный бюджет маркетинг оборудование', 5);
    expect(inB[0]?.pageTitle).toBe('Бюджет');
  });
});
