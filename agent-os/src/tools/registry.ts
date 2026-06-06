// Tool registry + security boundary metadata (review §2.3).
//
// Every tool declares a security profile. The runtime/sandbox uses these to
// enforce deny-by-default network, CPU/memory ceilings, and persistence rules.
// In the MVP the profile is advisory + the http allowlist is enforced; in
// production the worker runs tool bodies inside an isolate honoring these limits.

import { ToolSchema } from '../ports/model';
import { Sandbox } from '../ports/sandbox';
import { SearchProvider } from '../ports/search';
import { DocumentParser } from '../ports/documents';

export interface ToolSecurity {
  // Deny-by-default: tools must opt in to network access.
  network: 'deny' | 'allowlist';
  cpuMs: number; // max CPU time per call
  memMb: number; // max memory per call
  // No filesystem persistence except declared artifacts.
  persistFs: boolean;
}

export interface ToolContext {
  allowlistDomains: string[];
  // F3: the isolate used by code_exec. Absent => code execution is disabled.
  sandbox?: Sandbox;
  // PRD §3 integration tools (absent => the respective tool is disabled).
  search?: SearchProvider;
  documents?: DocumentParser;
}

export interface ToolSpec {
  schema: ToolSchema;
  security: ToolSecurity;
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

// Raised when an agent invokes a tool outside its per-agent allowlist (PRD M2).
export class ToolNotAllowedError extends Error {
  constructor(agentId: string, tool: string) {
    super(`Tool "${tool}" is not allowed for agent ${agentId}`);
    this.name = 'ToolNotAllowedError';
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolSpec>();

  register(spec: ToolSpec): void {
    this.tools.set(spec.schema.name, spec);
  }

  get(name: string): ToolSpec | undefined {
    return this.tools.get(name);
  }

  schemas(): ToolSchema[] {
    return [...this.tools.values()].map((t) => t.schema);
  }

  async run(
    name: string,
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<unknown> {
    const spec = this.tools.get(name);
    if (!spec) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return spec.run(input, ctx);
  }
}
