// Web search port (PRD §3). The web_search tool delegates to a provider so the
// egress is controlled in one place. Production: Tavily/SerpAPI. Tests: a static
// provider.

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  search(query: string, opts?: { limit?: number }): Promise<SearchResult[]>;
}
