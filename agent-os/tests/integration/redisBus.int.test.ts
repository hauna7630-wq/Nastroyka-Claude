// RedisEventBus over live Redis pub/sub. Gated on REDIS_URL.

import { RedisEventBus } from '../../src/adapters/events.redis';
import { RunEvent } from '../../src/events/bus';

const REDIS_URL = process.env.REDIS_URL;
const describeIf = REDIS_URL ? describe : describe.skip;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function evt(runId: string, type: RunEvent['type'] = 'run.started'): RunEvent {
  return { type, runId, orgId: 'o', data: { n: 1 }, at: Date.now() };
}

describeIf('RedisEventBus (live Redis pub/sub)', () => {
  let bus: RedisEventBus;
  beforeAll(() => {
    bus = new RedisEventBus(REDIS_URL as string);
  });
  afterAll(async () => {
    await bus.close();
  });

  it('delivers per-run and wildcard events, scoped by run', async () => {
    const r1: RunEvent[] = [];
    const all: RunEvent[] = [];
    const off1 = bus.subscribe('run_1', (e) => r1.push(e));
    const offAll = bus.subscribe('*', (e) => all.push(e));
    await sleep(200); // let (p)subscribe take effect

    bus.publish(evt('run_1', 'run.succeeded'));
    bus.publish(evt('run_2', 'run.failed'));
    await sleep(250); // pub/sub round-trip

    // run_1 listener only saw run_1; wildcard saw both.
    expect(r1.map((e) => e.runId)).toEqual(['run_1']);
    expect(all.map((e) => e.runId).sort()).toEqual(['run_1', 'run_2']);
    expect(r1[0].type).toBe('run.succeeded');

    off1();
    offAll();
  });

  it('stops delivering after unsubscribe', async () => {
    const got: RunEvent[] = [];
    const off = bus.subscribe('run_x', (e) => got.push(e));
    await sleep(200);
    off();
    await sleep(100);
    bus.publish(evt('run_x'));
    await sleep(200);
    expect(got).toHaveLength(0);
  });
});
