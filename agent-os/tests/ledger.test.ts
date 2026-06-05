import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { Ledger } from '../src/billing/ledger';
import { Run } from '../src/domain/types';

function seed(): { repo: InMemoryRepository; ledger: Ledger; run: Run } {
  const repo = new InMemoryRepository();
  repo.seedOrg({ id: 'org_1', name: 'Acme', creditBalance: 100 });
  const run: Run = {
    id: 'run_1',
    orgId: 'org_1',
    agentId: 'agent_1',
    status: 'running',
    input: {},
    creditsUsed: 0,
    attempts: 0,
  };
  return { repo, ledger: new Ledger(repo), run };
}

describe('Idempotent billing ledger', () => {
  it('charges a (runId, stepIndex, toolCallId) tuple exactly once', async () => {
    const { repo, ledger } = seed();
    await repo.createRun({
      id: 'run_1',
      orgId: 'org_1',
      agentId: 'agent_1',
      status: 'running',
      input: {},
      creditsUsed: 0,
      attempts: 0,
    });

    const args = {
      orgId: 'org_1',
      runId: 'run_1',
      stepIndex: 1,
      toolCallId: 'call_1',
      amount: 5,
    };

    const first = await ledger.charge(args);
    const second = await ledger.charge(args); // duplicate (e.g. retry)
    const third = await ledger.charge(args);

    expect(first).toBe(true); // applied
    expect(second).toBe(false); // no-op
    expect(third).toBe(false); // no-op

    expect(await ledger.totalForRun('run_1')).toBe(5); // charged once
    const org = await repo.getOrg('org_1');
    expect(org?.creditBalance).toBe(95); // 100 - 5, debited once
  });

  it('charges distinct tuples independently', async () => {
    const { repo, ledger } = seed();
    await repo.createRun({
      id: 'run_1',
      orgId: 'org_1',
      agentId: 'agent_1',
      status: 'running',
      input: {},
      creditsUsed: 0,
      attempts: 0,
    });

    await ledger.charge({ orgId: 'org_1', runId: 'run_1', stepIndex: 1, toolCallId: 'a', amount: 2 });
    await ledger.charge({ orgId: 'org_1', runId: 'run_1', stepIndex: 2, toolCallId: 'b', amount: 3 });

    expect(await ledger.totalForRun('run_1')).toBe(5);
  });

  it('rejects negative charge amounts', async () => {
    const { ledger } = seed();
    await expect(
      ledger.charge({ orgId: 'org_1', runId: 'run_1', stepIndex: 0, toolCallId: 'x', amount: -1 }),
    ).rejects.toThrow();
  });
});
