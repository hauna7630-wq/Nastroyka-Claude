import { RegexPiiMasker } from '../src/security/pii';
import { ModelGateway, defaultRoute } from '../src/adapters/model.gateway';
import { ModelProvider } from '../src/ports/model';
import { ModelTurn } from '../src/domain/types';
import { finalTurn } from '../src/adapters/model.mock';

describe('PII masking (PRD §4)', () => {
  const masker = new RegexPiiMasker();
  it('masks emails/phones/cards and un-masks them back', () => {
    const map = new Map<string, string>();
    const masked = masker.mask('Contact john@acme.com or +7 999 123-45-67, card 4111 1111 1111 1111', map);
    expect(masked).toContain('[EMAIL_1]');
    expect(masked).toContain('[PHONE_1]');
    expect(masked).toContain('[CARD_1]');
    expect(masked).not.toContain('john@acme.com');
    expect(masker.unmask(masked, map)).toContain('john@acme.com');
    expect(masker.unmask(masked, map)).toContain('+7 999 123-45-67');
  });

  it('reuses a stable token for a repeated value', () => {
    const map = new Map<string, string>();
    const masked = masker.mask('a@x.io ... a@x.io', map);
    expect(masked).toBe('[EMAIL_1] ... [EMAIL_1]');
  });
});

describe('LLM Gateway (Stage 6: routing + failover)', () => {
  const provider = (name: string, fail = false): ModelProvider => ({
    async complete(): Promise<ModelTurn> {
      if (fail) throw new Error(`${name} down`);
      return { ...finalTurn(`from:${name}`), model: name };
    },
  });

  it('routes tool-less short requests to the fast model', async () => {
    const gw = new ModelGateway({
      providers: { primary: provider('primary'), fast: provider('fast') },
      route: defaultRoute,
      failover: ['primary'],
    });
    const turn = await gw.complete({ system: '', messages: [{ role: 'user', content: 'hi' }], tools: [] });
    expect(turn.model).toBe('fast');
  });

  it('routes tool requests to the primary model', async () => {
    const gw = new ModelGateway({
      providers: { primary: provider('primary'), fast: provider('fast') },
      route: defaultRoute,
      failover: ['fast'],
    });
    const turn = await gw.complete({
      system: '',
      messages: [{ role: 'user', content: 'do it' }],
      tools: [{ name: 't', description: '', inputSchema: {} }],
    });
    expect(turn.model).toBe('primary');
  });

  it('fails over when the primary provider errors', async () => {
    const gw = new ModelGateway({
      providers: { primary: provider('primary', true), local: provider('local') },
      route: () => 'primary',
      failover: ['local'],
    });
    const turn = await gw.complete({ system: '', messages: [{ role: 'user', content: 'x' }], tools: [] });
    expect(turn.model).toBe('local');
  });

  it('throws when every provider fails', async () => {
    const gw = new ModelGateway({
      providers: { a: provider('a', true), b: provider('b', true) },
      route: () => 'a',
      failover: ['b'],
    });
    await expect(gw.complete({ system: '', messages: [], tools: [] })).rejects.toThrow(/down/);
  });
});
