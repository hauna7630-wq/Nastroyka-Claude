// Deterministic offline search provider for dev/tests.

import { SearchProvider, SearchResult } from '../ports/search';

export class StaticSearchProvider implements SearchProvider {
  constructor(private readonly fixtures: Record<string, SearchResult[]> = {}) {}

  async search(query: string, opts?: { limit?: number }): Promise<SearchResult[]> {
    const limit = opts?.limit ?? 5;
    if (this.fixtures[query]) return this.fixtures[query].slice(0, limit);
    return [
      {
        title: `Результат по «${query}»`,
        url: `https://example.com/${encodeURIComponent(query)}`,
        snippet: `Краткая сводка по запросу: ${query}.`,
      },
    ].slice(0, limit);
  }
}
