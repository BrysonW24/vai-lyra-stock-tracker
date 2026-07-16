import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, resetRateLimits } from '@/lib/ratelimit';

describe('rateLimit token bucket', () => {
  beforeEach(() => resetRateLimits());

  it('allows up to capacity, then blocks', () => {
    const opts = { scope: 'test', capacity: 3, windowMs: 60_000 };
    const now = 1_000_000;
    expect(rateLimit('a', opts, now).allowed).toBe(true);
    expect(rateLimit('a', opts, now).allowed).toBe(true);
    expect(rateLimit('a', opts, now).allowed).toBe(true);
    const blocked = rateLimit('a', opts, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('keeps identities independent', () => {
    const opts = { scope: 'test', capacity: 1, windowMs: 60_000 };
    const now = 2_000_000;
    expect(rateLimit('user-a', opts, now).allowed).toBe(true);
    expect(rateLimit('user-b', opts, now).allowed).toBe(true); // different identity, own budget
    expect(rateLimit('user-a', opts, now).allowed).toBe(false);
  });

  it('scopes are independent budgets', () => {
    const now = 3_000_000;
    expect(rateLimit('x', { scope: 'ai', capacity: 1, windowMs: 60_000 }, now).allowed).toBe(true);
    expect(rateLimit('x', { scope: 'ai', capacity: 1, windowMs: 60_000 }, now).allowed).toBe(false);
    // Same identity, different scope -> fresh budget.
    expect(rateLimit('x', { scope: 'lookup', capacity: 1, windowMs: 60_000 }, now).allowed).toBe(true);
  });

  it('refills over time', () => {
    const opts = { scope: 'test', capacity: 2, windowMs: 60_000 };
    const t0 = 4_000_000;
    expect(rateLimit('a', opts, t0).allowed).toBe(true);
    expect(rateLimit('a', opts, t0).allowed).toBe(true);
    expect(rateLimit('a', opts, t0).allowed).toBe(false);
    // Half the window later, one token has refilled.
    expect(rateLimit('a', opts, t0 + 30_000).allowed).toBe(true);
  });
});
