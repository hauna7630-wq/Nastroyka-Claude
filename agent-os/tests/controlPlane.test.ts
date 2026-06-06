import { AddressInfo } from 'net';
import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { InMemoryQueue } from '../src/adapters/queue.inMemory';
import { InMemoryEventBus, RunEvent } from '../src/events/bus';
import { Observability } from '../src/observability/metrics';
import { ToolRegistry } from '../src/tools/registry';
import { startWorker } from '../src/worker/worker';
import { ControlPlane } from '../src/api/controlPlane';
import { createControlPlaneServer } from '../src/api/server';
import { finalTurn } from '../src/adapters/model.mock';
import { ModelProvider } from '../src/ports/model';
import { ModelTurn, Agent, Org } from '../src/domain/types';

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
  });
  const cp = new ControlPlane({ repo, queue, observability, events });
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
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});
