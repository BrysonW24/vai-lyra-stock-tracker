/**
 * GET /api/updates/facts - the facts the writer starts from. Pins that a session's facts are
 * computed ONCE and then served unchanged (a published read quotes their hash), that a second caller
 * arriving mid-computation waits instead of starting another fan-out against the price source, and
 * that facts already served for a session are never overwritten by a later computation.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishedRead } from '@/lib/updates/store';

type StoredFacts = { session: string; hash: string; rows: unknown[]; listed: number; computedAt: string };

const state = vi.hoisted(() => ({
  available: true,
  allowed: true,
  probe: '2026-11-05' as string | null,
  lock: true,
  compute: null as null | (() => Promise<unknown>),
  computeCalls: 0,
  facts: new Map<string, StoredFacts>(),
  reads: new Map<string, PublishedRead>(),
  saves: [] as StoredFacts[],
}));

vi.mock('@/lib/ratelimit', () => ({
  rateLimitShared: async () => (state.allowed ? { allowed: true, remaining: 19, retryAfterSec: 0 } : { allowed: false, remaining: 0, retryAfterSec: 42 }),
}));

vi.mock('@/lib/updates/facts', () => ({
  currentSession: async () => state.probe,
  computeSessionFacts: async () => {
    state.computeCalls += 1;
    return state.compute ? state.compute() : { ok: false, reason: 'no_prices', covered: 0, listed: 0 };
  },
}));

vi.mock('@/lib/updates/store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/updates/store')>('@/lib/updates/store');
  const guard = () => {
    if (!state.available) throw new actual.StoreUnavailableError();
  };
  return {
    ...actual,
    updatesAvailable: () => state.available,
    loadFacts: async (session: string) => {
      guard();
      return state.facts.get(session) ?? null;
    },
    saveFacts: async (facts: StoredFacts) => {
      guard();
      state.facts.set(facts.session, facts);
      state.saves.push(facts);
    },
    loadRead: async (session: string) => state.reads.get(session) ?? null,
    tryLock: async () => state.lock,
  };
});

import { GET } from '../route';

const facts = (session: string, hash = 'c'.repeat(64)): StoredFacts => ({
  session,
  hash,
  rows: [{ symbol: 'NVDA', category: 'ai_infrastructure', stock_signals: [], stock_candles: [] }],
  listed: 61,
  computedAt: '2026-11-06T09:05:00.000Z',
});

async function get() {
  const response = await GET(new NextRequest('http://localhost/api/updates/facts', { headers: { 'x-forwarded-for': '203.0.113.9' } }));
  const body = (await response.json()) as Record<string, unknown>;
  const result: Record<string, unknown> & { status: number; retryAfter: string | null } = {
    status: response.status,
    retryAfter: response.headers.get('Retry-After'),
    ...body,
  };
  return result;
}

describe('GET /api/updates/facts', () => {
  beforeEach(() => {
    state.available = true;
    state.allowed = true;
    state.probe = '2026-11-05';
    state.lock = true;
    state.compute = null;
    state.computeCalls = 0;
    state.facts.clear();
    state.reads.clear();
    state.saves.length = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it('serves stored facts unchanged, and says whether the session has its read', async () => {
    state.facts.set('2026-11-05', facts('2026-11-05'));
    const first = await get();
    expect(first).toMatchObject({ status: 200, ok: true, published: false, session: '2026-11-05', hash: 'c'.repeat(64), listed: 61 });
    expect(first.rows).toHaveLength(1);
    expect(state.computeCalls).toBe(0);

    state.reads.set('2026-11-05', { kind: 'market_read', session: '2026-11-05', factsHash: 'c'.repeat(64), publishedAt: 'x', figures: [], prose: null, proseNote: null, writer: null });
    expect(await get()).toMatchObject({ status: 200, ok: true, published: true });
  });

  it('computes a session once, stores it, and serves it to everyone after', async () => {
    state.compute = async () => ({ ok: true, facts: facts('2026-11-05', 'd'.repeat(64)) });
    expect(await get()).toMatchObject({ status: 200, ok: true, published: false, session: '2026-11-05', hash: 'd'.repeat(64) });
    expect(state.saves).toHaveLength(1);
    expect(await get()).toMatchObject({ status: 200, ok: true, hash: 'd'.repeat(64) });
    expect(state.computeCalls).toBe(1);
  });

  it('tells a caller arriving mid-computation to come back, without a second fan-out', async () => {
    state.lock = false;
    state.compute = async () => ({ ok: true, facts: facts('2026-11-05') });
    const result = await get();
    expect(result).toMatchObject({ status: 202, ok: false, reason: 'computing' });
    expect(result.retryAfter).toBe('20');
    expect(state.computeCalls).toBe(0);
  });

  it('stores under the session the names agreed on, which may differ from the probe', async () => {
    // The probe says the 5th; most names turn out to be on the 4th (the 5th's bars not all settled).
    state.compute = async () => ({ ok: true, facts: facts('2026-11-04') });
    expect(await get()).toMatchObject({ status: 200, ok: true, session: '2026-11-04' });
    expect(state.facts.has('2026-11-04')).toBe(true);
    expect(state.facts.has('2026-11-05')).toBe(false);
  });

  it('never overwrites facts already served for a session - a read quoting their hash may be on its way', async () => {
    // Two instances computed at once; the other one stored first.
    state.compute = async () => {
      state.facts.set('2026-11-05', facts('2026-11-05', 'e'.repeat(64)));
      return { ok: true, facts: facts('2026-11-05', 'f'.repeat(64)) };
    };
    expect(await get()).toMatchObject({ status: 200, ok: true, hash: 'e'.repeat(64) });
    expect(state.saves).toHaveLength(0);
  });

  it('refuses when too few names agree on a session, saying how many did', async () => {
    state.compute = async () => ({ ok: false, reason: 'thin', covered: 20, listed: 61 });
    expect(await get()).toMatchObject({ status: 503, ok: false, reason: 'thin', covered: 20, listed: 61 });
    expect(state.saves).toHaveLength(0);
  });

  it('refuses when there are no prices at all', async () => {
    state.probe = null;
    expect(await get()).toMatchObject({ status: 503, ok: false, reason: 'no_prices' });
    expect(state.computeCalls).toBe(0);
  });

  it('is rate limited per caller', async () => {
    state.allowed = false;
    const result = await get();
    expect(result).toMatchObject({ status: 429, ok: false, reason: 'rate_limited' });
    expect(result.retryAfter).toBe('42');
  });

  it('says plainly when updates are not switched on', async () => {
    state.available = false;
    expect(await get()).toMatchObject({ status: 503, ok: false, reason: 'not_configured' });
  });
});
