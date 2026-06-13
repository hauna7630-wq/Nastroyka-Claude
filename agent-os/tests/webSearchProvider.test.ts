import { PerplexitySearchProvider } from '../src/adapters/search.perplexity';

// Minimal fetch stub: captures the request and returns a canned Perplexity body.
function stubFetch(body: unknown, ok = true, status = 200) {
  const calls: Array<{ url: string; init: any }> = [];
  const fn = async (url: string, init: any) => {
    calls.push({ url, init });
    return {
      ok,
      status,
      json: async () => body,
    } as unknown as Response;
  };
  return { fn, calls };
}

describe('PerplexitySearchProvider', () => {
  const orig = global.fetch;
  afterEach(() => {
    (global as any).fetch = orig;
  });

  it('surfaces the synthesized answer first, then citations', async () => {
    const { fn, calls } = stubFetch({
      choices: [{ message: { content: 'Ставка НДС на УСН с 2026 — 22%.' } }],
      citations: ['https://nalog.gov.ru/a', 'https://nalog.gov.ru/b'],
    });
    (global as any).fetch = fn;
    const p = new PerplexitySearchProvider({ apiKey: 'k' });
    const out = await p.search('ндс усн 2026', { limit: 3 });
    expect(out[0].snippet).toContain('22%');
    expect(out[1]).toMatchObject({ url: 'https://nalog.gov.ru/a' });
    // bearer auth header is sent
    expect(calls[0].init.headers.authorization).toBe('Bearer k');
  });

  it('prefers structured search_results when present', async () => {
    const { fn } = stubFetch({
      choices: [{ message: { content: 'сводка' } }],
      search_results: [{ title: 'Док', url: 'https://x/1', snippet: 'фрагмент' }],
    });
    (global as any).fetch = fn;
    const p = new PerplexitySearchProvider({ apiKey: 'k' });
    const out = await p.search('q');
    expect(out.some((r) => r.url === 'https://x/1' && r.title === 'Док')).toBe(true);
  });

  it('throws an honest error on a non-OK response', async () => {
    const { fn } = stubFetch({}, false, 429);
    (global as any).fetch = fn;
    const p = new PerplexitySearchProvider({ apiKey: 'k' });
    await expect(p.search('q')).rejects.toThrow(/Perplexity search failed: 429/);
  });
});
