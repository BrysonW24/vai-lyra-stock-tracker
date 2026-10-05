import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { aggregateTrackRecord, type OutcomeRow, type TrackRecord } from '@/lib/track-record';
import { rateLimitShared } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';
import { fetchAllRows } from '@/lib/supabase/paging';

/**
 * Public, read-only measured track record of Lyra's live signals, aggregated from real
 * signal_outcomes rows (global-read research data, no user scope). The deterministic
 * aggregation owns every number; this route only fetches rows and returns the result plus
 * the window it was measured over, so the UI can state sample size and dates honestly.
 *
 * Demo-safe: when Supabase is not configured, or no outcomes exist yet, provenance is
 * 'empty' and the UI says "not yet measured" - never a decorative win rate.
 */

export const dynamic = 'force-dynamic';

// The record is ALL-TIME, so it must be built from every row. One request cannot do that:
// PostgREST returns at most 1000 rows whatever the limit says (see lib/supabase/paging). This
// route asked for 5000, silently received 1000 of 1,587, and reported that as the whole history.

interface WindowRow extends OutcomeRow {
  signal_candle_time: string | null;
}

export async function GET(request: NextRequest) {
  const limited = await rateLimitShared(clientIp(request), {
    scope: 'track-record',
    capacity: 30,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Rate limit exceeded.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
    );
  }

  const empty: TrackRecord & { window: null } = {
    provenance: 'empty',
    totalOutcomes: 0,
    signalTypes: [],
    groups: [],
    window: null,
  };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: true, demo: true, ...empty });

  try {
    // `id` breaks ties so a page boundary can never repeat or skip a row (many outcomes share a
    // candle time).
    const { rows, complete } = await fetchAllRows<WindowRow>((from, to) =>
      supabase
        .from('signal_outcomes')
        .select('signal_type, signal_status, return_1d, return_5d, return_20d, return_60d, signal_candle_time')
        .order('signal_candle_time', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    );

    // Part of the history is not the history: never publish a partial aggregate as the record.
    if (!complete) return NextResponse.json({ ok: true, demo: true, ...empty });
    const record = aggregateTrackRecord(rows);

    // Honest window: the first/last labelled signal this aggregate covers.
    const times = rows.map((r) => r.signal_candle_time).filter((t): t is string => Boolean(t)).sort();
    const window = times.length
      ? { from: times[0].slice(0, 10), to: times[times.length - 1].slice(0, 10) }
      : null;

    return NextResponse.json({ ok: true, ...record, window });
  } catch {
    return NextResponse.json({ ok: true, demo: true, ...empty });
  }
}
