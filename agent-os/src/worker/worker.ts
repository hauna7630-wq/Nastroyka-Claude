// Execution plane worker.
//
// Registers a processor on the Queue that runs the agent runtime and owns the
// reliability policy: retry on transient failure, and on exhaustion perform the
// terminal `running -> failed` transition plus DLQ routing.

import { transition } from '../domain/runStateMachine';
import { Queue } from '../ports/queue';
import { dispatchRun, DispatchDeps } from '../agent/dispatch';

export interface WorkerDeps extends DispatchDeps {
  queue: Queue;
}

export function startWorker(deps: WorkerDeps): void {
  const { queue, repo } = deps;

  queue.process(async (job, ctx) => {
    await repo.incrementRunAttempts(job.runId);
    try {
      await dispatchRun(job.runId, deps);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);

      if (ctx.attempt < ctx.maxAttempts) {
        await repo.audit({
          orgId: (await repo.getRun(job.runId))?.orgId ?? 'unknown',
          runId: job.runId,
          actor: 'worker',
          action: 'run.retry_scheduled',
          meta: { attempt: ctx.attempt, reason },
        });
        await queue.enqueue(job); // re-deliver (attempt + 1)
        return;
      }

      // Attempts exhausted: terminal failure + dead letter.
      const run = await repo.getRun(job.runId);
      if (run) {
        await repo.updateRunStatus(job.runId, transition(run.status, 'failed'), {
          error: reason,
        });
        await repo.recordDeadLetter({
          runId: job.runId,
          payload: job,
          failureReason: reason,
          attempts: ctx.attempt,
        });
        await repo.audit({
          orgId: run.orgId,
          runId: job.runId,
          actor: 'worker',
          action: 'run.dead_lettered',
          meta: { attempts: ctx.attempt, reason },
        });
      }
    }
  });
}

// Production entrypoint: wire real adapters and start draining. Guarded so the
// module stays import-safe for tests.
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildApp } = require('../index');
  const app = buildApp();
  startWorker(app.workerDeps);
  // eslint-disable-next-line no-console
  console.log('agent-os worker started (production adapters)');
}
