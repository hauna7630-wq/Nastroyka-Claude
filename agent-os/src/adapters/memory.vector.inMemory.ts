// In-memory vector memory store (offline/dev/tests). Semantic recall via the
// embedder + cosine similarity, scoped by agent + kind (short-term is run-scoped).
// Same MemoryStore contract as the pgvector store.

import { MemoryRecord } from '../domain/types';
import { MemoryStore, RecallQuery, memoryText } from '../ports/memory';
import { Embedder } from '../ports/embedder';
import { cosineSim } from './vector';

export class InMemoryVectorMemoryStore implements MemoryStore {
  private items: { record: MemoryRecord; vector: number[] }[] = [];

  constructor(private readonly embedder: Embedder) {}

  async remember(item: MemoryRecord): Promise<void> {
    const [vector] = await this.embedder.embed([memoryText(item)]);
    this.items.push({ record: { ...item, createdAt: item.createdAt ?? Date.now() }, vector });
  }

  async recall(agentId: string, query: RecallQuery = {}): Promise<MemoryRecord[]> {
    let cands = this.items.filter((it) => it.record.agentId === agentId);
    if (query.kinds) cands = cands.filter((it) => query.kinds!.includes(it.record.kind));
    // short-term memory is only visible within its run.
    cands = query.runId
      ? cands.filter((it) => it.record.kind !== 'short_term' || it.record.runId === query.runId)
      : cands.filter((it) => it.record.kind !== 'short_term');

    const limit = query.limit ?? 5;
    if (query.query) {
      const [qv] = await this.embedder.embed([query.query]);
      return cands
        .map((it) => ({ it, score: cosineSim(qv, it.vector) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => ({ ...s.it.record }));
    }
    return cands
      .sort((a, b) => (b.record.createdAt ?? 0) - (a.record.createdAt ?? 0))
      .slice(0, limit)
      .map((it) => ({ ...it.record }));
  }
}
