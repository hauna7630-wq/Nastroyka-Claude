// Docker sandbox (F3, production-grade). Runs code in an ephemeral container that
// enforces the security profile via container flags. Stronger isolation than the
// subprocess adapter (separate kernel view, cgroups, no host fs).
//
// Not exercised in this environment (image pulls are blocked by the network
// policy); buildDockerArgs is unit-tested, and there's a gated live integration
// test for when an image is available.

import { spawn } from 'child_process';
import {
  Sandbox,
  SandboxLanguage,
  SandboxLimits,
  SandboxRequest,
  SandboxResult,
} from '../ports/sandbox';

const IMAGE: Record<SandboxLanguage, string> = {
  python: 'python:3.12-slim',
  node: 'node:22-slim',
};

const RUN: Record<SandboxLanguage, string[]> = {
  python: ['python3', '-c'],
  node: ['node', '-e'],
};

/**
 * Build `docker run` argv (pure, for tests). Enforces:
 *   --network none      deny-by-default egress
 *   --memory            memory ceiling
 *   --cpus              CPU ceiling
 *   --pids-limit        fork-bomb guard
 *   --read-only + tmpfs no fs persistence (writable scratch only in /tmp)
 *   --rm                ephemeral
 *   --user 65534        non-root (nobody)
 */
export function buildDockerArgs(
  lang: SandboxLanguage,
  source: string,
  limits: SandboxLimits,
): string[] {
  const cpus = Math.max(0.1, limits.cpuMs / 1000 / 10).toFixed(2); // modest CPU share
  return [
    'run',
    '--rm',
    '--network',
    limits.network === 'deny' ? 'none' : 'none', // code_exec is always deny
    '--memory',
    `${Math.max(16, limits.memMb)}m`,
    '--cpus',
    cpus,
    '--pids-limit',
    '128',
    '--read-only',
    '--tmpfs',
    '/tmp:size=16m',
    '--user',
    '65534:65534',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    IMAGE[lang],
    ...RUN[lang],
    source,
  ];
}

export class DockerSandbox implements Sandbox {
  constructor(private readonly dockerPath = 'docker') {}

  run(req: SandboxRequest): Promise<SandboxResult> {
    const args = buildDockerArgs(req.language, req.source, req.limits);
    const wallMs = Math.max(1000, req.limits.cpuMs) + 5000;
    return new Promise((resolve) => {
      const child = spawn(this.dockerPath, args);
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => child.kill('SIGKILL'), wallMs);
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ stdout, stderr: `${stderr}${err.message}`, exitCode: null, timedOut: false });
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code, timedOut: signal === 'SIGKILL' });
      });
    });
  }
}
