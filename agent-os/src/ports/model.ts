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
  }): Promise<ModelTurn>;
}

export type { ModelTurn, ToolCall };
