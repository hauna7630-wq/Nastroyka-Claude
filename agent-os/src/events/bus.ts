// Event bus — the async backbone of the Control Plane (F4).
//
// Runtime / orchestrator / worker publish RunEvents; the API streams them to
// clients over SSE/WS. Production would back this with Redis pub/sub so events
// cross process boundaries; the in-memory bus is the reference + test adapter.

export type RunEventType =
  | 'run.started'
  | 'step.appended'
  | 'run.succeeded'
  | 'run.failed'
  | 'run.dead_lettered'
  | 'run.needs_human'
  | 'orchestration.planned'
  | 'orchestration.subtask';

export interface RunEvent {
  type: RunEventType;
  runId: string;
  orgId: string;
  data?: unknown;
  at: number;
}

export type RunEventListener = (event: RunEvent) => void;

export interface EventBus {
  publish(event: RunEvent): void;
  // Subscribe to a specific run, or '*' for all runs. Returns an unsubscribe fn.
  subscribe(runId: string, listener: RunEventListener): () => void;
}

export class InMemoryEventBus implements EventBus {
  private readonly listeners = new Map<string, Set<RunEventListener>>();

  publish(event: RunEvent): void {
    for (const key of [event.runId, '*']) {
      const set = this.listeners.get(key);
      if (!set) continue;
      for (const l of set) {
        try {
          l(event);
        } catch {
          // A misbehaving subscriber must not break publishing.
        }
      }
    }
  }

  subscribe(runId: string, listener: RunEventListener): () => void {
    const set = this.listeners.get(runId) ?? new Set();
    set.add(listener);
    this.listeners.set(runId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(runId);
    };
  }
}

// Small helper so publishers don't repeat the timestamp boilerplate.
export function emit(
  bus: EventBus | undefined,
  type: RunEventType,
  runId: string,
  orgId: string,
  data?: unknown,
): void {
  bus?.publish({ type, runId, orgId, data, at: Date.now() });
}
