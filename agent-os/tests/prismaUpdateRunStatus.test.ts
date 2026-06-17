// Regression guard for the v73 fix: the Prisma adapter's updateRunStatus must
// persist `input` (and `attempts`) when they are patched. Before v73 it wrote
// only status/output/error, silently dropping `input.handoffs` — which broke
// agent-to-agent delegation on Postgres while the in-memory adapter (used by the
// rest of the suite) kept working, so every other test stayed green.

import { PrismaRepository, PrismaClientLike } from '../src/adapters/repo.prisma';

function mockDb(): { db: PrismaClientLike; calls: Array<{ where: any; data: any }> } {
  const calls: Array<{ where: any; data: any }> = [];
  const run = {
    update: async (args: { where: any; data: any }) => {
      calls.push(args);
      return { id: args.where.id, attempts: 0, ...args.data };
    },
  };
  // Only `run.update` is exercised here; the rest of the surface is unused.
  const db = { run } as unknown as PrismaClientLike;
  return { db, calls };
}

describe('PrismaRepository.updateRunStatus — patch persistence', () => {
  it('persists patch.input (delegation handoffs) and patch.attempts', async () => {
    const { db, calls } = mockDb();
    const repo = new PrismaRepository(db);

    const handoffs = [{ runId: 'r1::deleg::a2', to: 'Kodrin', task: 'do it' }];
    await repo.updateRunStatus('r1', 'succeeded', {
      output: { text: 'done' },
      input: { chat: true, handoffs },
      attempts: 2,
    });

    expect(calls).toHaveLength(1);
    const { data } = calls[0];
    expect(data.status).toBe('succeeded');
    expect(data.output).toEqual({ text: 'done' });
    expect(data.input).toEqual({ chat: true, handoffs });
    expect(data.attempts).toBe(2);
  });

  it('omits unpatched fields (no input/attempts keys when not provided)', async () => {
    const { db, calls } = mockDb();
    const repo = new PrismaRepository(db);

    await repo.updateRunStatus('r2', 'failed', { error: 'boom' });

    const { data } = calls[0];
    expect(data.status).toBe('failed');
    expect(data.error).toBe('boom');
    expect('input' in data).toBe(false);
    expect('attempts' in data).toBe(false);
  });
});
