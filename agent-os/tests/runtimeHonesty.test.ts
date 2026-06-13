import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { InMemoryQueue } from '../src/adapters/queue.inMemory';
import { InMemoryEventBus } from '../src/events/bus';
import { ToolRegistry } from '../src/tools/registry';
import { startWorker } from '../src/worker/worker';
import { finalTurn } from '../src/adapters/model.mock';
import { ModelProvider } from '../src/ports/model';
import { ModelTurn, Agent, Org } from '../src/domain/types';
import { StaticPlanner } from '../src/orchestrator/planner';
import { ControlPlane } from '../src/api/controlPlane';
import { Observability } from '../src/observability/metrics';

const ORG: Org = { id: 'o', name: 'Acme' };
const AGENT: Agent = { id: 'a', orgId: 'o', name: 'A', type: 'researcher', systemPrompt: 'sys' };

class ConstModel implements ModelProvider {
  constructor(private readonly text: string) {}
  async complete(): Promise<ModelTurn> {
    return { ...finalTurn(this.text) };
  }
}

function build(model: ModelProvider, maxAttempts = 2) {
  const repo = new InMemoryRepository();
  repo.seedOrg({ ...ORG });
  repo.seedAgent({ ...AGENT });
  const events = new InMemoryEventBus();
  const queue = new InMemoryQueue({ maxAttempts });
  startWorker({
    queue, repo, model, tools: new ToolRegistry(), allowlistDomains: [], events,
    planner: new StaticPlanner({ subtasks: [{ id: 's', agentType: 'researcher', prompt: 'x', dependsOn: [] }] }),
    complexityThreshold: 999, defaultAgentType: 'researcher',
  });
  const cp = new ControlPlane({ repo, queue, observability: new Observability(repo), events });
  return { repo, queue, cp };
}

describe('runtime degradation guard', () => {
  it('FAILS a run whose final answer is empty (no silent empty success)', async () => {
    const { repo, queue } = build(new ConstModel(''));
    await queue.enqueue({ runId: await create(repo) });
    const run = await repo.getRun('r1');
    expect(run?.status).toBe('failed');
    expect(run?.error).toMatch(/пустой ответ/);
    expect((await repo.listDeadLetters()).some((d) => d.runId === 'r1')).toBe(true);
  });

  it('FAILS a placeholder "…" answer', async () => {
    const { repo, queue } = build(new ConstModel('…'));
    await queue.enqueue({ runId: await create(repo) });
    expect((await repo.getRun('r1'))?.status).toBe('failed');
  });

  it('still succeeds on real text and records the prompt preview on step 0', async () => {
    const { repo, queue } = build(new ConstModel('настоящий ответ'));
    await queue.enqueue({ runId: await create(repo) });
    const run = await repo.getRun('r1');
    expect(run?.status).toBe('succeeded');
    expect(run?.output).toBe('настоящий ответ');
    const steps = await repo.listSteps('r1');
    const first = steps.find((s) => s.role === 'assistant');
    expect((first?.input as { system?: string })?.system).toBeDefined();
  });
});

async function create(repo: InMemoryRepository): Promise<string> {
  await repo.createRun({ id: 'r1', orgId: 'o', agentId: 'a', status: 'queued', input: { prompt: 'hi' }, attempts: 0 });
  return 'r1';
}
