import { buildDockerArgs } from '../src/adapters/sandbox.docker';
import { buildSubprocessArgs } from '../src/adapters/sandbox.subprocess';
import { codeExecTool } from '../src/tools/codeExec';
import { DisabledSandbox, Sandbox, SandboxRequest, SandboxResult } from '../src/ports/sandbox';

const LIMITS = { cpuMs: 5000, memMb: 256, network: 'deny' as const };

describe('Docker sandbox arg builder', () => {
  it('enforces the security profile via container flags', () => {
    const args = buildDockerArgs('python', 'print(1)', LIMITS);
    const joined = args.join(' ');
    expect(joined).toContain('--network none');
    expect(joined).toContain('--memory 256m');
    expect(joined).toContain('--pids-limit 128');
    expect(joined).toContain('--read-only');
    expect(joined).toContain('--cap-drop ALL');
    expect(joined).toContain('--user 65534:65534');
    expect(args).toContain('--rm');
    expect(args).toContain('python:3.12-slim');
  });
});

describe('Subprocess sandbox arg builder', () => {
  it('wraps the interpreter in a network namespace + rlimits under a wall timeout', () => {
    const { cmd, args, wallMs } = buildSubprocessArgs('python', '/tmp/x/main.py', LIMITS);
    expect(cmd).toBe('timeout');
    expect(args).toContain('--net'); // unshare network isolation
    expect(args).toContain('prlimit');
    expect(args).toContain('--cpu=5');
    expect(args).toContain('--as=268435456'); // 256 MiB
    expect(args[args.length - 1]).toBe('/tmp/x/main.py');
    expect(wallMs).toBeGreaterThan(LIMITS.cpuMs);
  });
});

describe('code_exec tool wiring', () => {
  class FakeSandbox implements Sandbox {
    public last?: SandboxRequest;
    async run(req: SandboxRequest): Promise<SandboxResult> {
      this.last = req;
      return { stdout: '42\n', stderr: '', exitCode: 0, timedOut: false };
    }
  }

  it('passes the security profile to the sandbox and returns its result', async () => {
    const fake = new FakeSandbox();
    const result = await codeExecTool.run(
      { language: 'python', source: 'print(6*7)' },
      { allowlistDomains: [], sandbox: fake },
    );
    expect(result).toEqual({ stdout: '42\n', stderr: '', exitCode: 0, timedOut: false });
    expect(fake.last?.limits).toEqual({ cpuMs: 5000, memMb: 256, network: 'deny' });
  });

  it('refuses without a sandbox and rejects unsupported languages', async () => {
    await expect(
      codeExecTool.run({ language: 'python', source: 'x' }, { allowlistDomains: [] }),
    ).rejects.toThrow(/disabled/);
    await expect(
      codeExecTool.run({ language: 'ruby', source: 'x' }, { allowlistDomains: [], sandbox: new FakeSandbox() }),
    ).rejects.toThrow(/unsupported/);
  });

  it('DisabledSandbox throws when invoked', async () => {
    await expect(
      codeExecTool.run({ language: 'node', source: '1' }, { allowlistDomains: [], sandbox: new DisabledSandbox() }),
    ).rejects.toThrow(/not enabled/);
  });
});
