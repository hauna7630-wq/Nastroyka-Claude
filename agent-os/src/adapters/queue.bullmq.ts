// Production Queue adapter backed by BullMQ + Redis.
//
// TODO (production hardening): wire BullMQ-native retry/backoff (job opts
// `attempts`/`backoff`) and a QueueEvents 'failed' listener that routes
// exhausted jobs to the DeadLetter store. The in-memory adapter
// (queue.inMemory.ts) is the reference implementation exercised by tests; this
// adapter mirrors its contract for real deployments.

import { Queue as BullQueue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { JobProcessor, Queue } from '../ports/queue';
import { RunJob } from '../domain/types';

const QUEUE_NAME = 'agent-runs';

export class BullMQQueue implements Queue {
  private readonly connection: IORedis;
  private readonly queue: BullQueue;
  private readonly redisUrl: string;
  private worker?: Worker;
  private workerConnection?: IORedis;
  private readonly maxAttempts: number;

  constructor(opts: { redisUrl: string; maxAttempts?: number }) {
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.redisUrl = opts.redisUrl;
    this.connection = new IORedis(opts.redisUrl, { maxRetriesPerRequest: null });
    // `as any`: BullMQ ships a nested copy of ioredis, so the top-level ioredis
    // instance is nominally (not structurally) incompatible with BullMQ's
    // ConnectionOptions. They are the same library at runtime.
    this.queue = new BullQueue(QUEUE_NAME, { connection: this.connection as any });
  }

  async enqueue(job: RunJob): Promise<void> {
    await this.queue.add('run', job, { attempts: 1 });
  }

  process(processor: JobProcessor): void {
    // A BullMQ Worker MUST have its own dedicated Redis connection — it issues
    // blocking commands and cannot share the producer's connection (sharing makes
    // it silently stop draining the queue). So create a separate connection here.
    this.workerConnection = new IORedis(this.redisUrl, { maxRetriesPerRequest: null });
    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job<RunJob>) => {
        await processor(job.data, {
          attempt: job.attemptsMade + 1,
          maxAttempts: this.maxAttempts,
        });
      },
      { connection: this.workerConnection as any },
    );
    this.worker.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[bullmq worker] error:', err?.message ?? err);
    });
    this.worker.on('failed', (job, err) => {
      // eslint-disable-next-line no-console
      console.error('[bullmq worker] job failed:', job?.id, err?.message ?? err);
    });
  }

  reset(_runId: string): void {
    // No-op: each BullMQ `add` creates a fresh job with attemptsMade = 0, so an
    // operator requeue is already a clean attempt budget.
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.workerConnection?.quit();
    await this.connection.quit();
  }
}
