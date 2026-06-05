// Queue port — the boundary between the Control Plane (enqueues work) and the
// Execution Plane (drains it). Production: BullMQ + Redis. Tests: in-memory.

import { RunJob } from '../domain/types';

export interface JobContext {
  attempt: number; // 1-based attempt counter
  maxAttempts: number;
}

// A processor handles a job; throwing signals failure (triggering retry / DLQ).
export type JobProcessor = (job: RunJob, ctx: JobContext) => Promise<void>;

export interface Queue {
  enqueue(job: RunJob): Promise<void>;
  // Register the processor. The execution plane drives jobs through it.
  process(processor: JobProcessor): void;
  // Best-effort drain for tests/shutdown; production adapters may no-op.
  close(): Promise<void>;
}
