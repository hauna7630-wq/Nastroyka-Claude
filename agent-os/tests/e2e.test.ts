import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { InMemoryQueue } from '../src/adapters/queue.inMemory';
import {
  ScriptedModelProvider,
  FailingModelProvider,
  toolCallTurn,
  finalTurn,
} from '../src/adapters/model.mock';
import { ToolRegistry, ToolSpec } from '../src/tools/registry';
import { Ledger } from '../src/billing/ledger';
import { startWorker } from '../src/worker/worker';
import { ModelProvider } from '../src/ports/model';
import { Agent, Org, Run } from '../src/domain/types';

const ORG: Org = { id: 'org_1', name: 'Acme', creditBalance: 100 };
const AGENT: Agent = {
  id: 'agent_1',
  orgId: 'org_1',
  name: 'Researcher',
  type: 'researcher',
  systemPrompt: 'You are a helpful research agent.',
};

function makeRun(): Run {
  return {
    id: 'run_1',
    orgId: 'org_1',
    agentId: 'agent_1',
    status: 'queued',
    input: { prompt: 'Find the answer' },
    creditsUsed: 0,
    attempts: 0,
  };
}

function tool(name: string, run: ToolSpec['run']): ToolSpec {
  return {
    schema: { name, description: name, inputSchema: { type: 'object' } },
    security: { network: 'deny', cpuMs: 1000, memMb: 64, persistFs: false },
    run,
  };
}

async function setup(opts: {
  model: ModelProvider;
  tools: ToolRegistry;
  maxAttempts?: number;
}) {
  const repo = new InMemoryRepository();
  repo.seedOrg({ ...ORG });
  repo.seedAgent({ ...AGENT });
  await repo.createRun(makeRun());

  const ledger = new Ledger(repo);
  const queue = new InMemoryQueue({ maxAttempts: opts.maxAttempts ?? 3 });
  startWorker({
    queue,
    repo,
    model: opts.model,
    tools: opts.tools,
    ledger,
    allowlistDomains: [],
  });
  return { repo, ledger, queue };
}

describe('Run lifecycle (end-to-end)', () => {
  it('drives a run queued -> running -> succeeded via the worker, charging once', async () => {
    const tools = new ToolRegistry();
    tools.register(tool('fetch_data', async () => ({ ok: true, value: 42 })));
    const model = new ScriptedModelProvider([
      toolCallTurn('fetch_data', { q: 'hi' }, 'call_1'),
      finalTurn('All done'),
    ]);

    const { repo, ledger, queue } = await setup({ model, tools });
    await queue.enqueue({ runId: 'run_1' });

    const run = await repo.getRun('run_1');
    expect(run?.status).toBe('succeeded');
    expect(run?.output).toBe('All done');

    // assistant(0) + tool(1) + assistant(2)
    const steps = await repo.listSteps('run_1');
    expect(steps.map((s) => s.role)).toEqual(['assistant', 'tool', 'assistant']);
    expect(steps[1].toolName).toBe('fetch_data');

    // 1 (turn0 tokens) + 1 (tool) + 1 (turn1 tokens) = 3 credits, charged once.
    expect(await ledger.totalForRun('run_1')).toBe(3);
    expect((await repo.getOrg('org_1'))?.creditBalance).toBe(97);

    // Duplicate delivery of a completed run is a no-op (idempotent).
    await queue.enqueue({ runId: 'run_1' });
    expect(await ledger.totalForRun('run_1')).toBe(3); // unchanged
    expect(repo.auditLog.some((a) => a.action === 'run.skipped_terminal')).toBe(true);
  });

  it('does not double-charge when a flaky run is retried mid-flight', async () => {
    let calls = 0;
    const tools = new ToolRegistry();
    tools.register(
      tool('fetch_data', async () => {
        calls += 1;
        if (calls === 1) throw new Error('transient tool failure');
        return { ok: true };
      }),
    );
    const model = new ScriptedModelProvider([
      toolCallTurn('fetch_data', { q: 'hi' }, 'call_1'),
      finalTurn('Recovered'),
    ]);

    const { repo, ledger, queue } = await setup({ model, tools, maxAttempts: 3 });
    await queue.enqueue({ runId: 'run_1' });

    const run = await repo.getRun('run_1');
    expect(run?.status).toBe('succeeded');
    expect(run?.attempts).toBe(2); // failed once, then succeeded

    // The assistant turn was billed on BOTH attempts but the idempotency key
    // (run,0,turn:0) collapses it: total stays 3, not 4.
    expect(await ledger.totalForRun('run_1')).toBe(3);
  });

  it('routes a permanently failing run to the dead letter queue', async () => {
    const tools = new ToolRegistry();
    const model = new FailingModelProvider('model unavailable');

    const { repo, queue } = await setup({ model, tools, maxAttempts: 3 });
    await queue.enqueue({ runId: 'run_1' });

    const run = await repo.getRun('run_1');
    expect(run?.status).toBe('failed');
    expect(run?.error).toBe('model unavailable');
    expect(run?.attempts).toBe(3);

    const dlq = await repo.listDeadLetters();
    expect(dlq).toHaveLength(1);
    expect(dlq[0]).toMatchObject({ runId: 'run_1', attempts: 3 });
    expect(repo.auditLog.some((a) => a.action === 'run.dead_lettered')).toBe(true);
  });
});
