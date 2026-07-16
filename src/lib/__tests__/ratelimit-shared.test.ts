import { describe, it, expect } from 'vitest';
import { rateLimitShared, resetRateLimits } from '@/lib/ratelimit';

/**
 * With no Upstash env (the test environment), rateLimitShared must degrade to the in-memory limiter
 * rather than fail open. This proves the fallback path: capacity is still enforced.
 */
describe('rateLimitShared · degrades to in-memory without Upstash', () => {
  it('allows up to capacity then blocks', async () => {
    resetRateLimits();
    const id = 'user-x';
    const opts = { scope: 'test-shared', capacity: 3, windowMs: 60_000 };
    const now = 1_000_000;

    const r1 = await rateLimitShared(id, opts, now);
    const r2 = await rateLimitShared(id, opts, now);
    const r3 = await rateLimitShared(id, opts, now);
    const r4 = await rateLimitShared(id, opts, now);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfterSec).toBeGreaterThan(0);
  });
});
