import {
  httpRequestTool,
  isHostAllowed,
  DomainNotAllowedError,
} from '../src/tools/httpRequest';
import { ToolRegistry } from '../src/tools/registry';
import { codeExecTool } from '../src/tools/codeExec';

describe('http_request allowlist (sandbox network boundary)', () => {
  it('matches exact hosts and subdomains, rejects others', () => {
    expect(isHostAllowed('https://api.github.com/x', ['api.github.com'])).toBe(true);
    expect(isHostAllowed('https://sub.example.com', ['example.com'])).toBe(true);
    expect(isHostAllowed('https://evil.com', ['example.com'])).toBe(false);
    expect(isHostAllowed('not-a-url', ['example.com'])).toBe(false);
  });

  it('denies by default when the domain is not allowlisted', async () => {
    await expect(
      httpRequestTool.run({ url: 'https://evil.com' }, { allowlistDomains: ['example.com'] }),
    ).rejects.toBeInstanceOf(DomainNotAllowedError);
  });

  it('permits an allowlisted request (fetch mocked)', async () => {
    const mockFetch = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({ status: 200, text: async () => 'hello' } as any);

    const result = (await httpRequestTool.run(
      { url: 'https://example.com/data' },
      { allowlistDomains: ['example.com'] },
    )) as { status: number; body: string };

    expect(result).toEqual({ status: 200, body: 'hello' });
    expect(mockFetch).toHaveBeenCalled();
    mockFetch.mockRestore();
  });
});

describe('tool registry', () => {
  it('dispatches by name and throws on unknown tools', async () => {
    const reg = new ToolRegistry();
    reg.register(codeExecTool);
    expect(reg.schemas().map((s) => s.name)).toContain('code_exec');
    await expect(reg.run('nope', {}, { allowlistDomains: [] })).rejects.toThrow(
      /Unknown tool/,
    );
  });

  it('code_exec is disabled in the MVP', async () => {
    await expect(
      codeExecTool.run({ language: 'node', source: '1+1' }, { allowlistDomains: [] }),
    ).rejects.toThrow(/not enabled/);
  });
});
