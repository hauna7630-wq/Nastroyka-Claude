import { AddressInfo } from 'net';
import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { InMemoryQueue } from '../src/adapters/queue.inMemory';
import { InMemoryEventBus, RunEvent } from '../src/events/bus';
import { Observability } from '../src/observability/metrics';
import { ToolRegistry } from '../src/tools/registry';
import { startWorker } from '../src/worker/worker';
import { ControlPlane } from '../src/api/controlPlane';
import { StaticPlanner } from '../src/orchestrator/planner';
import { createControlPlaneServer } from '../src/api/server';
import { finalTurn } from '../src/adapters/model.mock';
import { ModelProvider } from '../src/ports/model';
import { ModelTurn, Agent, Org } from '../src/domain/types';
import { RichDocumentParser } from '../src/adapters/documents.rich';
import { parseHandoffDirectives, processHandoffs } from '../src/agent/handoff';

const ORG: Org = { id: 'org_1', name: 'Acme' };
const AGENT: Agent = {
  id: 'agent_1',
  orgId: 'org_1',
  name: 'Researcher',
  type: 'researcher',
  systemPrompt: 'be helpful',
};

class FinalModel implements ModelProvider {
  async complete(args: { messages: { role: string; content: string }[] }): Promise<ModelTurn> {
    const last = [...args.messages].reverse().find((m) => m.role === 'user');
    return { ...finalTurn(`reply:${last?.content ?? ''}`) };
  }
}

// Fails the first n complete() calls, then succeeds.
class FailFirstNModel implements ModelProvider {
  private c = 0;
  constructor(private readonly n: number) {}
  async complete(): Promise<ModelTurn> {
    this.c += 1;
    if (this.c <= this.n) throw new Error('model boom');
    return { ...finalTurn('ok') };
  }
}

function build(opts: { model: ModelProvider; maxAttempts?: number }) {
  const repo = new InMemoryRepository();
  repo.seedOrg({ ...ORG });
  repo.seedAgent({ ...AGENT });
  const events = new InMemoryEventBus();
  const observability = new Observability(repo);
  const queue = new InMemoryQueue({ maxAttempts: opts.maxAttempts ?? 2 });
  startWorker({
    queue,
    repo,
    model: opts.model,
    tools: new ToolRegistry(),
    allowlistDomains: [],
    events,
    planner: new StaticPlanner({ subtasks: [{ id: 's', agentType: 'researcher', prompt: 'x', dependsOn: [] }] }),
    complexityThreshold: 999, // simple tasks -> single-agent fast path
    defaultAgentType: 'researcher',
  });
  const cp = new ControlPlane({
    repo,
    queue,
    observability,
    events,
    documents: new RichDocumentParser(),
  });
  return { repo, events, queue, cp };
}

describe('Control Plane — runs + events + observability', () => {
  it('creates a run, streams lifecycle events, and exposes the trace + metrics', async () => {
    const { cp, events } = build({ model: new FinalModel() });
    const received: RunEvent[] = [];
    events.subscribe('*', (e) => received.push(e));

    const { runId, status } = await cp.createRun({
      orgId: 'org_1',
      agentId: 'agent_1',
      input: { prompt: 'hello' },
    });
    expect(status).toBe('queued');

    // The in-memory queue runs synchronously, so the run is done now.
    const { run, trace } = await cp.getRun(runId);
    expect(run.status).toBe('succeeded');
    expect(trace).toHaveLength(1);
    expect(trace[0].role).toBe('assistant');

    const types = received.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(['run.started', 'step.appended', 'run.succeeded']),
    );

    const metrics = await cp.runMetrics(runId);
    expect(metrics.tokensIn + metrics.tokensOut).toBe(15);

    const burn = await cp.tokenBurn('org_1');
    expect(burn['agent_1']).toBe(15);
  });

  it('rejects runs for unknown org/agent', async () => {
    const { cp } = build({ model: new FinalModel() });
    await expect(
      cp.createRun({ orgId: 'nope', agentId: 'agent_1', input: {} }),
    ).rejects.toThrow(/Not found/);
  });
});

describe('Control Plane — Agent Factory (PRD M2)', () => {
  it('creates a typed agent and can run it', async () => {
    const { cp } = build({ model: new FinalModel() });

    const lawyer = await cp.createAgent({
      orgId: 'org_1',
      name: 'Юрист',
      type: 'reviewer',
      systemPrompt: 'Ты корпоративный юрист.',
      allowedTools: ['http_request'],
    });
    expect(lawyer.id).toBeTruthy();
    expect(lawyer.allowedTools).toEqual(['http_request']);

    const agents = await cp.listAgents('org_1');
    expect(agents.map((a) => a.name)).toEqual(expect.arrayContaining(['Researcher', 'Юрист']));

    const { status } = await cp.createRun({ orgId: 'org_1', agentId: lawyer.id, input: { prompt: 'review' } });
    expect(status).toBe('queued');
  });

  it('rejects an agent for an unknown org', async () => {
    const { cp } = build({ model: new FinalModel() });
    await expect(
      cp.createAgent({ orgId: 'nope', name: 'X', type: 'writer', systemPrompt: 'x' }),
    ).rejects.toThrow(/Not found/);
  });

  it('submitTask routes a natural-language task to the orchestrator agent', async () => {
    const { cp } = build({ model: new FinalModel() });
    await cp.createAgent({ orgId: 'org_1', name: 'Координатор', type: 'orchestrator', systemPrompt: 'координируй' });
    const { runId, status } = await cp.submitTask({ orgId: 'org_1', task: 'сделай отчёт' });
    expect(runId).toBeTruthy();
    expect(status).toBe('queued');
  });

  it('submitTask fails when the org has no orchestrator', async () => {
    const { cp } = build({ model: new FinalModel() });
    await expect(cp.submitTask({ orgId: 'org_1', task: 'x' })).rejects.toThrow(/orchestrator/);
  });
});

describe('Control Plane — DLQ requeue', () => {
  it('lists dead letters and requeues a failed run to a fresh attempt budget', async () => {
    // Fails twice (== maxAttempts) -> DLQ; succeeds on the 3rd call after requeue.
    const { cp } = build({ model: new FailFirstNModel(2), maxAttempts: 2 });

    const { runId } = await cp.createRun({
      orgId: 'org_1',
      agentId: 'agent_1',
      input: { prompt: 'x' },
    });

    let dlq = await cp.listDeadLetters();
    expect(dlq).toHaveLength(1);
    expect((await cp.getRun(runId)).run.status).toBe('failed');

    const requeued = await cp.requeueDeadLetter(runId);
    expect(requeued.status).toBe('queued');

    expect((await cp.getRun(runId)).run.status).toBe('succeeded');
    dlq = await cp.listDeadLetters();
    expect(dlq).toHaveLength(0);
  });
});

describe('hand-off parser & processHandoffs (agent/handoff.ts)', () => {
  it('parseHandoffDirectives reads the strict directive and ignores conversational prose', () => {
    const kodrin: Agent = { id: 'k', orgId: 'org_1', name: 'Kodrin — Разработчик', type: 'coder', systemPrompt: 'x' };
    const roster: Agent[] = [{ ...AGENT }, kodrin];
    const hits = parseHandoffDirectives('ПОРУЧЕНИЕ Kodrin: сделай API', roster);
    expect(hits).toHaveLength(1);
    expect(hits[0].agent.id).toBe('k');
    expect(hits[0].task).toBe('сделай API');
    // a mention of the lowercase delegation phrase in prose must NOT fire
    expect(parseHandoffDirectives('можешь написать «поручи Kodrin: …»', roster)).toEqual([]);
  });

  // A queue that only records what was enqueued, so processHandoffs can be tested
  // in isolation without actually executing the child run.
  function recordingSetup() {
    const repo = new InMemoryRepository();
    repo.seedOrg({ ...ORG });
    repo.seedAgent({ ...AGENT }); // Researcher = the delegator
    repo.seedAgent({ id: 'k', orgId: 'org_1', name: 'Kodrin — Разработчик', type: 'coder', systemPrompt: 'x' });
    const enqueued: string[] = [];
    const queue = { enqueue: async (j: { runId: string }) => { enqueued.push(j.runId); }, process: () => {}, reset: () => {}, close: async () => {} };
    return { repo, queue, enqueued };
  }

  async function seedParent(repo: InMemoryRepository, opts: { output: string; depth?: number; chain?: string[] }) {
    const runId = 'parent_1';
    await repo.createRun({
      id: runId,
      orgId: 'org_1',
      agentId: 'agent_1',
      status: 'succeeded',
      input: {
        chat: true,
        prompt: 'x',
        ...(opts.depth !== undefined ? { delegDepth: opts.depth } : {}),
        ...(opts.chain !== undefined ? { chain: opts.chain } : {}),
      },
      output: opts.output,
      attempts: 1,
    });
    return runId;
  }

  it('creates + AUTO-STARTS a colleague assignment, cleans the reply, records handoffs, idempotent', async () => {
    const { repo, queue, enqueued } = recordingSetup();
    const runId = await seedParent(repo, { output: 'Передаю Kodrin.\nПОРУЧЕНИЕ Kodrin: сделай REST API' });

    await processHandoffs({ repo, queue }, runId);

    const childId = runId + '::deleg::k';
    const child = await repo.getRun(childId);
    expect(child).toBeTruthy();
    expect((child!.input as { assignment?: boolean }).assignment).toBe(true);
    expect((child!.input as { started?: boolean }).started).toBe(true); // auto-started
    expect((child!.input as { task?: string }).task).toBe('сделай REST API');
    expect((child!.input as { delegDepth?: number }).delegDepth).toBe(1);
    expect(child!.parentRunId).toBe(runId); // linked to parent so chains survive a reload
    expect((child!.input as { chain?: string[] }).chain).toEqual(['agent_1']); // delegator seeded into the chain
    expect(enqueued).toEqual([childId]); // actually enqueued, not dormant

    const parent = await repo.getRun(runId);
    expect((parent!.input as { handoffs?: unknown[] }).handoffs).toHaveLength(1);
    expect(String(parent!.output)).toMatch(/Передал\(а\): Kodrin .*выполняет/);
    expect(String(parent!.output)).not.toMatch(/ПОРУЧЕНИЕ Kodrin:/);

    // Idempotent: a second pass must not create a second child or re-enqueue.
    await processHandoffs({ repo, queue }, runId);
    expect(enqueued).toEqual([childId]);
  });

  it('stops the chain at the depth limit instead of creating another assignment', async () => {
    const { repo, queue, enqueued } = recordingSetup();
    // Default AGENT_DELEG_MAX_DEPTH = 3; a run already at depth 3 may not delegate further.
    const runId = await seedParent(repo, { output: 'ПОРУЧЕНИЕ Kodrin: ещё шаг', depth: 3 });

    await processHandoffs({ repo, queue }, runId);

    expect(await repo.getRun(runId + '::deleg::k')).toBeNull();
    expect(enqueued).toEqual([]);
    expect(String((await repo.getRun(runId))!.output)).toMatch(/лимит цепочки/);
  });

  it('refuses to hand back to a colleague already in the chain (no A→B→A loop)', async () => {
    const { repo, queue, enqueued } = recordingSetup();
    // Kodrin ('k') already delegated to us earlier in this chain; bouncing the
    // task back to Kodrin must be refused even though the depth budget allows it.
    const runId = await seedParent(repo, { output: 'ПОРУЧЕНИЕ Kodrin: верни мне обратно', depth: 1, chain: ['k'] });

    await processHandoffs({ repo, queue }, runId);

    expect(await repo.getRun(runId + '::deleg::k')).toBeNull();
    expect(enqueued).toEqual([]);
    expect(String((await repo.getRun(runId))!.output)).toMatch(/уже в этой цепочке/);
  });
});

describe('Control Plane — document extraction (Doc-1)', () => {
  it('extracts text from an uploaded file for the chat', async () => {
    const { cp } = build({ model: new FinalModel() });
    const { text } = await cp.extractDocument({
      mime: 'text/csv',
      filename: 'sales.csv',
      content: Buffer.from('month,rev\njan,100').toString('base64'),
    });
    expect(text).toBe('month | rev\njan | 100');
  });

  it('maps unreadable files to a 400-class error carrying the honest fix', async () => {
    const { cp } = build({ model: new FinalModel() });
    await expect(
      cp.extractDocument({
        mime: 'application/msword',
        filename: 'old.doc',
        content: Buffer.from('binary').toString('base64'),
      }),
    ).rejects.toThrow(/пересохраните файл как \.docx/);
    await expect(cp.extractDocument({ filename: 'x.txt' })).rejects.toThrow(/content is required/);
  });
});

describe('HTTP server adapter (smoke)', () => {
  it('routes requests and maps errors to status codes', async () => {
    const { cp } = build({ model: new FinalModel() });
    const server = createControlPlaneServer(cp);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      const missing = await fetch(`${base}/runs/does-not-exist`);
      expect(missing.status).toBe(404);

      const dlq = await fetch(`${base}/dlq`);
      expect(dlq.status).toBe(200);
      expect(await dlq.json()).toEqual([]);

      // Chat thread routes (must beat the /orgs/:id/agents list route).
      const chatGet = await fetch(`${base}/orgs/org_1/agents/agent_1/chat`);
      expect(chatGet.status).toBe(200);
      expect(await chatGet.json()).toMatchObject({ messages: [], pending: [] });

      const chatPost = await fetch(`${base}/orgs/org_1/agents/agent_1/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'привет' }),
      });
      expect(chatPost.status).toBe(201);
      const chatBody = (await chatPost.json()) as { runId?: string };
      expect(chatBody.runId).toBeTruthy();

      // Unknown agent in the chat route → 404 (proves the route ordering fix).
      const chatMissing = await fetch(`${base}/orgs/org_1/agents/nope/chat`);
      expect(chatMissing.status).toBe(404);

      // Retry on a non-failed run → 400 (validation).
      const retry = await fetch(`${base}/runs/whatever/retry`, { method: 'POST', body: '{}' });
      expect([400, 404]).toContain(retry.status);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});
