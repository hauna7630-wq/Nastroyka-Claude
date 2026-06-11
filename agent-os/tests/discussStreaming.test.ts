import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { InMemoryEventBus, RunEvent } from '../src/events/bus';
import { ToolRegistry } from '../src/tools/registry';
import { executeOrchestration } from '../src/orchestrator/orchestrator';
import { StaticPlanner } from '../src/orchestrator/planner';
import { ModelProvider, ModelMessage, ToolSchema } from '../src/ports/model';
import { ModelTurn, Agent, Org } from '../src/domain/types';

const ORG: Org = { id: 'o', name: 'Acme' };
function agent(id: string, type: any): Agent {
  return { id, orgId: 'o', name: id, type, systemPrompt: 'p' };
}

// Streams its answer in chunks, then returns the joined text.
class StreamingModel implements ModelProvider {
  constructor(private readonly chunks: string[]) {}
  async complete(args: {
    system: string;
    messages: ModelMessage[];
    tools: ToolSchema[];
    onText?: (d: string) => void;
  }): Promise<ModelTurn> {
    for (const c of this.chunks) args.onText?.(c);
    return { text: this.chunks.join(''), toolCalls: [], tokensIn: 1, tokensOut: 1 };
  }
}

describe('team-discussion token bridge', () => {
  it('re-emits child run.token under the parent runId, tagged with subtaskId', async () => {
    const repo = new InMemoryRepository();
    repo.seedOrg({ ...ORG });
    repo.seedAgent(agent('orch_1', 'orchestrator'));
    repo.seedAgent(agent('res_1', 'researcher'));
    await repo.createRun({
      id: 'parent_1', orgId: 'o', agentId: 'orch_1', status: 'queued',
      input: { prompt: 'Глубоко исследуй рынок и собери факты' }, attempts: 0,
    });

    const events = new InMemoryEventBus();
    const parentTokens: Array<{ text: string; subtaskId?: string; agentName?: string }> = [];
    events.subscribe('parent_1', (e: RunEvent) => {
      if (e.type === 'run.token') parentTokens.push(e.data as any);
    });

    await executeOrchestration('parent_1', {
      repo,
      model: new StreamingModel(['Иссле', 'дую ', 'рынок']),
      tools: new ToolRegistry(),
      allowlistDomains: [],
      events,
      planner: new StaticPlanner({
        subtasks: [{ id: 'research', agentType: 'researcher', prompt: 'go', dependsOn: [] }],
      }),
      complexityThreshold: 1,
      defaultAgentType: 'researcher',
    } as any);

    // Tokens arrived on the PARENT stream, every one tagged with the subtask id.
    expect(parentTokens.length).toBeGreaterThan(0);
    expect(parentTokens.every((t) => t.subtaskId === 'research')).toBe(true);
    expect(parentTokens.every((t) => t.agentName === 'res_1')).toBe(true);
    expect(parentTokens.map((t) => t.text).join('')).toBe('Исследую рынок');

    const parent = await repo.getRun('parent_1');
    expect(parent?.status).toBe('succeeded');
  });
});
