// Model provider port — abstracts the LLM behind the tool-use loop.
// Production: Anthropic (latest Claude). Tests: deterministic mock.

import { ModelTurn, ToolCall } from '../domain/types';

export interface ToolSchema {
  name: string;
  description: string;
  // JSON Schema for the tool input.
  inputSchema: Record<string, unknown>;
}

export interface ModelMessage {
  role: 'user' | 'assistant' | 'tool';
  // For 'tool' role: the result of a prior tool call.
  toolCallId?: string;
  content: string;
}

export interface ModelProvider {
  /**
   * Given the conversation so far and the available tools, return the model's
   * next turn (optional final text + zero or more tool calls + token usage).
   */
  complete(args: {
    system: string;
    messages: ModelMessage[];
    tools: ToolSchema[];
    // Optional live-token callback. Providers that support streaming call this
    // with incremental text deltas as they arrive (best-effort, UX only). The
    // authoritative final text is always the resolved ModelTurn.text — callers
    // must never treat the streamed deltas as the source of truth. Providers
    // that don't stream simply ignore this.
    onText?: (delta: string) => void;
    // Optional capability hints derived from the agent (e.g. allowedTools).
    // The subscription provider uses `webSearch` to allow the Claude CLI's
    // built-in WebSearch/WebFetch tools only for agents permitted to search.
    // Providers that don't support a capability simply ignore it.
    capabilities?: { webSearch?: boolean; codeExec?: boolean };
    // Persistent working directory for tool execution (the CLI runs with this as
    // cwd). Gives a code-capable agent a stable workspace whose files survive
    // across turns. Providers without local tool execution ignore it.
    workspace?: string;
  }): Promise<ModelTurn>;
}

export type { ModelTurn, ToolCall };
