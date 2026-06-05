// http_request tool — network egress is deny-by-default and allowlist-gated.

import { ToolSpec } from './registry';

export class DomainNotAllowedError extends Error {
  constructor(host: string) {
    super(`Domain not in allowlist: ${host}`);
    this.name = 'DomainNotAllowedError';
  }
}

export function isHostAllowed(urlStr: string, allowlist: string[]): boolean {
  let host: string;
  try {
    host = new URL(urlStr).hostname;
  } catch {
    return false;
  }
  return allowlist.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

export const httpRequestTool: ToolSpec = {
  schema: {
    name: 'http_request',
    description:
      'Perform an HTTP request to an allowlisted domain. Returns status and body text.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Absolute URL to fetch' },
        method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
        body: { type: 'string', description: 'Optional request body' },
      },
      required: ['url'],
    },
  },
  security: {
    network: 'allowlist',
    cpuMs: 5000,
    memMb: 128,
    persistFs: false,
  },
  async run(input, ctx) {
    const url = String(input.url ?? '');
    if (!isHostAllowed(url, ctx.allowlistDomains)) {
      throw new DomainNotAllowedError(safeHost(url));
    }
    const method = (input.method as string) ?? 'GET';
    const res = await fetch(url, {
      method,
      body: input.body ? String(input.body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 10_000) };
  },
};

function safeHost(urlStr: string): string {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return '<invalid-url>';
  }
}
