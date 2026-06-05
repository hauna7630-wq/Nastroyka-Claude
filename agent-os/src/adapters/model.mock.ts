// Deterministic model provider for tests/dev.
//
// `ScriptedModelProvider` replays a fixed list of turns: the Nth `complete()`
// call (counted by how many tool results are already in the conversation)
// returns the Nth scripted turn. This makes the tool-use loop fully reproducible
// and lets the ledger idempotency assertions hold across retries.

import { ModelMessage, ModelProvider } from '../ports/model';
import { ModelTurn } from '../domain/types';

export class ScriptedModelProvider implements ModelProvider {
  constructor(private readonly turns: ModelTurn[]) {
    if (turns.length === 0) throw new Error('ScriptedModelProvider needs >= 1 turn');
  }

  async complete(args: { messages: ModelMessage[] }): Promise<ModelTurn> {
    const completed = args.messages.filter((m) => m.role === 'tool').length;
    const idx = Math.min(completed, this.turns.length - 1);
    return this.turns[idx];
  }
}

// Convenience builders for common scripted turns.
export function toolCallTurn(
  name: string,
  input: Record<string, unknown>,
  id = 'call_1',
): ModelTurn {
  return {
    text: `Calling ${name}`,
    toolCalls: [{ id, name, input }],
    tokensIn: 20,
    tokensOut: 8,
  };
}

export function finalTurn(text: string): ModelTurn {
  return { text, toolCalls: [], tokensIn: 10, tokensOut: 5 };
}

// Always-throwing provider for exercising retry + DLQ paths.
export class FailingModelProvider implements ModelProvider {
  constructor(private readonly message = 'model unavailable') {}
  async complete(): Promise<ModelTurn> {
    throw new Error(this.message);
  }
}
