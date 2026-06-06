import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { InMemoryQueue } from '../src/adapters/queue.inMemory';
import { InMemoryEventBus } from '../src/events/bus';
import { ToolRegistry } from '../src/tools/registry';
import { startWorker } from '../src/worker/worker';
import { ScriptedModelProvider, finalTurn } from '../src/adapters/model.mock';
import { ModelProvider } from '../src/ports/model';
import { ModelTurn, Agent, AgentType, Org, Run } from '../src/domain/types';
import { estimateComplexity, shouldOrchestrate } from '../src/orchestrator/complexity';
import {
  StaticPlanner,
  ModelPlanner,
  Planner,
  normalizePlan,
  topoSort,
  InvalidPlanError,
} from '../src/orchestrator/planner';

const ORG: Org = { id: 'org_1', name: 'Acme' };

function agent(id: string, type: AgentType): Agent {
  return { id, orgId: 'org_1', name: id, type, systemPrompt: `${type} prompt` };
}

// Returns the most recent user message as the "answer" — lets us assert that
// dependency context is threaded into dependent subtasks.
class EchoModel implements ModelProvider {
  async complete(args: { messages: { role: string; content: string }[] }): Promise<ModelTurn> {
    const lastUser = [...args.messages].reverse().find((m) => m.role === 'user');
    return { ...finalTurn(`echo:${lastUser?.content ?? ''}`) };
  }
}

// Throws on the Nth complete() call exactly once, then behaves like EchoModel.
class FailOnceAtNthModel implements ModelProvider {
  private calls = 0;
  private failed = false;
  constructor(private readonly n: number) {}
  async complete(args: { messages: { role: string; content: string }[] }): Promise<ModelTurn> {
    this.calls += 1;
    if (this.calls === this.n && !this.failed) {
      this.failed = true;
      throw new Error('transient subtask failure');
    }
    const lastUser = [...args.messages].reverse().find((m) => m.role === 'user');
    return { ...finalTurn(`echo:${lastUser?.content ?? ''}`) };
  }
}

async function setup(opts: {
  model: ModelProvider;
  planner: Planner;
  agents: Agent[];
  task: string;
  maxAttempts?: number;
}) {
  const repo = new InMemoryRepository();
  repo.seedOrg({ ...ORG });
  for (const a of opts.agents) repo.seedAgent(a);
  const parent: Run = {
    id: 'parent_1',
    orgId: 'org_1',
    agentId: 'orch_1',
    status: 'queued',
    input: { prompt: opts.task },

    attempts: 0,
  };
  await repo.createRun(parent);

  const events = new InMemoryEventBus();
  const queue = new InMemoryQueue({ maxAttempts: opts.maxAttempts ?? 3 });
  startWorker({
    queue,
    repo,
    model: opts.model,
    tools: new ToolRegistry(),
    allowlistDomains: [],
    events,
    planner: opts.planner,
    complexityThreshold: 5,
    defaultAgentType: 'researcher',
  });
  return { repo, queue, events };
}

describe('complexity gating', () => {
  it('scores simple tasks below and multi-step tasks above the threshold', () => {
    expect(shouldOrchestrate('Summarize.')).toBe(false);
    expect(
      shouldOrchestrate('Research the market and then analyze competitors and finally write a report.'),
    ).toBe(true);
    expect(estimateComplexity('')).toBe(0);
  });
});

describe('planner', () => {
  it('normalizes and validates plans, rejecting bad agent types and cycles', () => {
    const plan = normalizePlan({
      subtasks: [
        { id: 'a', agentType: 'researcher', prompt: 'x' },
        { id: 'b', agentType: 'writer', prompt: 'y', dependsOn: ['a'] },
      ],
    });
    expect(topoSort(plan.subtasks).map((s) => s.id)).toEqual(['a', 'b']);

    expect(() => normalizePlan({ subtasks: [{ id: 'a', agentType: 'wizard', prompt: 'x' }] })).toThrow(
      InvalidPlanError,
    );
    expect(() =>
      topoSort([
        { id: 'a', agentType: 'researcher', prompt: '', dependsOn: ['b'] },
        { id: 'b', agentType: 'writer', prompt: '', dependsOn: ['a'] },
      ]),
    ).toThrow(/cycle/);
  });

  it('ModelPlanner parses a JSON plan from the model (mock provider)', async () => {
    const json = JSON.stringify({
      subtasks: [{ id: 's1', agentType: 'analyst', prompt: 'analyze', dependsOn: [] }],
    });
    const planner = new ModelPlanner(new ScriptedModelProvider([finalTurn(json)]));
    const plan = await planner.plan({ task: 'whatever' });
    expect(plan.subtasks[0]).toMatchObject({ id: 's1', agentType: 'analyst' });
  });
});

describe('orchestrator (end-to-end)', () => {
  it('takes the single-agent fast path for a simple task', async () => {
    const { repo, queue } = await setup({
      model: new EchoModel(),
      planner: new StaticPlanner({ subtasks: [{ id: 'x', agentType: 'writer', prompt: 'unused', dependsOn: [] }] }),
      agents: [agent('orch_1', 'orchestrator'), agent('res_1', 'researcher')],
      task: 'Summarize.',
    });
    await queue.enqueue({ runId: 'parent_1' });

    const parent = await repo.getRun('parent_1');
    expect(parent?.status).toBe('succeeded');

    const children = await repo.listChildRuns('parent_1');
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe('parent_1::single');
    expect((await repo.getRun('parent_1::single'))?.status).toBe('succeeded');
    expect(repo.auditLog.some((a) => a.action === 'orchestration.single_agent')).toBe(true);
  });

  it('decomposes a complex task into typed-agent subtasks executed in order', async () => {
    const plan = {
      subtasks: [
        { id: 'r', agentType: 'researcher' as AgentType, prompt: 'research', dependsOn: [] },
        { id: 'a', agentType: 'analyst' as AgentType, prompt: 'analyze', dependsOn: ['r'] },
        { id: 'w', agentType: 'writer' as AgentType, prompt: 'write', dependsOn: ['a'] },
      ],
    };
    const { repo, queue, events } = await setup({
      model: new EchoModel(),
      planner: new StaticPlanner(plan),
      agents: [
        agent('orch_1', 'orchestrator'),
        agent('res_1', 'researcher'),
        agent('ana_1', 'analyst'),
        agent('wri_1', 'writer'),
      ],
      task: 'Research the market and then analyze competitors and finally write a report.',
    });
    // Coordinator graph: capture per-subtask lifecycle events on the parent stream.
    const subtaskEvents: { subtaskId: string; status: string }[] = [];
    events.subscribe('parent_1', (e) => {
      if (e.type === 'orchestration.subtask') subtaskEvents.push(e.data as any);
    });
    await queue.enqueue({ runId: 'parent_1' });

    const parent = await repo.getRun('parent_1');
    expect(parent?.status).toBe('succeeded');

    const children = await repo.listChildRuns('parent_1');
    expect(children.map((c) => c.id).sort()).toEqual([
      'parent_1::a',
      'parent_1::r',
      'parent_1::w',
    ]);
    // Each child was assigned to the correctly-typed agent.
    expect((await repo.getRun('parent_1::r'))?.agentId).toBe('res_1');
    expect((await repo.getRun('parent_1::a'))?.agentId).toBe('ana_1');
    expect((await repo.getRun('parent_1::w'))?.agentId).toBe('wri_1');

    // Dependency context is threaded into dependents.
    const analystInput = (await repo.getRun('parent_1::a'))?.input as { prompt: string };
    expect(analystInput.prompt).toContain('Context from prior subtasks');

    // Aggregation of the three subtask outputs.
    const out = parent?.output as { summary: unknown; subtasks: Record<string, unknown> };
    expect(Object.keys(out.subtasks).sort()).toEqual(['a', 'r', 'w']);

    // Live graph: each subtask emitted running then succeeded.
    const succeeded = subtaskEvents.filter((e) => e.status === 'succeeded').map((e) => e.subtaskId);
    expect(succeeded.sort()).toEqual(['a', 'r', 'w']);
    expect(subtaskEvents.filter((e) => e.status === 'running')).toHaveLength(3);
  });

  it('retries the orchestration without re-billing already-succeeded subtasks', async () => {
    const plan = {
      subtasks: [
        { id: 'r', agentType: 'researcher' as AgentType, prompt: 'research', dependsOn: [] },
        { id: 'a', agentType: 'analyst' as AgentType, prompt: 'analyze', dependsOn: ['r'] },
        { id: 'w', agentType: 'writer' as AgentType, prompt: 'write', dependsOn: ['a'] },
      ],
    };
    // Fail on the 3rd model call (the writer subtask) the first time it runs.
    const { repo, queue } = await setup({
      model: new FailOnceAtNthModel(3),
      planner: new StaticPlanner(plan),
      agents: [
        agent('orch_1', 'orchestrator'),
        agent('res_1', 'researcher'),
        agent('ana_1', 'analyst'),
        agent('wri_1', 'writer'),
      ],
      task: 'Research and then analyze and then write, also review and finally ship.',
      maxAttempts: 3,
    });
    await queue.enqueue({ runId: 'parent_1' });

    const parent = await repo.getRun('parent_1');
    expect(parent?.status).toBe('succeeded');
    expect(parent?.attempts).toBe(2); // failed once at the writer, then recovered

    // Already-succeeded subtasks are not re-run on retry (terminal -> no-op).
    expect((await repo.getRun('parent_1::r'))?.status).toBe('succeeded');
    expect((await repo.getRun('parent_1::a'))?.status).toBe('succeeded');
    expect((await repo.getRun('parent_1::w'))?.status).toBe('succeeded');
  });
});
