// F2 "real model" smoke: exercises the live Anthropic provider. Skipped unless
// ANTHROPIC_API_KEY is set, so it stays out of the default + DB integration runs.
//
//   ANTHROPIC_API_KEY=sk-... npm run test:integration

import { AnthropicModelProvider } from '../../src/adapters/model.anthropic';

const describeIf = process.env.ANTHROPIC_API_KEY ? describe : describe.skip;

describeIf('F2 — live Anthropic model', () => {
  it('returns a completion with token usage', async () => {
    const model = new AnthropicModelProvider({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      maxTokens: 64,
    });
    const turn = await model.complete({
      system: 'Reply with exactly the word: ok',
      messages: [{ role: 'user', content: 'Go.' }],
      tools: [],
    });
    expect(typeof turn.text).toBe('string');
    expect((turn.text ?? '').length).toBeGreaterThan(0);
    expect(turn.tokensIn).toBeGreaterThan(0);
    expect(turn.tokensOut).toBeGreaterThan(0);
  });
});
