/**
 * Contract of /api/track-record - the measured-performance surface. Two paths matter:
 * with no Supabase env it must serve an honest EMPTY record (never a decorative win rate),
 * and with real rows it must return the deterministic aggregate the UI trusts. The route is
 * also the enforcement point for "no history -> say so", so both are pinned here.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => hoisted.client,
}));

// Rate limiter degrades to in-memory allow in tests; keep it out of the way.
vi.mock('@/lib/ratelimit', () => ({
  rateLimitShared: async () => ({ allowed: true, remaining: 100, retryAfterSec: 0 }),
}));

import { GET } from '../route';

function request(): NextRequest {
  return new NextRequest('http://localhost/api/track-record');
}

/** A Supabase-like client whose query chain resolves to the given rows. */
function clientWithRows(rows: unknown[]) {
  const chain = {
    select: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: rows, error: null }),
  };
  return { from: () => chain };
}

describe('GET /api/track-record', () => {
  afterEach(() => {
    hoisted.client = null;
  });

  it('serves an honest EMPTY record when Supabase is not configured', async () => {
    hoisted.client = null;
    const res = await GET(request());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; demo?: boolean; provenance: string; groups: unknown[] };
    expect(data.ok).toBe(true);
    expect(data.demo).toBe(true);
    expect(data.provenance).toBe('empty');
    expect(data.groups).toEqual([]);
  });

  it('aggregates real rows into measured per-status stats with the friction-floor win rate', async () => {
    hoisted.client = clientWithRows([
      // strong_setup: +5 win, +0.1 below floor (not a win), -2 loss => 1/3 clears 0.3%
      { signal_type: 'momentum_recovery_v1', signal_status: 'strong_setup', return_20d: 5, signal_candle_time: '2026-07-10T00:00:00Z' },
      { signal_type: 'momentum_recovery_v1', signal_status: 'strong_setup', return_20d: 0.1, signal_candle_time: '2026-07-11T00:00:00Z' },
      { signal_type: 'momentum_recovery_v1', signal_status: 'strong_setup', return_20d: -2, signal_candle_time: '2026-07-12T00:00:00Z' },
    ]);
    const res = await GET(request());
    const data = (await res.json()) as {
      provenance: string;
      totalOutcomes: number;
      window: { from: string; to: string } | null;
      groups: { signalStatus: string; horizons: { horizon: string; n: number; winRatePct: number | null }[] }[];
    };
    expect(data.provenance).toBe('measured');
    expect(data.totalOutcomes).toBe(3);
    expect(data.window).toEqual({ from: '2026-07-10', to: '2026-07-12' });
    const h20 = data.groups[0].horizons.find((h) => h.horizon === '20d')!;
    expect(h20.n).toBe(3);
    expect(h20.winRatePct).toBeCloseTo(33.333, 2); // 1 of 3 beats the 0.3% floor
  });

  it('falls back to empty (not a crash) when the query errors', async () => {
    const chain = {
      select: () => chain,
      order: () => chain,
      limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
    };
    hoisted.client = { from: () => chain };
    const res = await GET(request());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { provenance: string };
    expect(data.provenance).toBe('empty');
  });
});
