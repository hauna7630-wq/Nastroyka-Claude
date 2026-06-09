import { webSearchTool } from '../src/tools/webSearch';
import { readDocumentTool } from '../src/tools/document';
import { StaticSearchProvider } from '../src/adapters/search.mock';
import { PlainTextDocumentParser } from '../src/adapters/documents.text';
import { SearchResult } from '../src/ports/search';

const ctx = (over: object = {}) => ({ allowlistDomains: [], ...over });

describe('web_search tool (PRD §3)', () => {
  it('returns provider results', async () => {
    const fixtures: Record<string, SearchResult[]> = {
      'crm market': [{ title: 'CRM 2026', url: 'https://x.io/crm', snippet: 'overview' }],
    };
    const out = (await webSearchTool.run(
      { query: 'crm market' },
      ctx({ search: new StaticSearchProvider(fixtures) }),
    )) as { results: SearchResult[] };
    expect(out.results[0]).toMatchObject({ title: 'CRM 2026', url: 'https://x.io/crm' });
  });

  it('respects the limit and falls back to a synthetic result', async () => {
    const out = (await webSearchTool.run(
      { query: 'погода', limit: 1 },
      ctx({ search: new StaticSearchProvider() }),
    )) as { results: SearchResult[] };
    expect(out.results).toHaveLength(1);
    expect(out.results[0].title).toContain('погода');
  });

  it('is disabled without a search provider', async () => {
    await expect(webSearchTool.run({ query: 'x' }, ctx())).rejects.toThrow(/not configured/);
  });
});

describe('read_document tool (PRD §3)', () => {
  const documents = new PlainTextDocumentParser();

  it('extracts plain text and trims it', async () => {
    const out = (await readDocumentTool.run(
      { mime: 'text/plain', content: '  hello world  ' },
      ctx({ documents }),
    )) as { text: string; chars: number };
    expect(out.text).toBe('hello world');
    expect(out.chars).toBe(11);
  });

  it('flattens CSV rows and decodes base64', async () => {
    const b64 = Buffer.from('a,b\n1,2').toString('base64');
    const out = (await readDocumentTool.run(
      { mime: 'text/csv', content: b64, base64: true },
      ctx({ documents }),
    )) as { text: string };
    expect(out.text).toBe('a | b\n1 | 2');
  });

  it('reformats JSON', async () => {
    const out = (await readDocumentTool.run(
      { mime: 'application/json', content: '{"x": 1}' },
      ctx({ documents }),
    )) as { text: string };
    expect(out.text).toBe('{"x":1}');
  });

  it('rejects rich formats without a rich parser', async () => {
    await expect(
      readDocumentTool.run({ mime: 'application/pdf', content: '%PDF' }, ctx({ documents })),
    ).rejects.toThrow(/rich parser/);
  });

  it('is disabled without a document parser', async () => {
    await expect(
      readDocumentTool.run({ mime: 'text/plain', content: 'x' }, ctx()),
    ).rejects.toThrow(/not configured/);
  });
});
