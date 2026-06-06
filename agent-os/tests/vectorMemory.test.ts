import { HashEmbedder, HASH_EMBED_DIM } from '../src/adapters/embedder.hash';
import { cosineSim } from '../src/adapters/vector';
import { InMemoryVectorMemoryStore } from '../src/adapters/memory.vector.inMemory';

describe('HashEmbedder', () => {
  const e = new HashEmbedder();
  it('is deterministic with the right dimension', async () => {
    const [a] = await e.embed(['онбординг сотрудника']);
    const [b] = await e.embed(['онбординг сотрудника']);
    expect(a).toHaveLength(HASH_EMBED_DIM);
    expect(a).toEqual(b);
  });
  it('ranks related text closer than unrelated', async () => {
    const [q] = await e.embed(['на каком языке написан проект']);
    const [rel] = await e.embed(['проект написан на TypeScript и Prisma']);
    const [unrel] = await e.embed(['прогноз погоды на завтра дождь']);
    expect(cosineSim(q, rel)).toBeGreaterThan(cosineSim(q, unrel));
  });
});

describe('InMemoryVectorMemoryStore', () => {
  it('recalls the semantically closest memory first', async () => {
    const store = new InMemoryVectorMemoryStore(new HashEmbedder());
    await store.remember({ agentId: 'a', kind: 'long_term', content: 'Проект написан на TypeScript и Prisma.' });
    await store.remember({ agentId: 'a', kind: 'long_term', content: 'Клиент предпочитает email вместо телефона.' });

    const hits = await store.recall('a', { query: 'на каком языке проект', kinds: ['long_term'] });
    expect(hits.length).toBeGreaterThan(0);
    expect(String(hits[0].content)).toContain('TypeScript');
  });

  it('scopes short-term memory to its run and ignores other agents', async () => {
    const store = new InMemoryVectorMemoryStore(new HashEmbedder());
    await store.remember({ agentId: 'a', kind: 'short_term', runId: 'r1', content: 'scratch' });
    await store.remember({ agentId: 'b', kind: 'long_term', content: 'other agent note' });

    expect(await store.recall('a', { kinds: ['short_term'] })).toHaveLength(0);
    expect(await store.recall('a', { kinds: ['short_term'], runId: 'r1' })).toHaveLength(1);
    // agent 'a' never sees agent 'b' memory.
    expect((await store.recall('a', {})).every((m) => m.content !== 'other agent note')).toBe(true);
  });

  it('falls back to recency without a query', async () => {
    const store = new InMemoryVectorMemoryStore(new HashEmbedder());
    await store.remember({ agentId: 'a', kind: 'long_term', content: 'older', createdAt: 1 });
    await store.remember({ agentId: 'a', kind: 'long_term', content: 'newer', createdAt: 2 });
    const hits = await store.recall('a', { limit: 1 });
    expect(hits[0].content).toBe('newer');
  });
});
