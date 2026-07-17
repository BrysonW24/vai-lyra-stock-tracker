import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Proves the WHOLE POINT of the shared limiter: one global budget across serverless instances.
 *
 * We mock `@/lib/cache`'s upstashCommand with a process-wide Map that implements INCR/EXPIRE -
 * i.e. ONE Redis every "instance" talks to. Then we clear the in-memory buckets between calls to
 * simulate a request landing on a fresh, cold instance. With per-instance limiting the fresh
 * instance would allow the over-budget request; with the shared counter it is blocked. That gap
 * is exactly what wiring `rateLimitShared` onto the routes buys.
 */

const redis = new Map<string, number>();
vi.mock('@/lib/cache', () => ({
  upstashCommand: async (cmd: Array<string | number>) => {
    const op = String(cmd[0]);
    const key = String(cmd[1]);
    if (op === 'INCR') {
      const next = (redis.get(key) ?? 0) + 1;
      redis.set(key, next);
      return next;
    }
    if (op === 'EXPIRE') return 1; // TTL set is best-effort; value is ignored by the limiter
    return null;
  },
}));

import { rateLimitShared, resetRateLimits } from '@/lib/ratelimit';

describe('rateLimitShared · one global limit across instances (Upstash-backed)', () => {
  beforeEach(() => {
    redis.clear();
    resetRateLimits();
  });

  it('a fresh instance (in-memory buckets cleared) is still blocked by the shared counter', async () => {
    const id = 'ip:1.2.3.4';
    const opts = { scope: 'signals', capacity: 3, windowMs: 60_000 };
    const now = 1_000_000;

    // Instance A serves the full budget - shared counter climbs to 3.
    expect((await rateLimitShared(id, opts, now)).allowed).toBe(true);
    expect((await rateLimitShared(id, opts, now)).allowed).toBe(true);
    expect((await rateLimitShared(id, opts, now)).allowed).toBe(true);

    // Instance B: brand-new process, empty in-memory buckets. Per-instance limiting would ALLOW here.
    resetRateLimits();

    // The shared Redis counter is already at capacity, so the 4th request is blocked GLOBALLY.
    const onFreshInstance = await rateLimitShared(id, opts, now);
    expect(onFreshInstance.allowed).toBe(false);
    expect(onFreshInstance.retryAfterSec).toBeGreaterThan(0);
  });

  it('keeps budgets independent per scope and per identity', async () => {
    const now = 2_000_000;
    const opts = (scope: string) => ({ scope, capacity: 1, windowMs: 60_000 });

    expect((await rateLimitShared('ip:a', opts('lookup'), now)).allowed).toBe(true);
    expect((await rateLimitShared('ip:a', opts('lookup'), now)).allowed).toBe(false); // same key, over budget
    expect((await rateLimitShared('ip:b', opts('lookup'), now)).allowed).toBe(true); // different identity
    expect((await rateLimitShared('ip:a', opts('feedback'), now)).allowed).toBe(true); // different scope
  });
});
