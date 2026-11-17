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
import { getMacroContext, type MacroIndicator, type MacroSnapshot, type MacroStance } from '@/lib/macro-context';
import { getEconomySnapshot } from '@/lib/economy/snapshot';
import { periodLabel } from '@/lib/economy/period';
import type { EconomyIndicator } from '@/lib/economy/types';

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
 * How long the Command page waits for the economy figures before drawing the strip without
 * them. A cold ABS read is ~24 parallel requests; cached it is instant. A hung statistics API
 * must never hold up the dense desk, so past this budget the strip keeps its badged seed rows.
 */
const ECONOMY_OVERLAY_BUDGET_MS = 4000;

/** Signed and fixed, with the sign judged on the ROUNDED value - 0.001 is "0.00", not "+0.00". */
const signedFixed = (v: number, dp: number) => {
  const r = Number(v.toFixed(dp));
  return `${r > 0 ? '+' : r < 0 ? '-' : ''}${Math.abs(r).toFixed(dp)}`;
};
/** The change text, or nothing when it rounds to zero - "4.7% - 0.0 -" reads like a range. */
const changeOrNone = (diff: number, dp: number): string | undefined => {
  if (!Number.isFinite(diff) || Number(diff.toFixed(dp)) === 0) return undefined;
  return signedFixed(diff, dp);
};
const liveValue = (i: EconomyIndicator | undefined): i is EconomyIndicator =>
  !!i && i.provenance === 'live' && Number.isFinite(i.value);

/**
 * The strip's structural rows, rebuilt from the live ABS/RBA read. Every note here is a FACT
 * derived from the same figures - the seeded notes ("gives room to keep easing") were authored
 * opinions that turned false the moment inflation went the other way, which is exactly what
 * happened: the seed said 2.8% CPI and "RBA easing" while the real figures were 4.3% and rising.
 */
export function macroRowsFromEconomy(indicators: EconomyIndicator[]): {
  rows: Record<string, Partial<MacroIndicator>>;
  stance?: { stance: MacroStance; label: string };
} {
  const by = (id: string) => indicators.find((i) => i.id === id);
  const rows: Record<string, Partial<MacroIndicator>> = {};
  let stance: { stance: MacroStance; label: string } | undefined;

  const cash = by('cashRate');
  if (liveValue(cash)) {
    const diff = Number.isFinite(cash.previous) ? cash.value - cash.previous : Number.NaN;
    rows['Cash rate'] = {
      value: `${cash.value.toFixed(2)}%`,
      change: changeOrNone(diff, 2),
      direction: cash.direction,
      source: 'RBA',
      sourceUrl: cash.sourceUrl,
      implication: `${periodLabel(cash.period)} average`,
    };
    stance =
      cash.direction === 'up'
        ? { stance: 'tightening', label: 'Cash rate rising' }
        : cash.direction === 'down'
          ? { stance: 'easing', label: 'Cash rate falling' }
          : { stance: 'hold', label: 'Cash rate steady' };
  }

  const cpi = by('cpi');
  const trimmed = by('cpiTrimmed');
  if (liveValue(cpi)) {
    const band = liveValue(trimmed)
      ? trimmed.value > 3
        ? 'above'
        : trimmed.value < 2
          ? 'below'
          : 'inside'
      : null;
    rows['CPI (YoY)'] = {
      value: `${cpi.value.toFixed(1)}%`,
      change: changeOrNone(cpi.value - cpi.previous, 1),
      direction: cpi.direction,
      source: 'ABS',
      sourceUrl: cpi.sourceUrl,
      implication: band
        ? `underlying ${trimmed!.value.toFixed(1)}% - ${band} the RBA 2-3% band`
        : `${periodLabel(cpi.period)}`,
    };
  }

  const unemp = by('unemployment');
  const under = by('underemployment');
  if (liveValue(unemp)) {
    rows['Unemployment'] = {
      value: `${unemp.value.toFixed(1)}%`,
      change: changeOrNone(Number(unemp.value.toFixed(1)) - Number(unemp.previous.toFixed(1)), 1),
      direction: unemp.direction,
      source: 'ABS',
      sourceUrl: unemp.sourceUrl,
      implication: liveValue(under) ? `${under.value.toFixed(1)}% of workers want more hours` : periodLabel(unemp.period),
    };
  }

  const gdp = by('gdp');
  const pc = by('gdpPerCapita');
  if (liveValue(gdp) && Number.isFinite(gdp.annual)) {
    rows['GDP (YoY)'] = {
      value: `${gdp.annual.toFixed(1)}%`,
      change: `${signedFixed(gdp.value, 1)}% qtr`,
      direction: gdp.direction,
      source: 'ABS',
      sourceUrl: gdp.sourceUrl,
      implication:
        liveValue(pc) && Number.isFinite(pc.annual)
          ? `${pc.annual.toFixed(1)}% per person over the same year`
          : `year to the ${periodLabel(gdp.period)}`,
    };
  }

  const wages = by('wages');
  const real = by('realWages');
  if (liveValue(wages)) {
    rows['Wages (WPI)'] = {
      value: `${wages.value.toFixed(1)}%`,
      change: changeOrNone(wages.value - wages.previous, 1),
      direction: wages.direction,
      source: 'ABS',
      sourceUrl: wages.sourceUrl,
      implication: liveValue(real)
        ? Math.abs(real.value) < 0.05
          ? 'keeping pace with prices'
          : `pay ${real.value < 0 ? 'behind' : 'ahead of'} prices by ${Math.abs(real.value).toFixed(1)}% over the year`
        : periodLabel(wages.period),
    };
  }

  return { rows, stance };
}

/** Resolve within `ms`, or null - the economy read never gets to stall the Command page. */
async function withinBudget<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([work.catch(() => null), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readMarketSnapshotRow(): Promise<SnapshotRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('market_context_snapshots')
      .select('captured_at, payload')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as SnapshotRow;
    return row.payload && typeof row.payload === 'object' ? row : null;
  } catch {
    return null;
  }
}

/**
 * Macro snapshot with LIVE overlays wherever there is truth:
 * - the structural rows (cash rate, CPI, unemployment, GDP, wages) from the live ABS/RBA read
 *   (src/lib/economy) - they no longer need Supabase, so they overlay even without it;
 * - AUD/USD and the ASX 200 from the latest hourly market snapshot.
 * Overlaid labels are reported so the strip badges honestly: 'Sample' while nothing is live,
 * 'Partial' while some seeded rows remain, and no badge at all once every row is live.
 */
export async function getMacroContextLive(
  countryCode = 'AU',
  options: { economyBudgetMs?: number } = {},
): Promise<MacroSnapshot> {
  const base = await getMacroContext(countryCode);
  const [row, economy] = await Promise.all([
    readMarketSnapshotRow(),
    withinBudget(getEconomySnapshot(), options.economyBudgetMs ?? ECONOMY_OVERLAY_BUDGET_MS),
  ]);
  const payload = row?.payload ?? null;
  const fromEconomy = economy ? macroRowsFromEconomy(economy.indicators) : { rows: {} };

  const overlays: string[] = [];
  const indicators = base.indicators.map((indicator) => {
    const econRow = fromEconomy.rows[indicator.label];
    if (econRow) {
      overlays.push(indicator.label);
      return { ...indicator, ...econRow };
    }
    if (payload && indicator.label === 'AUD/USD') {
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
    if (payload && indicator.label === 'ASX 200') {
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
  const allLive = overlays.length === base.indicators.length;
  return {
    ...base,
    ...(fromEconomy.stance ? { stance: fromEconomy.stance.stance, stanceLabel: fromEconomy.stance.label } : {}),
    indicators,
    liveOverlay: overlays,
    isDemo: !allLive,
    asOf: (row?.captured_at ?? base.asOf).slice(0, 10),
  };
}
