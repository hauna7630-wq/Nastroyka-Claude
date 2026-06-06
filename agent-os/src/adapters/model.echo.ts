// Offline echo model for the dev Coordinator: returns a final answer (no tools)
// after a small delay so the live "assembly graph" is visibly animated.

import { ModelMessage, ModelProvider } from '../ports/model';
import { ModelTurn } from '../domain/types';

export class DelayedEchoModel implements ModelProvider {
  constructor(private readonly delayMs = 700) {}

  async complete(args: { messages: ModelMessage[] }): Promise<ModelTurn> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    const lastUser = [...args.messages].reverse().find((m) => m.role === 'user');
    const content = lastUser?.content ?? '';
    const text = content.length > 140 ? `${content.slice(0, 140)}…` : content;
    return { text: `✓ ${text}`, toolCalls: [], tokensIn: 20, tokensOut: 12, model: 'echo-dev' };
  }
}
