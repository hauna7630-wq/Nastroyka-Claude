// Repository-backed MemoryStore (F5, MVP). Recall ranks memories by lexical
// overlap with the query plus recency — a stand-in for vector similarity.
//
// TODO (production): back long-term recall with embeddings + pgvector; this
// adapter keeps F5 testable and infra-free while preserving the port contract.

import { MemoryRecord } from '../domain/types';
import { MemoryStore, RecallQuery, memoryText } from '../ports/memory';
import { Repository } from '../ports/repository';

export class RepositoryMemoryStore implements MemoryStore {
  constructor(private readonly repo: Repository) {}

  async remember(item: MemoryRecord): Promise<void> {
    await this.repo.appendMemory({ ...item, createdAt: item.createdAt ?? Date.now() });
  }

  async recall(agentId: string, query: RecallQuery = {}): Promise<MemoryRecord[]> {
    const kinds = query.kinds;
    let items = await this.repo.listMemories(agentId, kinds);

    // Short-term memory is only meaningful within its run.
    if (query.runId) {
      items = items.filter((m) => m.kind !== 'short_term' || m.runId === query.runId);
    } else {
      items = items.filter((m) => m.kind !== 'short_term');
    }

    const limit = query.limit ?? 5;
    const queryTokens = tokenize(query.query ?? '');

    const scored = items
      .map((m) => ({
        m,
        score: relevance(queryTokens, tokenize(memoryText(m))),
        recency: m.createdAt ?? 0,
      }))
      // When there's a query, keep only items with some lexical overlap; without
      // a query, fall back to pure recency.
      .filter((s) => (queryTokens.length === 0 ? true : s.score > 0))
      .sort((a, b) => b.score - a.score || b.recency - a.recency)
      .slice(0, limit);

    return scored.map((s) => s.m);
  }
}

// Common words carry no relevance signal and would create false matches.
const STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'with', 'what', 'which', 'that', 'this', 'from', 'are',
  'was', 'were', 'has', 'have', 'you', 'your', 'our', 'their', 'its', 'into',
  'over', 'than', 'then', 'them', 'they', 'about', 'how', 'why', 'when', 'where',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// Overlap count between query and document tokens (cheap relevance proxy).
function relevance(queryTokens: string[], docTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const doc = new Set(docTokens);
  let hits = 0;
  for (const t of new Set(queryTokens)) if (doc.has(t)) hits += 1;
  return hits;
}
