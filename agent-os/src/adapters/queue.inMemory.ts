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

  constructor(opts: { maxAttempts?: number } = {}) {
    this.maxAttempts = opts.maxAttempts ?? 3;
  }

  async enqueue(job: RunJob): Promise<void> {
    if (!this.processor) {
      throw new Error('InMemoryQueue: no processor registered');
    }
    const attempt = (this.deliveries.get(job.runId) ?? 0) + 1;
    this.deliveries.set(job.runId, attempt);
    const ctx: JobContext = { attempt, maxAttempts: this.maxAttempts };
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
