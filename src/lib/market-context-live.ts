/**
 * Server-side market/macro context reads - the first READER of market_context_snapshots.
 *
 * The worker has computed a full macro snapshot every hour (indices, VIX, yields, gold,
 * oil, BTC, AUD/USD, fear/greed, regime) since sql/002 - and nothing ever read it. Worse,
 * a NOT NULL captured_at the insert never supplied meant nothing was ever WRITTEN either
 * (fixed in v0.46.0). This module closes the read side: latest snapshot with the same
 * degrade-to-sample contract as calendar-live.ts - unconfigured, empty table, or any
 * error returns the demo snapshot, clearly marked, never a throw to the page.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  demoMarketContext,
  type MarketContextSnapshot,
  type MarketRegime,
} from '@/lib/market-context';
import { getMacroContext, type MacroSnapshot } from '@/lib/macro-context';

interface SnapshotRow {
  captured_at?: string | null;
  regime?: string | null;
  payload?: Record<string, unknown> | null;
}

function num(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const REGIMES: ReadonlySet<string> = new Set(['risk_on', 'neutral', 'risk_off']);

/** Latest hourly snapshot, mapped to the frontend shape. Sample fallback on any gap. */
export async function getMarketContextLive(): Promise<MarketContextSnapshot> {
  const sample: MarketContextSnapshot = { ...demoMarketContext, source: 'sample' };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return sample;

  try {
    const { data, error } = await supabase
      .from('market_context_snapshots')
      .select('captured_at, regime, payload')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return sample;
    const row = data as SnapshotRow;
    const payload = row.payload;
    if (!payload || typeof payload !== 'object') return sample;

    const regime = REGIMES.has(String(row.regime)) ? (row.regime as MarketRegime) : 'neutral';
    return {
      capturedAt: row.captured_at ?? String(payload.captured_at ?? new Date().toISOString()),
      sp500Price: num(payload, 'sp500_price'),
      sp500ChangePct: num(payload, 'sp500_change_pct'),
      nasdaqPrice: num(payload, 'nasdaq_price'),
      nasdaqChangePct: num(payload, 'nasdaq_change_pct'),
      dowPrice: num(payload, 'dow_price'),
      dowChangePct: num(payload, 'dow_change_pct'),
      vixPrice: num(payload, 'vix_price'),
      vixChangePct: num(payload, 'vix_change_pct'),
      yield10y: num(payload, 'yield_10y'),
      yield10yChangePct: num(payload, 'yield_10y_change_pct'),
      goldPrice: num(payload, 'gold_price'),
      goldChangePct: num(payload, 'gold_change_pct'),
      oilPrice: num(payload, 'oil_price'),
      oilChangePct: num(payload, 'oil_change_pct'),
      btcPrice: num(payload, 'btc_price'),
      btcChangePct: num(payload, 'btc_change_pct'),
      fearGreedIndex: num(payload, 'fear_greed_index'),
      fearGreedLabel: typeof payload.fear_greed_label === 'string' ? payload.fear_greed_label : null,
      regime,
      source: 'live',
    };
  } catch {
    return sample;
  }
}

/**
 * Macro snapshot with LIVE overlays where the hourly capture already has truth:
 * AUD/USD and the ASX 200 come off the latest snapshot when present; the structural
 * rows (cash rate, CPI, jobs) stay seeded until their RBA/ABS fetchers land. The
 * overlaid labels are reported so the strip can badge honestly - "sample" only while
 * NOTHING is live, "partly live" once these series flow.
 */
export async function getMacroContextLive(countryCode = 'AU'): Promise<MacroSnapshot> {
  const base = await getMacroContext(countryCode);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return base;

  try {
    const { data, error } = await supabase
      .from('market_context_snapshots')
      .select('captured_at, payload')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return base;
    const row = data as SnapshotRow;
    const payload = row.payload;
    if (!payload || typeof payload !== 'object') return base;

    const overlays: string[] = [];
    const indicators = base.indicators.map((indicator) => {
      if (indicator.label === 'AUD/USD') {
        const price = num(payload, 'audusd_price');
        const change = num(payload, 'audusd_change_pct');
        if (price !== null) {
          overlays.push(indicator.label);
          return {
            ...indicator,
            value: price.toFixed(4),
            change: change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : undefined,
            direction: change === null ? undefined : change > 0 ? ('up' as const) : change < 0 ? ('down' as const) : ('flat' as const),
          };
        }
      }
      if (indicator.label === 'ASX 200') {
        const price = num(payload, 'axjo_price');
        const change = num(payload, 'axjo_change_pct');
        if (price !== null) {
          overlays.push(indicator.label);
          return {
            ...indicator,
            value: price.toLocaleString('en-AU', { maximumFractionDigits: 1 }),
            change: change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : undefined,
            direction: change === null ? undefined : change > 0 ? ('up' as const) : change < 0 ? ('down' as const) : ('flat' as const),
          };
        }
      }
      return indicator;
    });

    if (overlays.length === 0) return base;
    return {
      ...base,
      indicators,
      liveOverlay: overlays,
      asOf: (row.captured_at ?? base.asOf).slice(0, 10),
    };
  } catch {
    return base;
  }
}
