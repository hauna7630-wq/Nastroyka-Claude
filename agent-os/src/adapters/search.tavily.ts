// Production web search via Tavily (fetch — no SDK). Compile-only here (no key /
// network). Swap for SerpAPI behind the same SearchProvider port if preferred.

import { SearchProvider, SearchResult } from '../ports/search';

export class TavilySearchProvider implements SearchProvider {
  constructor(private readonly opts: { apiKey: string; baseUrl?: string }) {}

  async search(query: string, opts?: { limit?: number }): Promise<SearchResult[]> {
    const res = await fetch(`${this.opts.baseUrl ?? 'https://api.tavily.com'}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: this.opts.apiKey, query, max_results: opts?.limit ?? 5 }),
    });
    if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
    const json = (await res.json()) as { results: { title: string; url: string; content: string }[] };
    return json.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content }));
  }
}
