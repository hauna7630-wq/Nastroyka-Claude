// Vector long-term memory on live Postgres + pgvector. Gated on DATABASE_URL.

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PgVectorMemoryStore, RawSqlClient } from '../../src/adapters/memory.vector.pg';
import { HashEmbedder } from '../../src/adapters/embedder.hash';

const describeIf = process.env.DATABASE_URL ? describe : describe.skip;

describeIf('Vector long-term memory (live pgvector)', () => {
  const prisma = new PrismaClient();
  const store = new PgVectorMemoryStore(prisma as unknown as RawSqlClient, new HashEmbedder());
  const orgId = `org_${randomUUID()}`;
  const agentId = `agent_${randomUUID()}`;
  const otherId = `agent_${randomUUID()}`;

  beforeAll(async () => {
    await prisma.org.create({ data: { id: orgId, name: 'MemCo' } });
    await prisma.agent.create({ data: { id: agentId, orgId, name: 'A', type: 'researcher' } });
    await prisma.agent.create({ data: { id: otherId, orgId, name: 'B', type: 'analyst' } });

    await store.remember({ agentId, kind: 'long_term', content: 'Проект написан на TypeScript и использует Prisma.' });
    await store.remember({ agentId, kind: 'long_term', content: 'Клиент предпочитает email вместо телефонных звонков.' });
    await store.remember({ agentId, kind: 'episodic', runId: 'r1', content: { task: 'квартальный отчёт', summary: 'готово' } });
    await store.remember({ agentId: otherId, kind: 'long_term', content: 'Бюджет на маркетинг утверждён.' });
  });

  afterAll(async () => {
    await prisma.org.delete({ where: { id: orgId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('semantically recalls the closest memory and writes the embedding', async () => {
    const hits = await store.recall(agentId, { query: 'на каком языке написан проект', kinds: ['long_term', 'episodic'] });
    expect(hits.length).toBeGreaterThan(0);
    expect(String(hits[0].content)).toContain('TypeScript');
  });

  it('recalls episodic memory by its task', async () => {
    const hits = await store.recall(agentId, { query: 'квартальный отчёт', kinds: ['episodic'] });
    expect(hits.some((h) => JSON.stringify(h.content).includes('квартальный'))).toBe(true);
  });

  it('does not leak memory across agents', async () => {
    const hits = await store.recall(agentId, { query: 'бюджет на маркетинг', kinds: ['long_term'] });
    expect(hits.every((h) => !String(h.content).includes('Бюджет'))).toBe(true);
  });
});
