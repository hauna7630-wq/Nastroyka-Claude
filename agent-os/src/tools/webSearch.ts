// web_search tool (PRD §3): up-to-date information via a controlled provider.

import { ToolSpec } from './registry';

export const webSearchTool: ToolSpec = {
  schema: {
    name: 'web_search',
    description: 'Search the web for up-to-date information. Returns titled results with snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', description: 'max results (default 5)' },
      },
      required: ['query'],
    },
  },
  security: {
    network: 'allowlist', // egress is the provider's responsibility
    cpuMs: 5000,
    memMb: 128,
    persistFs: false,
  },
  async run(input, ctx) {
    if (!ctx.search) {
      throw new Error('web_search is not configured (no search provider)');
    }
    const results = await ctx.search.search(String(input.query ?? ''), {
      limit: input.limit ? Number(input.limit) : 5,
    });
    return { results };
  },
};
