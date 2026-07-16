import { describe, it, expect } from 'vitest';
import {
  withRetry,
  defaultIsRetryable,
  BackpressureLimiter,
  BackpressureError,
} from '../resilience';

/** Deterministic no-op sleep + fixed jitter so backoff is testable without the clock. */
const noSleep = async () => {};
const fixedRand = () => 0.5;

describe('ai resilience · defaultIsRetryable', () => {
  it('treats 429 / 5xx / 408 as transient', () => {
    for (const code of [408, 429, 500, 502, 503, 504]) {
      expect(defaultIsRetryable(new Error(`openai ${code}: rate limited`))).toBe(true);
    }
  });

  it('treats network error classes as transient', () => {
    for (const m of ['timeout', 'timed out', 'fetch failed', 'ECONNRESET', 'ETIMEDOUT', 'socket hang up']) {
      expect(defaultIsRetryable(new Error(m))).toBe(true);
    }
  });

  it('does NOT retry auth / not-found (permanent) errors', () => {
    expect(defaultIsRetryable(new Error('openai 401: authentication failed'))).toBe(false);
    expect(defaultIsRetryable(new Error('openai 404: model not found'))).toBe(false);
    expect(defaultIsRetryable(new Error('missing apiKey'))).toBe(false);
  });

  it('coerces non-Error values to string before matching', () => {
    expect(defaultIsRetryable('503 service unavailable')).toBe(true);
    expect(defaultIsRetryable('bad key')).toBe(false);
  });
});

describe('ai resilience · withRetry', () => {
  it('returns immediately on first success (no retries)', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries a transient failure then succeeds', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error('503 service unavailable');
        return 'recovered';
      },
      { sleep: noSleep, rand: fixedRand },
    );
    expect(result).toBe('recovered');
    expect(calls).toBe(3);
  });

  it('throws a permanent error immediately without retrying', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('openai 401: authentication failed');
        },
        { sleep: noSleep, rand: fixedRand },
      ),
    ).rejects.toThrow('401');
    expect(calls).toBe(1);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('429 rate limited');
        },
        { policy: { maxAttempts: 3 }, sleep: noSleep, rand: fixedRand },
      ),
    ).rejects.toThrow('429');
    expect(calls).toBe(3);
  });

  it('applies bounded exponential backoff with full jitter (delays observed via onRetry)', async () => {
    const delays: number[] = [];
    await expect(
      withRetry(
        async () => {
          throw new Error('500 boom');
        },
        {
          policy: { maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 10_000, factor: 2 },
          sleep: noSleep,
          rand: () => 1, // upper edge of the jitter window -> delay == raw
          onRetry: (_attempt, delayMs) => delays.push(delayMs),
        },
      ),
    ).rejects.toThrow('500');
    // raw = base * factor^(attempt-1): 100, 200, 400. rand()=1 -> full raw.
    expect(delays).toEqual([100, 200, 400]);
  });

  it('caps the backoff at maxDelayMs', async () => {
    const delays: number[] = [];
    await expect(
      withRetry(
        async () => {
          throw new Error('503 boom');
        },
        {
          policy: { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 2000, factor: 10 },
          sleep: noSleep,
          rand: () => 1,
          onRetry: (_a, d) => delays.push(d),
        },
      ),
    ).rejects.toThrow('503');
    // raw would be 1000, 10000, 100000, 1000000 -> capped to 1000, 2000, 2000, 2000.
    expect(delays).toEqual([1000, 2000, 2000, 2000]);
  });

  it('honours a custom isRetryable classifier', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('CUSTOM_TRANSIENT');
        },
        {
          policy: { maxAttempts: 2 },
          isRetryable: (e) => e instanceof Error && e.message === 'CUSTOM_TRANSIENT',
          sleep: noSleep,
          rand: fixedRand,
        },
      ),
    ).rejects.toThrow('CUSTOM_TRANSIENT');
    expect(calls).toBe(2);
  });
});

describe('ai resilience · BackpressureLimiter', () => {
  it('runs a task and returns its result', async () => {
    const limiter = new BackpressureLimiter(2);
    await expect(limiter.run(async () => 42)).resolves.toBe(42);
    expect(limiter.inFlight).toBe(0);
    expect(limiter.queued).toBe(0);
  });

  it('caps in-flight tasks at maxConcurrent and queues the rest', async () => {
    const limiter = new BackpressureLimiter(2);
    const release: Array<() => void> = [];
    const gate = () => new Promise<void>((resolve) => release.push(resolve));

    const p1 = limiter.run(() => gate());
    const p2 = limiter.run(() => gate());
    const p3 = limiter.run(() => gate());

    // Let the microtask queue settle so the first two acquire slots.
    await Promise.resolve();
    await Promise.resolve();

    expect(limiter.inFlight).toBe(2);
    expect(limiter.queued).toBe(1);

    // Release the first; the queued third should promote.
    release[0]();
    await Promise.resolve();
    await Promise.resolve();
    expect(limiter.queued).toBe(0);

    release.forEach((r) => r());
    await Promise.all([p1, p2, p3]);
    expect(limiter.inFlight).toBe(0);
  });

  it('rejects with BackpressureError when the wait queue is full', async () => {
    const limiter = new BackpressureLimiter(1, 1); // 1 active + 1 queued max
    // A single shared gate every task awaits, so releasing once settles both the
    // active and the (later-promoted) queued task without dynamic-release bookkeeping.
    let releaseAll!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseAll = resolve;
    });

    const p1 = limiter.run(() => gate); // active
    const p2 = limiter.run(() => gate); // queued (fills the 1 queue slot)
    await Promise.resolve();

    // active(1) is full AND queue(1) is full -> the third call fails closed.
    await expect(limiter.run(async () => 'overflow')).rejects.toBeInstanceOf(BackpressureError);

    releaseAll();
    await Promise.all([p1, p2]);
    expect(limiter.inFlight).toBe(0);
    expect(limiter.queued).toBe(0);
  });

  it('decrements in-flight even when the task throws', async () => {
    const limiter = new BackpressureLimiter(1);
    await expect(limiter.run(async () => {
      throw new Error('task failed');
    })).rejects.toThrow('task failed');
    expect(limiter.inFlight).toBe(0);
    // A subsequent task still runs (the slot was freed).
    await expect(limiter.run(async () => 'ok')).resolves.toBe('ok');
  });
});
