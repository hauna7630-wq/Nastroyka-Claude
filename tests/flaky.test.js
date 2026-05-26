/**
 * FLAKY TESTS — demonstration file.
 * Each test illustrates a real-world flakiness pattern.
 * See: https://github.com/hauna7630-wq/Nastroyka-Claude
 */

const { TaskQueue, incrementCounter, getCounter, resetCounter, fetchSequential } = require('../src/queue');

// ─── Flaky #1: Race condition (no await) ─────────────────────────────────────
// Fails ~40% of the time: the assertion runs before the async task completes.
describe('TaskQueue', () => {
  test('[FLAKY] run() collects results — race condition', () => {
    const q = new TaskQueue();
    q.add(() => Promise.resolve(1));
    q.add(() => Promise.resolve(2));

    q.run(); // ← missing await — result not checked after resolution

    // getResults() is checked immediately, before promises settle
    expect(q.getResults().length).toBeGreaterThanOrEqual(0);
    // Sometimes 0, sometimes 2 depending on microtask scheduling
  });

  test('run() collects results — fixed (with await)', async () => {
    const q = new TaskQueue();
    q.add(() => Promise.resolve(1));
    q.add(() => Promise.resolve(2));
    const results = await q.run();
    expect(results).toEqual([1, 2]);
  });
});

// ─── Flaky #2: Shared global state (no reset between tests) ──────────────────
// Fails when tests run in a different order or in parallel.
describe('globalCounter — shared state', () => {
  // Intentionally missing: beforeEach(() => resetCounter())

  test('[FLAKY] counter starts at 0', () => {
    // Passes only if no previous test incremented globalCounter
    expect(getCounter()).toBe(0);
  });

  test('[FLAKY] increment returns 1 on first call', () => {
    // Passes only if counter is still 0 when this test runs
    expect(incrementCounter()).toBe(1);
  });

  test('increment is cumulative', () => {
    incrementCounter();
    incrementCounter();
    // This test doesn't care about the starting value — always passes
    expect(getCounter()).toBeGreaterThan(0);
  });
});

// ─── Flaky #3: Timing / real setTimeout ──────────────────────────────────────
// Fails ~20% of the time on slow CI runners where 50 ms isn't enough.
describe('timing-sensitive test', () => {
  test('[FLAKY] callback fires within 50 ms', (done) => {
    const start = Date.now();
    setTimeout(() => {
      const elapsed = Date.now() - start;
      // On a loaded CI runner this can easily exceed 50 ms
      expect(elapsed).toBeLessThan(50);
      done();
    }, 30);
  });

  test('callback fires within 500 ms — stable margin', (done) => {
    const start = Date.now();
    setTimeout(() => {
      expect(Date.now() - start).toBeLessThan(500);
      done();
    }, 30);
  });
});

// ─── Flaky #4: Math.random() — non-deterministic ─────────────────────────────
// Fails ~30% of the time.
describe('random-dependent logic', () => {
  test('[FLAKY] random sample contains expected value', () => {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // Pick 3 random items and hope 7 is among them — clearly non-deterministic
    const sample = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    expect(sample).toContain(7);
  });

  test('shuffle produces a permutation — stable', () => {
    const pool = [1, 2, 3, 4, 5];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    expect(shuffled.sort((a, b) => a - b)).toEqual(pool);
  });
});

// ─── Flaky #5: Order-dependent (relies on side-effect from another test) ─────
// Passes only when the test above has already incremented the counter.
describe('order-dependent counter check', () => {
  test('[FLAKY] counter is non-zero after suite runs', () => {
    // Implicitly depends on "increment is cumulative" having run first
    expect(getCounter()).toBeGreaterThan(0);
  });
});
