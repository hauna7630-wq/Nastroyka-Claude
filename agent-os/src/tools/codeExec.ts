// code_exec tool (F3). Executes code inside the configured Sandbox, enforcing the
// security profile below. With no sandbox in the ToolContext, it refuses to run
// (deny-by-default) rather than executing code in-process.

import { ToolSpec } from './registry';
import { SandboxLanguage } from '../ports/sandbox';

export const codeExecTool: ToolSpec = {
  schema: {
    name: 'code_exec',
    description:
      'Execute a short program in an isolated sandbox (no network, CPU/memory limited). Returns stdout/stderr/exitCode.',
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
    // Deny-by-default network, hard CPU/memory ceilings, no FS persistence.
    // Enforced by the Sandbox adapter (namespaces+rlimits or a container).
    network: 'deny',
    cpuMs: 5_000,
    memMb: 256,
    persistFs: false,
  },
  async run(input, ctx) {
    if (!ctx.sandbox) {
      throw new Error('code_exec is disabled: no execution sandbox configured');
    }
    const language = input.language as SandboxLanguage;
    if (language !== 'python' && language !== 'node') {
      throw new Error(`code_exec: unsupported language "${String(input.language)}"`);
    }
    const result = await ctx.sandbox.run({
      language,
      source: String(input.source ?? ''),
      limits: {
        cpuMs: codeExecTool.security.cpuMs,
        memMb: codeExecTool.security.memMb,
        network: codeExecTool.security.network,
      },
    });
    return result;
  },
};
