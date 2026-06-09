// F3 live sandbox test: actually runs the SubprocessSandbox (Linux namespaces +
// rlimits). Gated on SANDBOX_E2E because it requires Linux + CAP_SYS_ADMIN
// (unshare --net) and real interpreters.
//
//   SANDBOX_E2E=1 npm run test:integration

import { SubprocessSandbox } from '../../src/adapters/sandbox.subprocess';
import { SandboxLimits } from '../../src/ports/sandbox';

const describeIf =
  process.env.SANDBOX_E2E && process.platform === 'linux' ? describe : describe.skip;

const LIMITS: SandboxLimits = { cpuMs: 2000, memMb: 256, network: 'deny' };

describeIf('F3 — SubprocessSandbox (namespaces + rlimits)', () => {
  const sbx = new SubprocessSandbox();

  it('runs python and captures stdout', async () => {
    const r = await sbx.run({ language: 'python', source: 'print(2 + 2)', limits: LIMITS });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('4');
  });

  it('runs node and captures stdout', async () => {
    const r = await sbx.run({ language: 'node', source: 'console.log(6 * 7)', limits: LIMITS });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('42');
  });

  it('denies network egress', async () => {
    const source = [
      'import socket',
      's = socket.socket(); s.settimeout(3)',
      's.connect(("1.1.1.1", 53))',
      'print("REACHED")',
    ].join('\n');
    const r = await sbx.run({ language: 'python', source, limits: LIMITS });
    expect(r.stdout).not.toContain('REACHED');
    expect(r.exitCode).not.toBe(0); // connect raised inside the netns
  });

  it('enforces the memory ceiling', async () => {
    const r = await sbx.run({
      language: 'python',
      source: 'b = bytearray(300 * 1024 * 1024)\nprint("OK")',
      limits: { ...LIMITS, memMb: 64 },
    });
    expect(r.stdout).not.toContain('OK');
    expect(r.exitCode).not.toBe(0);
  });

  it('enforces a wall-clock timeout', async () => {
    const r = await sbx.run({
      language: 'python',
      source: 'import time\ntime.sleep(30)',
      limits: { ...LIMITS, cpuMs: 1000 },
    });
    expect(r.timedOut).toBe(true);
  });
});
