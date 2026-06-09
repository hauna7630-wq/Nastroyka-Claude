// Redis pub/sub event bus: lets RunEvents cross process boundaries (e.g. a
// separate worker process publishes; the control-plane/SSE process subscribes).
// Same EventBus contract as InMemoryEventBus.

import IORedis from 'ioredis';
import { EventBus, RunEvent, RunEventListener } from '../events/bus';

const CHANNEL = (runId: string) => `agentos:run:${runId}`;
const PATTERN = 'agentos:run:*';

export class RedisEventBus implements EventBus {
  private readonly pub: IORedis;
  private readonly sub: IORedis;
  private readonly byChannel = new Map<string, Set<RunEventListener>>();
  private readonly wildcard = new Set<RunEventListener>();
  private psubscribed = false;

  constructor(redisUrl: string) {
    this.pub = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.sub = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.sub.on('message', (channel, msg) => this.dispatch(this.byChannel.get(channel), msg));
    this.sub.on('pmessage', (_pattern, _channel, msg) => this.dispatch(this.wildcard, msg));
  }

  publish(event: RunEvent): void {
    // Fire-and-forget — EventBus.publish is synchronous.
    void this.pub.publish(CHANNEL(event.runId), JSON.stringify(event));
  }

  subscribe(runId: string, listener: RunEventListener): () => void {
    if (runId === '*') {
      this.wildcard.add(listener);
      if (!this.psubscribed) {
        this.psubscribed = true;
        void this.sub.psubscribe(PATTERN);
      }
      return () => {
        this.wildcard.delete(listener);
        if (this.wildcard.size === 0 && this.psubscribed) {
          this.psubscribed = false;
          void this.sub.punsubscribe(PATTERN);
        }
      };
    }

    const channel = CHANNEL(runId);
    const set = this.byChannel.get(channel) ?? new Set();
    set.add(listener);
    this.byChannel.set(channel, set);
    if (set.size === 1) void this.sub.subscribe(channel);
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.byChannel.delete(channel);
        void this.sub.unsubscribe(channel);
      }
    };
  }

  async close(): Promise<void> {
    await this.sub.quit();
    await this.pub.quit();
  }

  private dispatch(listeners: Set<RunEventListener> | undefined, msg: string): void {
    if (!listeners || listeners.size === 0) return;
    let event: RunEvent;
    try {
      event = JSON.parse(msg) as RunEvent;
    } catch {
      return;
    }
    for (const l of listeners) {
      try {
        l(event);
      } catch {
        // a misbehaving subscriber must not break delivery
      }
    }
  }
}
