// LLM Gateway (PRD §1.1 / Stage 6): routes each request to a provider by rule and
// fails over primary -> secondary -> local. Implements the ModelProvider port, so
// the runtime is unchanged — it just gets handed a gateway instead of one model.

import { ModelProvider, ModelMessage, ToolSchema } from '../ports/model';
import { ModelTurn } from '../domain/types';

export interface RouteContext {
  system: string;
  messages: ModelMessage[];
  tools: ToolSchema[];
}

export interface GatewayConfig {
  providers: Record<string, ModelProvider>;
  // Returns the provider key to try first (e.g. by complexity/sensitivity).
  route: (ctx: RouteContext) => string;
  // Ordered fallback keys tried if the chosen provider errors.
  failover: string[];
}

export class ModelGateway implements ModelProvider {
  constructor(private readonly cfg: GatewayConfig) {}

  async complete(args: { system: string; messages: ModelMessage[]; tools: ToolSchema[] }): Promise<ModelTurn> {
    const primary = this.cfg.route(args);
    const order = [primary, ...this.cfg.failover.filter((k) => k !== primary)];

    let lastErr: unknown;
    for (const key of order) {
      const provider = this.cfg.providers[key];
      if (!provider) continue;
      try {
        return await provider.complete(args);
      } catch (err) {
        lastErr = err; // try the next provider in the failover chain
      }
    }
    throw lastErr ?? new Error('ModelGateway: no providers available');
  }
}

// A sensible default routing policy:
//   - requests that expose tools (agentic/coding) -> "primary" (Claude)
//   - short, tool-less requests (classification/routing) -> "fast"
//   - otherwise -> "primary"
export function defaultRoute(ctx: RouteContext): string {
  if (ctx.tools.length > 0) return 'primary';
  const chars = ctx.messages.reduce((n, m) => n + m.content.length, 0);
  return chars < 280 ? 'fast' : 'primary';
}
