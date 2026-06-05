// code_exec tool — stubbed in the MVP.
//
// Arbitrary code execution requires a real sandbox (isolated process / gVisor /
// Firecracker microVM) honoring the security profile below. Until that exists,
// the tool refuses to run rather than executing code in-process.

import { ToolSpec } from './registry';

export const codeExecTool: ToolSpec = {
  schema: {
    name: 'code_exec',
    description:
      '(Disabled in MVP) Execute code in an isolated sandbox. Returns stdout/stderr.',
    inputSchema: {
      type: 'object',
      properties: {
        language: { type: 'string', enum: ['python', 'node'] },
        source: { type: 'string' },
      },
      required: ['language', 'source'],
    },
  },
  security: {
    // Deny-by-default network, hard CPU/memory ceilings, no FS persistence
    // except declared artifacts. Enforced by the sandbox in production.
    network: 'deny',
    cpuMs: 10_000,
    memMb: 256,
    persistFs: false,
  },
  async run() {
    throw new Error(
      'code_exec is not enabled in the MVP: requires an isolated execution sandbox.',
    );
  },
};
