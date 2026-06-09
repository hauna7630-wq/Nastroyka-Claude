// In-process queue adapter for dev/tests. Delivers synchronously (awaited), so a
// single `enqueue` resolves only after the job — and any retries it triggers —
// have fully drained. Tracks a per-run delivery counter to populate ctx.attempt,
// mirroring BullMQ's `attemptsMade` semantics.

import { JobContext, JobProcessor, Queue } from '../ports/queue';
import { RunJob } from '../domain/types';

export class InMemoryQueue implements Queue {
  private processor?: JobProcessor;
  private readonly deliveries = new Map<string, number>();
  private readonly maxAttempts: number;
  // When true, enqueue returns immediately and the job runs on the next tick.
  // Used by the dev Coordinator so SSE events stream after the client subscribes;
  // tests use the default (synchronous) mode and assert completion inline.
  private readonly async: boolean;

  constructor(opts: { maxAttempts?: number; async?: boolean } = {}) {
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.async = opts.async ?? false;
  }

  async enqueue(job: RunJob): Promise<void> {
    if (!this.processor) {
      throw new Error('InMemoryQueue: no processor registered');
    }
    const attempt = (this.deliveries.get(job.runId) ?? 0) + 1;
    this.deliveries.set(job.runId, attempt);
    const ctx: JobContext = { attempt, maxAttempts: this.maxAttempts };
    if (this.async) {
      setTimeout(() => {
        void this.processor!(job, ctx).catch(() => undefined);
      }, 0);
      return;
    }
    await this.processor(job, ctx);
  }

  process(processor: JobProcessor): void {
    this.processor = processor;
  }

  reset(runId: string): void {
    this.deliveries.delete(runId);
  }

  async close(): Promise<void> {
    this.deliveries.clear();
  }
}
