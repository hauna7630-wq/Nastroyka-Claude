// F2 integration test: a full run lifecycle through the REAL BullMQ queue (Redis)
// and the REAL PrismaRepository (Postgres). Skipped unless DATABASE_URL is set.
//
//   docker compose up -d                # or a local Postgres + Redis
//   DATABASE_URL=... REDIS_URL=... npm run db:migrate
//   DATABASE_URL=... REDIS_URL=... npm run test:integration

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaRepository, PrismaClientLike } from '../../src/adapters/repo.prisma';
import { BullMQQueue } from '../../src/adapters/queue.bullmq';
import { Ledger } from '../../src/billing/ledger';
import { ToolRegistry } from '../../src/tools/registry';
import { startWorker } from '../../src/worker/worker';
import { ScriptedModelProvider, finalTurn } from '../../src/adapters/model.mock';
import { Run } from '../../src/domain/types';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const describeIf = process.env.DATABASE_URL ? describe : describe.skip;

async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs: number): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('waitFor timed out');
}

describeIf('F2 — live Postgres + Redis', () => {
  const prisma = new PrismaClient();
  const repo = new PrismaRepository(prisma as unknown as PrismaClientLike);
  const ledger = new Ledger(repo);
  let queue: BullMQQueue;

  const orgId = `org_${randomUUID()}`;
  const agentId = `agent_${randomUUID()}`;

  beforeAll(async () => {
    await prisma.org.create({ data: { id: orgId, name: 'IntegrationOrg', creditBalance: 100 } });
    await prisma.agent.create({ data: { id: agentId, orgId, name: 'Researcher', type: 'researcher' } });
    const pv = await prisma.promptVersion.create({
      data: { agentId, version: 1, systemPrompt: 'be helpful' },
    });
    await prisma.agent.update({ where: { id: agentId }, data: { currentVersionId: pv.id } });
  });

  afterAll(async () => {
    if (queue) await queue.close();
    await prisma.org.delete({ where: { id: orgId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('persists the run/steps/ledger and drives it to succeeded via BullMQ', async () => {
    queue = new BullMQQueue({ redisUrl: REDIS_URL, maxAttempts: 1 });
    startWorker({
      queue,
      repo,
      model: new ScriptedModelProvider([finalTurn('persisted!')]),
      tools: new ToolRegistry(),
      ledger,
      allowlistDomains: [],
    });

    const runId = randomUUID();
    const run: Run = {
      id: runId,
      orgId,
      agentId,
      status: 'queued',
      input: { prompt: 'hello postgres' },
      creditsUsed: 0,
      attempts: 0,
    };
    await repo.createRun(run);
    await queue.enqueue({ runId });

    const done = await waitFor(async () => {
      const r = await repo.getRun(runId);
      return r && (r.status === 'succeeded' || r.status === 'failed') ? r : null;
    }, 20000);

    expect(done.status).toBe('succeeded');
    expect(done.output).toBe('persisted!');

    // Trace + billing actually landed in Postgres.
    const steps = await repo.listSteps(runId);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(await ledger.totalForRun(runId)).toBe(1);
    expect((await repo.getOrg(orgId))?.creditBalance).toBe(99);

    // Re-reading from a fresh client proves durability, not just cache.
    const fresh = new PrismaClient();
    try {
      const row = await fresh.run.findUnique({ where: { id: runId } });
      expect(row?.status).toBe('succeeded');
    } finally {
      await fresh.$disconnect();
    }
  });

  it('enforces ledger idempotency at the database level (unique constraint)', async () => {
    const runId = randomUUID();
    await repo.createRun({
      id: runId,
      orgId,
      agentId,
      status: 'running',
      input: {},
      creditsUsed: 0,
      attempts: 0,
    });
    const entry = { orgId, runId, stepIndex: 0, toolCallId: 'tc_1', amount: -5, reason: 'test' };

    const first = await repo.recordLedgerEntryIfAbsent(entry);
    const second = await repo.recordLedgerEntryIfAbsent(entry); // duplicate -> P2002 -> no-op
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await repo.getRunCreditsUsed(runId)).toBe(-5); // charged once
  });
});
