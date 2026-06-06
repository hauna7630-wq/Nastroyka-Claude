// F2 integration test: a full run lifecycle through the REAL BullMQ queue (Redis)
// and the REAL PrismaRepository (Postgres). Skipped unless DATABASE_URL is set.
//
//   DATABASE_URL=... REDIS_URL=... npm run db:migrate
//   DATABASE_URL=... REDIS_URL=... npm run test:integration

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaRepository, PrismaClientLike } from '../../src/adapters/repo.prisma';
import { BullMQQueue } from '../../src/adapters/queue.bullmq';
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
  let queue: BullMQQueue;

  const orgId = `org_${randomUUID()}`;
  const agentId = `agent_${randomUUID()}`;

  beforeAll(async () => {
    await prisma.org.create({ data: { id: orgId, name: 'IntegrationOrg' } });
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

  it('persists the run + step trace and drives it to succeeded via BullMQ', async () => {
    queue = new BullMQQueue({ redisUrl: REDIS_URL, maxAttempts: 1 });
    startWorker({
      queue,
      repo,
      model: new ScriptedModelProvider([finalTurn('persisted!')]),
      tools: new ToolRegistry(),
      allowlistDomains: [],
    });

    const runId = randomUUID();
    const run: Run = {
      id: runId,
      orgId,
      agentId,
      status: 'queued',
      input: { prompt: 'hello postgres' },
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

    // The step trace landed in Postgres with token metrics.
    const steps = await repo.listSteps(runId);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect((steps[0].tokensIn ?? 0) + (steps[0].tokensOut ?? 0)).toBeGreaterThan(0);

    // Re-reading from a fresh client proves durability, not just cache.
    const fresh = new PrismaClient();
    try {
      const row = await fresh.run.findUnique({ where: { id: runId } });
      expect(row?.status).toBe('succeeded');
    } finally {
      await fresh.$disconnect();
    }
  });
});
