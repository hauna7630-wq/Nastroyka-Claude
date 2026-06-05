// Sandbox port (F3): the security boundary for tool code execution.
//
// A Sandbox runs untrusted code under the tool's security profile — deny-by-default
// network, CPU/wall + memory ceilings, no filesystem persistence. Adapters:
//   - SubprocessSandbox: Linux namespaces (unshare --net) + rlimits (prlimit).
//   - DockerSandbox: an ephemeral, network-isolated, read-only container.
//   - DisabledSandbox: refuses to run (the safe default when no isolate exists).

export type SandboxLanguage = 'python' | 'node';

export interface SandboxLimits {
  cpuMs: number;
  memMb: number;
  network: 'deny' | 'allowlist';
}

export interface SandboxRequest {
  language: SandboxLanguage;
  source: string;
  limits: SandboxLimits;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export interface Sandbox {
  run(req: SandboxRequest): Promise<SandboxResult>;
}

export class SandboxDisabledError extends Error {
  constructor() {
    super('code execution sandbox is not enabled');
    this.name = 'SandboxDisabledError';
  }
}

// Safe default: no isolate configured, so refuse rather than run in-process.
export class DisabledSandbox implements Sandbox {
  async run(): Promise<SandboxResult> {
    throw new SandboxDisabledError();
  }
}
