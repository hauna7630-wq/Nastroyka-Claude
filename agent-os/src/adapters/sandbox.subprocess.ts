// Subprocess sandbox (F3) for Linux: isolates code with a network namespace
// (unshare --net → loopback only) and rlimits (prlimit → CPU + address space),
// running in a throwaway temp dir so nothing persists. Requires CAP_SYS_ADMIN
// (root) for `unshare --net`.
//
// This is a real boundary for network + CPU + memory + fs-persistence, but it
// shares the host kernel; for stronger isolation use DockerSandbox in production.

import { spawn } from 'child_process';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  Sandbox,
  SandboxLanguage,
  SandboxLimits,
  SandboxRequest,
  SandboxResult,
} from '../ports/sandbox';

const FILENAME: Record<SandboxLanguage, string> = {
  python: 'main.py',
  node: 'main.js',
};

function interpreter(lang: SandboxLanguage): string {
  // Node: reuse the running binary. Python: resolve via PATH.
  return lang === 'node' ? process.execPath : 'python3';
}

/**
 * Build the argv for the isolating wrapper (pure, for tests):
 *   timeout --signal=KILL <wall>s unshare --net --fork --
 *     prlimit --cpu=<sec> --as=<bytes> -- <interp> <scriptPath>
 */
export function buildSubprocessArgs(
  lang: SandboxLanguage,
  scriptPath: string,
  limits: SandboxLimits,
): { cmd: string; args: string[]; wallMs: number } {
  const cpuSec = Math.max(1, Math.ceil(limits.cpuMs / 1000));
  const wallSec = cpuSec + 3; // wall-clock backstop for sleeps/blocking
  const memMb = Math.max(16, limits.memMb);
  const memBytes = memMb * 1024 * 1024;

  const args = [
    `--signal=KILL`,
    `${wallSec}s`,
    'unshare',
    // Network is always denied for code_exec; allowlist egress is not supported
    // by this adapter (use a proxy + DockerSandbox in production).
    '--net',
    '--fork',
    '--',
    'prlimit',
    `--cpu=${cpuSec}`,
  ];

  // Memory ceiling differs by runtime: RLIMIT_AS (address space) works for
  // CPython, but V8 reserves a large virtual address space at startup, so Node
  // is capped via --max-old-space-size (heap) instead.
  if (lang === 'python') {
    args.push(`--as=${memBytes}`, '--', interpreter(lang), scriptPath);
  } else {
    args.push('--', interpreter(lang), `--max-old-space-size=${memMb}`, scriptPath);
  }

  return { cmd: 'timeout', args, wallMs: wallSec * 1000 };
}

export class SubprocessSandbox implements Sandbox {
  async run(req: SandboxRequest): Promise<SandboxResult> {
    if (process.platform !== 'linux') {
      throw new Error('SubprocessSandbox requires Linux (namespaces + rlimits)');
    }
    const dir = await mkdtemp(join(tmpdir(), 'agentos-sbx-'));
    const scriptPath = join(dir, FILENAME[req.language]);
    try {
      await writeFile(scriptPath, req.source, 'utf8');
      const { cmd, args, wallMs } = buildSubprocessArgs(req.language, scriptPath, req.limits);
      return await this.exec(cmd, args, wallMs, dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private exec(
    cmd: string,
    args: string[],
    wallMs: number,
    cwd: string,
  ): Promise<SandboxResult> {
    return new Promise((resolve) => {
      const child = spawn(cmd, args, { cwd, env: { PATH: process.env.PATH ?? '' } });
      let stdout = '';
      let stderr = '';
      const cap = 64 * 1024; // cap captured output
      child.stdout.on('data', (d) => {
        if (stdout.length < cap) stdout += d.toString();
      });
      child.stderr.on('data', (d) => {
        if (stderr.length < cap) stderr += d.toString();
      });
      child.on('error', (err) => {
        resolve({ stdout, stderr: `${stderr}${err.message}`, exitCode: null, timedOut: false });
      });
      child.on('close', (code, signal) => {
        // `timeout` exits 124 when it had to kill the child (wall-clock breach).
        const timedOut = code === 124 || signal === 'SIGKILL';
        resolve({ stdout, stderr, exitCode: code, timedOut });
      });
    });
  }
}
