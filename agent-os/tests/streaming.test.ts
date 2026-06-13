import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { InMemoryEventBus, RunEvent } from '../src/events/bus';
import { ToolRegistry } from '../src/tools/registry';
import { executeRun } from '../src/agent/runtime';
import { ModelProvider, ModelMessage, ToolSchema } from '../src/ports/model';
import { ModelTurn, Agent, Org } from '../src/domain/types';

const ORG: Org = { id: 'o', name: 'Acme' };
const AGENT: Agent = { id: 'a', orgId: 'o', name: 'A', type: 'researcher', systemPrompt: 'sys' };

// A model that streams its answer in chunks via onText, then returns the same
// text as the authoritative final turn (mirrors the subscription streaming path).
class StreamingModel implements ModelProvider {
  constructor(private readonly chunks: string[]) {}
  async complete(args: {
    system: string;
    messages: ModelMessage[];
    tools: ToolSchema[];
    onText?: (delta: string) => void;
  }): Promise<ModelTurn> {
    for (const c of this.chunks) args.onText?.(c);
    return { text: this.chunks.join(''), toolCalls: [], tokensIn: 1, tokensOut: 2 };
  }
}

function deps(model: ModelProvider, events: InMemoryEventBus) {
  const repo = new InMemoryRepository();
  repo.seedOrg({ ...ORG });
  repo.seedAgent({ ...AGENT });
  return { repo, model, tools: new ToolRegistry(), allowlistDomains: [], events };
}

describe('live token streaming', () => {
  it('emits run.token deltas for a chat run and reaches the same final answer', async () => {
    const events = new InMemoryEventBus();
    const tokens: string[] = [];
    events.subscribe('*', (e: RunEvent) => {
      if (e.type === 'run.token') tokens.push((e.data as { text: string }).text);
    });
    const d = deps(new StreamingModel(['Hello, ', 'world', '!']), events);
    await d.repo.createRun({
      id: 'r1', orgId: 'o', agentId: 'a', status: 'queued',
      input: { prompt: 'hi', chat: true }, attempts: 0,
    });
    await executeRun('r1', d as any);
    expect(tokens.join('')).toBe('Hello, world!');
    const run = await d.repo.getRun('r1');
    expect(run?.status).toBe('succeeded');
    expect(run?.output).toBe('Hello, world!');
  });

  it('does NOT emit run.token for a non-chat run', async () => {
    const events = new InMemoryEventBus();
    let count = 0;
    events.subscribe('*', (e: RunEvent) => { if (e.type === 'run.token') count++; });
    const d = deps(new StreamingModel(['a', 'b']), events);
    await d.repo.createRun({
      id: 'r2', orgId: 'o', agentId: 'a', status: 'queued',
      input: { prompt: 'hi' }, attempts: 0,
    });
    await executeRun('r2', d as any);
    expect(count).toBe(0);
    expect((await d.repo.getRun('r2'))?.output).toBe('ab');
  });
});
