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
import {
  buildTeamReport,
  reviewPrompt,
  revisionPrompt,
  verdictNeedsRework,
} from '../src/orchestrator/orchestrator';

const ORG: Org = { id: 'org_1', name: 'Acme' };

function parentOut(run: { output?: unknown } | null): {
  summary: unknown;
  contributions: { subtaskId: string; failed?: boolean }[];
  report: string;
} {
  return run?.output as {
    summary: unknown;
    contributions: { subtaskId: string; failed?: boolean }[];
    report: string;
  };
}
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
  asyncChildren?: boolean;
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
    asyncChildren: opts.asyncChildren,
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

describe('team report', () => {
  it('renders an attributed write-up with a synthesis and per-agent sections', () => {
    const report = buildTeamReport('задача', [
      { subtaskId: 'r', agentType: 'researcher', agentName: 'Iskara', output: 'нашла данные' },
      { subtaskId: 'w', agentType: 'writer', agentName: 'Slovena', output: 'итоговый текст' },
    ]);
    expect(report).toContain('## Ответ команды');
    expect(report).toContain('итоговый текст'); // synthesis = last contribution
    expect(report).toContain('Iskara · Исследователь');
    expect(report).toContain('Slovena · Райтер');
  });

  it('omits the contributors section for a single-agent result', () => {
    const report = buildTeamReport('задача', [
      { subtaskId: 's', agentType: 'analyst', agentName: 'Analita', output: 'ответ' },
    ]);
    expect(report).toContain('## Ответ команды');
    expect(report).not.toContain('Вклад участников');
  });

  it('appends a reviewer critique section when a review is provided', () => {
    const report = buildTeamReport(
      'задача',
      [
        { subtaskId: 'r', agentType: 'researcher', agentName: 'Iskara', output: 'данные' },
        { subtaskId: 'w', agentType: 'writer', agentName: 'Slovena', output: 'текст' },
      ],
      { subtaskId: 'review', agentType: 'reviewer', agentName: 'Revisa', output: 'Готово к выпуску' },
    );
    expect(report).toContain('Ревью · Revisa');
    expect(report).toContain('Готово к выпуску');
  });

  it('reviewPrompt lists every contributor and asks for a verdict', () => {
    const p = reviewPrompt('задача', [
      { subtaskId: 'r', agentType: 'researcher', agentName: 'Iskara', output: 'данные' },
    ]);
    expect(p).toContain('Исходная задача: задача');
    expect(p).toContain('Iskara (Исследователь)');
    expect(p).toContain('вердикт');
  });

  it('verdictNeedsRework triggers only on an unambiguous rework verdict', () => {
    expect(verdictNeedsRework('Нужны доработки: добавить источники')).toBe(true);
    expect(verdictNeedsRework('Готово к выпуску')).toBe(false);
    // Ambiguous (quotes both phrases, e.g. an echoed instruction) ships as-is.
    expect(verdictNeedsRework('«Готово к выпуску» или «Нужны доработки: …»')).toBe(false);
    expect(verdictNeedsRework(undefined)).toBe(false);
  });

  it('revisionPrompt carries the task, the draft, and the critique', () => {
    const p = revisionPrompt('задача', 'черновик', 'Нужны доработки: мало данных');
    expect(p).toContain('Исходная задача: задача');
    expect(p).toContain('черновик');
    expect(p).toContain('мало данных');
    expect(p).toContain('Доработай');
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

  it('falls back to the single-agent path when the planner returns garbage', async () => {
    class BrokenPlanner implements Planner {
      async plan(): Promise<never> {
        throw new Error('Invalid orchestration plan: no JSON object found in model output');
      }
    }
    const { repo, queue } = await setup({
      model: new EchoModel(),
      planner: new BrokenPlanner(),
      agents: [agent('orch_1', 'orchestrator'), agent('res_1', 'researcher')],
      task: 'Research the market and then analyze competitors and finally write a report.',
    });
    await queue.enqueue({ runId: 'parent_1' });

    // The run SUCCEEDS via the single-agent fallback instead of failing.
    expect((await repo.getRun('parent_1'))?.status).toBe('succeeded');
    expect((await repo.getRun('parent_1::single'))?.status).toBe('succeeded');
    expect(repo.auditLog.some((a) => a.action === 'orchestration.plan_fallback')).toBe(true);
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
    const out = parent?.output as {
      summary: unknown;
      subtasks: Record<string, unknown>;
      report: string;
      contributions: { agentName: string; agentType: string }[];
    };
    expect(Object.keys(out.subtasks).sort()).toEqual(['a', 'r', 'w']);
    // Structured team report (Doc-2): attributed, readable, names every contributor.
    expect(out.report).toContain('Ответ команды');
    expect(out.report).toContain('Вклад участников');
    expect(out.contributions.map((c) => c.agentName)).toEqual(['res_1', 'ana_1', 'wri_1']);

    // Live graph: each subtask emitted running then succeeded.
    const succeeded = subtaskEvents.filter((e) => e.status === 'succeeded').map((e) => e.subtaskId);
    expect(succeeded.sort()).toEqual(['a', 'r', 'w']);
    expect(subtaskEvents.filter((e) => e.status === 'running')).toHaveLength(3);
  });

  it('runs a reviewer critique pass when a reviewer agent is available', async () => {
    const plan = {
      subtasks: [
        { id: 'r', agentType: 'researcher' as AgentType, prompt: 'research', dependsOn: [] },
        { id: 'w', agentType: 'writer' as AgentType, prompt: 'write', dependsOn: ['r'] },
      ],
    };
    const { repo, queue } = await setup({
      model: new EchoModel(),
      planner: new StaticPlanner(plan),
      agents: [
        agent('orch_1', 'orchestrator'),
        agent('res_1', 'researcher'),
        agent('wri_1', 'writer'),
        agent('rev_1', 'reviewer'),
      ],
      task: 'Research the market and then write a report about it in detail.',
    });
    await queue.enqueue({ runId: 'parent_1' });

    const parent = await repo.getRun('parent_1');
    expect(parent?.status).toBe('succeeded');
    // A deterministic review child ran and is attributed to the reviewer agent.
    const reviewRun = await repo.getRun('parent_1::review');
    expect(reviewRun?.status).toBe('succeeded');
    expect(reviewRun?.agentId).toBe('rev_1');
    // The report carries the reviewer section; contributions stay the 2 workers.
    const out = parent?.output as { report: string; contributions: unknown[]; review: unknown };
    expect(out.report).toContain('Ревью · rev_1');
    expect(out.contributions).toHaveLength(2);
    expect(out.review).toBeDefined();
  });

  // Always demands rework — the debate runs the full DEBATE_ROUNDS (default 2).
  class ReworkingModel implements ModelProvider {
    async complete(args: { messages: { role: string; content: string }[] }): Promise<ModelTurn> {
      const lastUser = [...args.messages].reverse().find((m) => m.role === 'user');
      const p = lastUser?.content ?? '';
      if (p.includes('вердикт')) return { ...finalTurn('Нужны доработки: добавь источники') };
      if (p.includes('Доработай')) return { ...finalTurn('финальная версия с источниками') };
      return { ...finalTurn(`echo:${p}`) };
    }
  }
  function debatePlan() {
    return {
      subtasks: [
        { id: 'r', agentType: 'researcher' as AgentType, prompt: 'research', dependsOn: [] },
        { id: 'w', agentType: 'writer' as AgentType, prompt: 'write', dependsOn: ['r'] },
      ],
    };
  }
  function debateAgents() {
    return [
      agent('orch_1', 'orchestrator'),
      agent('res_1', 'researcher'),
      agent('wri_1', 'writer'),
      agent('rev_1', 'reviewer'),
    ];
  }

  it('debates up to DEBATE_ROUNDS while the reviewer keeps demanding rework', async () => {
    const { repo, queue } = await setup({
      model: new ReworkingModel(),
      planner: new StaticPlanner(debatePlan()),
      agents: debateAgents(),
      task: 'Research the market and then write a report about it in detail.',
    });
    await queue.enqueue({ runId: 'parent_1' });

    expect((await repo.getRun('parent_1'))?.status).toBe('succeeded');
    // Two rounds: review→rev1→review2→rev2 (deterministic ids), all persisted.
    expect((await repo.getRun('parent_1::rev1'))?.agentId).toBe('wri_1');
    expect((await repo.getRun('parent_1::review2'))?.status).toBe('succeeded');
    expect((await repo.getRun('parent_1::rev2'))?.status).toBe('succeeded');
    const out = parentOut(await repo.getRun('parent_1'));
    expect(out.summary).toBe('финальная версия с источниками');
    expect(out.contributions.map((c) => c.subtaskId)).toEqual(['r', 'w', 'rev1', 'rev2']);
  });

  it('stops the debate early when the reviewer approves after a revision', async () => {
    // Approves on the SECOND review (after the first revision is produced).
    class ApproveAfterFirstFix implements ModelProvider {
      private reviews = 0;
      async complete(args: { messages: { role: string; content: string }[] }): Promise<ModelTurn> {
        const p = [...args.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
        if (p.includes('вердикт')) {
          this.reviews += 1;
          return { ...finalTurn(this.reviews >= 2 ? 'Готово к выпуску' : 'Нужны доработки: уточни') };
        }
        if (p.includes('Доработай')) return { ...finalTurn('исправленная версия') };
        return { ...finalTurn(`echo:${p}`) };
      }
    }
    const { repo, queue } = await setup({
      model: new ApproveAfterFirstFix(),
      planner: new StaticPlanner(debatePlan()),
      agents: debateAgents(),
      task: 'Research the market and then write a report about it in detail.',
    });
    await queue.enqueue({ runId: 'parent_1' });

    expect((await repo.getRun('parent_1'))?.status).toBe('succeeded');
    // review → rev1 → review2(approve) → STOP (no rev2).
    expect((await repo.getRun('parent_1::rev1'))?.status).toBe('succeeded');
    expect((await repo.getRun('parent_1::review2'))?.status).toBe('succeeded');
    expect(await repo.getRun('parent_1::rev2')).toBeNull();
    const out = parentOut(await repo.getRun('parent_1'));
    expect(out.summary).toBe('исправленная версия');
    expect(out.contributions.map((c) => c.subtaskId)).toEqual(['r', 'w', 'rev1']);
  });

  it('ships a partial result when one subtask fails, without losing the others', async () => {
    const plan = {
      subtasks: [
        { id: 'r', agentType: 'researcher' as AgentType, prompt: 'research', dependsOn: [] },
        { id: 'a', agentType: 'analyst' as AgentType, prompt: 'analyze', dependsOn: ['r'] },
        { id: 'w', agentType: 'writer' as AgentType, prompt: 'write', dependsOn: ['a'] },
      ],
    };
    // Fail on the 3rd model call (the writer subtask). Partial-failure tolerance:
    // the run must NOT be thrown away — it ships what r + a produced, with the
    // writer recorded as failed, so the user always sees a real result.
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
    expect(parent?.status).toBe('succeeded'); // partial result still ships
    expect(parent?.attempts).toBe(1); // no whole-run retry — shipped on the first pass

    // Upstream agents succeeded and are preserved; the writer is marked failed,
    // not silently dropped.
    expect((await repo.getRun('parent_1::r'))?.status).toBe('succeeded');
    expect((await repo.getRun('parent_1::a'))?.status).toBe('succeeded');
    expect((await repo.getRun('parent_1::w'))?.status).not.toBe('succeeded');
    const out = parentOut(await repo.getRun('parent_1'));
    expect(out.contributions.find((c) => c.subtaskId === 'w')?.failed).toBe(true);
    expect(out.contributions.some((c) => !c.failed)).toBe(true);
  });

  it('dispatches children via the queue + event bus when asyncChildren is set', async () => {
    const plan = {
      subtasks: [
        { id: 'r', agentType: 'researcher' as AgentType, prompt: 'research', dependsOn: [] },
        { id: 'a', agentType: 'analyst' as AgentType, prompt: 'analyze', dependsOn: ['r'] },
        { id: 'w', agentType: 'writer' as AgentType, prompt: 'write', dependsOn: ['a'] },
      ],
    };
    const { repo, queue } = await setup({
      model: new EchoModel(),
      planner: new StaticPlanner(plan),
      agents: [
        agent('orch_1', 'orchestrator'),
        agent('res_1', 'researcher'),
        agent('ana_1', 'analyst'),
        agent('wri_1', 'writer'),
      ],
      task: 'Research the market and then analyze competitors and finally write a report.',
      maxAttempts: 1,
      asyncChildren: true,
    });
    await queue.enqueue({ runId: 'parent_1' });

    expect((await repo.getRun('parent_1'))?.status).toBe('succeeded');
    expect((await repo.listChildRuns('parent_1')).map((c) => c.status)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded',
    ]);
  });
});
