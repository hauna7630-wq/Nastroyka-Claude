// Memory store port (F5). The runtime recalls relevant memory into an agent's
// prompt and writes episodic summaries after runs. Production swaps in a
// vector-backed store (pgvector / embeddings); the MVP adapter uses lexical
// relevance over the Repository.

import { MemoryKind, MemoryRecord } from '../domain/types';

export interface RecallQuery {
  kinds?: MemoryKind[];
  // Free-text used to rank long-term/episodic memories by relevance.
  query?: string;
  // Scope short-term recall to a single run.
  runId?: string;
  limit?: number;
}

export interface MemoryStore {
  remember(item: MemoryRecord): Promise<void>;
  recall(agentId: string, query?: RecallQuery): Promise<MemoryRecord[]>;
}

// Render a memory's content as text for prompting + relevance scoring. Episodic
// records carry { task, summary }; both contribute so a memory is recallable by
// the task it came from.
export function memoryText(m: MemoryRecord): string {
  const c = m.content;
  if (c && typeof c === 'object' && 'summary' in c) {
    const obj = c as { summary: unknown; task?: unknown };
    const task = obj.task ? `${String(obj.task)} ` : '';
    return `${task}${String(obj.summary)}`.trim();
  }
  return typeof c === 'string' ? c : JSON.stringify(c);
}
