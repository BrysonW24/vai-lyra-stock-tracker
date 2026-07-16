import { type NextRequest, NextResponse } from 'next/server';
import { buildLiveSignal } from '@/lib/live-signals';
import { getOutcomeDistribution, formatOutcomeSummary } from '@/lib/outcomes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';

/**
 * Per-symbol signal refresh: the deterministic engine recomputed NOW for one name,
 * plus how similar past setups actually resolved (live signal_outcomes aggregate when
 * enough history exists, honest sample data otherwise). Powers the SignalDrawer's
 * refetch-on-open so an explainer opened minutes after page load shows current
 * numbers, not the page-load snapshot. Demo-safe: unconfigured Supabase just skips
 * the live outcome aggregate.
 */

const SYMBOL_RE = /^[A-Z0-9.\-]{1,10}$/;
// A win rate on a handful of samples is noise. Require a real sample before showing a measured
// aggregate, and caveat it as low-confidence until the sample is comfortably large.
const MIN_LIVE_SAMPLE = 20;
const LOW_CONFIDENCE_BELOW = 40;
// A move under round-trip friction is not a win - counting break-evens as wins inflates the rate.
const WIN_THRESHOLD_PCT = 0.3;

interface OutcomeRow {
  return_20d: number | null;
  return_5d: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Aggregate real labeled outcomes for this signal status; null when history is thin. */
async function liveOutcomeSummary(status: string): Promise<{ summary: string; sampleSize: number } | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('signal_outcomes')
      .select('return_20d, return_5d')
      .eq('signal_status', status)
      .limit(500);
    if (error || !data) return null;

    const rows = (data as OutcomeRow[]).filter((r) => r.return_20d !== null);
    if (rows.length < MIN_LIVE_SAMPLE) return null;

    const returns = rows.map((r) => r.return_20d as number);
    const med = median(returns);
    if (med === null) return null;
    const winRate = Math.round((returns.filter((r) => r > WIN_THRESHOLD_PCT).length / returns.length) * 100);
    const caveat = rows.length < LOW_CONFIDENCE_BELOW ? ' Small sample - low confidence.' : '';
    const summary = `${rows.length} past signal${rows.length !== 1 ? 's' : ''} returned ${med > 0 ? '+' : ''}${med.toFixed(1)}% over 20 days (${winRate}% win rate).${caveat}`;
    return { summary, sampleSize: rows.length };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  // Unauthenticated Yahoo-backed refresh - same abuse damping as ticker-lookup.
  const rl = rateLimit(`ip:${clientIp(request)}`, { scope: 'signals', capacity: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase().trim();
  if (!SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ ok: false, reason: 'bad_symbol' }, { status: 400 });
  }

  const signal = await buildLiveSignal(symbol);
  if (!signal) {
    return NextResponse.json({ ok: false, reason: 'unavailable' });
  }

  const status = typeof signal.status === 'string' ? signal.status : 'inactive';
  const live = await liveOutcomeSummary(status);
  const outcome = live
    ? { summary: live.summary, sampleSize: live.sampleSize, source: 'live' as const, provenance: 'measured' as const }
    : (() => {
        const dist = getOutcomeDistribution('momentum_recovery_v1', status);
        return dist
          ? { summary: formatOutcomeSummary(dist), sampleSize: dist.sampleSize, source: 'sample' as const, provenance: 'illustrative' as const }
          : null;
      })();

  return NextResponse.json({ ok: true, asOf: new Date().toISOString(), signal, outcome });
}
