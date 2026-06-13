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

// A single model call (Claude CLI, --max-turns 8 + web search via the relay) can
// legitimately run up to ~3 min, and an orchestrator parent runs its children
// inline, so a job can hold the worker far longer than BullMQ's 30s default lock.
// We therefore (a) give the lock a generous duration so a slow-but-healthy job is
// not mistaken for "stalled" and killed, and (b) run several jobs concurrently so
// one slow/stuck run never blocks the whole queue (the symptom that left chat runs
// stuck in `queued`). Tunable via env for the 2-core/4GB prod host.
const LOCK_DURATION_MS = Number(process.env.BULLMQ_LOCK_MS ?? 600000); // 10 min
const WORKER_CONCURRENCY = Number(process.env.BULLMQ_CONCURRENCY ?? 4);

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
    // Don't let completed/failed jobs pile up in Redis across deploys (stale jobs
    // were being reprocessed by a fresh worker). Keep a small failed tail for
    // post-mortems; drop succeeded jobs immediately.
    await this.queue.add('run', job, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 200,
    });
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
      {
        connection: this.workerConnection as any,
        concurrency: WORKER_CONCURRENCY,
        lockDuration: LOCK_DURATION_MS,
      },
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
