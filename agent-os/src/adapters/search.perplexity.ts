// Production web search via Perplexity (fetch — no SDK). Perplexity returns a
// synthesized answer plus the source documents it cited; we surface the answer
// as the first result and each citation as a SearchResult so the agent gets both
// the gist and verifiable links. Compile-only here (no key / network).

import { SearchProvider, SearchResult } from '../ports/search';

interface PerplexityChoice {
  message?: { content?: string };
}
interface PerplexityResponse {
  choices?: PerplexityChoice[];
  // Perplexity returns citation URLs (and, on newer models, richer search_results).
  citations?: string[];
  search_results?: { title?: string; url?: string; snippet?: string }[];
}

export class PerplexitySearchProvider implements SearchProvider {
  constructor(
    private readonly opts: { apiKey: string; baseUrl?: string; model?: string },
  ) {}

  async search(query: string, opts?: { limit?: number }): Promise<SearchResult[]> {
    const limit = opts?.limit ?? 5;
    const res = await fetch(`${this.opts.baseUrl ?? 'https://api.perplexity.ai'}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        model: this.opts.model ?? 'sonar',
        messages: [
          {
            role: 'system',
            content:
              'You are a web research assistant. Answer concisely with up-to-date facts and cite sources.',
          },
          { role: 'user', content: query },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Perplexity search failed: ${res.status}`);
    const json = (await res.json()) as PerplexityResponse;

    const answer = json.choices?.[0]?.message?.content?.trim();
    const results: SearchResult[] = [];
    if (answer) {
      results.push({ title: 'Сводка (Perplexity)', url: '', snippet: answer });
    }
    // Prefer structured search_results when present; otherwise fall back to bare
    // citation URLs.
    if (Array.isArray(json.search_results) && json.search_results.length) {
      for (const r of json.search_results) {
        results.push({
          title: r.title ?? r.url ?? 'источник',
          url: r.url ?? '',
          snippet: r.snippet ?? '',
        });
      }
    } else if (Array.isArray(json.citations)) {
      for (const url of json.citations) {
        results.push({ title: url, url, snippet: '' });
      }
    }
    return results.slice(0, Math.max(1, limit + 1));
  }
}
