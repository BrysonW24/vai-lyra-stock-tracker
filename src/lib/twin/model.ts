/**
 * Digital Trading Twin - the deterministic preference / attention / revealed-risk MODEL.
 *
 * This is the "twin itself": a PURE function (like signal-intelligence.ts and small-cap-lifecycle.ts)
 * that reads a user's own behavioural data - what they watch, what they paper-trade - and derives a
 * standing model of their interests, habits, and revealed risk posture. No LLM. No writes. No engine
 * decisions. It only ever describes the user back to themselves.
 *
 * Doctrine (docs/strategy/2026-07-16-digital-trading-twin.md): a PREFERENCE / ATTENTION model, NEVER
 * a decision model. It learns where you look and how you weigh risk - never "what to buy". The
 * deterministic score still owns every signal; this only informs what to surface and how to frame it.
 *
 * The DB read lives in src/lib/twin/repo.ts; this module stays pure so it is trivially testable and
 * runs identically in demo, tests, and prod.
 */
import { recencyWeight, type SignalKind } from '@/lib/signal-intelligence';
import { LIFECYCLE_ORDER, type LifecycleStage } from '@/lib/small-cap-lifecycle';

export const TWIN_MODEL_VERSION = 1;

/** Below this many behavioural events the twin is too thin to reflect - surfaces degrade to empty. */
export const MIN_TWIN_EVENTS = 3;

/** Acting (a paper trade) is a stronger revealed signal than watching, which beats passive attention. */
const TRADE_WEIGHT = 1.5;
const WATCH_WEIGHT = 1.0;
const ATTENTION_WEIGHT = 0.5;
/** Undated events still count, at a floor recency, so a thin history is not silently dropped. */
const UNDATED_RECENCY = 45;

const EARLY_STAGES: LifecycleStage[] = ['concept', 'funded', 'contracted'];
const LATE_STAGES: LifecycleStage[] = ['scaling', 'crowded'];

// --- Inputs (pure; the repo maps DB rows onto these) ---------------------------------------------

export interface TwinTradeEvent {
  symbol: string;
  theme?: string | null;
  /** Convergence signal kinds present at entry (from signal_snapshot). */
  signalKinds?: SignalKind[];
  /** Lifecycle stage at entry (from signal_snapshot / stage-at-add). */
  stage?: LifecycleStage | null;
  /** ISO open time - drives recency + after-loss sequencing. */
  openedAt?: string | null;
  /** ISO close time - a trade is "closed" for after-loss detection once this is set. */
  closedAt?: string | null;
  /** Position notional at entry (entry_price * quantity) - revealed sizing. */
  notional?: number | null;
  /** Realised P/L on close - negative marks a losing close. */
  realisedPnl?: number | null;
}

export interface TwinWatchEvent {
  symbol: string;
  theme?: string | null;
  signalKinds?: SignalKind[];
  /** Lifecycle stage the name was in when added (state-at-add, migration 034). */
  stage?: LifecycleStage | null;
  addedAt?: string | null;
}

/** Passive attention (a ticker/theme/convergence opened) - the lowest-weight affinity signal. */
export interface TwinAttentionEvent {
  symbol?: string | null;
  theme?: string | null;
  signalKinds?: SignalKind[];
  stage?: LifecycleStage | null;
  at?: string | null;
}

export interface TwinInputs {
  trades: TwinTradeEvent[];
  watches: TwinWatchEvent[];
  /** Opt-in attention capture (interaction_events). Enriches affinities; never affects revealed risk. */
  attention?: TwinAttentionEvent[];
  /** Account capital (starting cash / cash available) - denominator for size-as-%-of-capital. */
  capital?: number | null;
}

// --- Outputs -------------------------------------------------------------------------------------

export interface Affinity<T extends string = string> {
  key: T;
  /** Recency-weighted affinity mass. */
  weight: number;
  /** Raw event count contributing to this key. */
  count: number;
  /** This key's share of the dimension's total weight, 0-100. */
  sharePct: number;
}

export interface RevealedRisk {
  tradeCount: number;
  avgNotional: number | null;
  /** avgNotional as a % of capital (null when capital unknown). */
  avgSizePctOfCap: number | null;
  /** (avg size on trades opened right after a losing close - baseline) / baseline, as %. */
  sizeAfterLossDeltaPct: number | null;
  /** Weight share of the single most-engaged theme, 0-100 (concentration tendency). */
  topThemeConcentrationPct: number | null;
  /** Share of stage-tagged trade entries that were late-stage (scaling/crowded), 0-100. */
  lateStageChasePct: number | null;
  /** Overall gravitation across stage-tagged activity. */
  stageLean: 'early' | 'late' | 'mixed' | null;
}

export interface TwinProfile {
  version: number;
  /** Total behavioural events considered (trades + watches). */
  interactions: number;
  themes: Affinity[];
  symbols: Affinity[];
  signalKinds: Affinity<SignalKind>[];
  stages: Affinity<LifecycleStage>[];
  revealedRisk: RevealedRisk;
  /** True once there is enough history to reflect meaningfully (>= MIN_TWIN_EVENTS). */
  hasEnoughData: boolean;
}

// --- Helpers -------------------------------------------------------------------------------------

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

function eventRecency(dateIso: string | null | undefined, nowMs: number): number {
  if (!dateIso) return UNDATED_RECENCY;
  return recencyWeight(dateIso, nowMs);
}

/** Aggregate weighted contributions per key into a sorted, share-normalised affinity list. */
function toAffinities<T extends string>(
  contributions: Array<{ key: T; weight: number }>,
): Affinity<T>[] {
  const byKey = new Map<T, { weight: number; count: number }>();
  for (const c of contributions) {
    const cur = byKey.get(c.key) ?? { weight: 0, count: 0 };
    cur.weight += c.weight;
    cur.count += 1;
    byKey.set(c.key, cur);
  }
  const total = [...byKey.values()].reduce((s, v) => s + v.weight, 0);
  return [...byKey.entries()]
    .map(([key, v]) => ({
      key,
      weight: round(v.weight, 3),
      count: v.count,
      sharePct: total > 0 ? round((v.weight / total) * 100, 1) : 0,
    }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count || a.key.localeCompare(b.key));
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

/**
 * Size delta after a losing close: order closed trades by time, then compare the mean notional of
 * trades opened while the most recent prior CLOSED trade was a loss, against all other trades.
 */
function sizeAfterLossDelta(trades: TwinTradeEvent[]): number | null {
  const dated = trades
    .filter((t) => t.openedAt && typeof t.notional === 'number')
    .sort((a, b) => (a.openedAt as string).localeCompare(b.openedAt as string));
  if (dated.length < 4) return null; // too few to say anything honest

  // Build a timeline of closes (time -> was it a loss) to test "prior close" state at each open.
  const closes = trades
    .filter((t) => t.closedAt && typeof t.realisedPnl === 'number')
    .map((t) => ({ at: t.closedAt as string, loss: (t.realisedPnl as number) < 0 }))
    .sort((a, b) => a.at.localeCompare(b.at));
  if (closes.length === 0) return null;

  const afterLoss: number[] = [];
  const baseline: number[] = [];
  for (const t of dated) {
    const openAt = t.openedAt as string;
    // Most recent close strictly before this open.
    let priorLoss: boolean | null = null;
    for (const c of closes) {
      if (c.at < openAt) priorLoss = c.loss;
      else break;
    }
    if (priorLoss === null) continue;
    (priorLoss ? afterLoss : baseline).push(t.notional as number);
  }
  const a = mean(afterLoss);
  const b = mean(baseline);
  if (a === null || b === null || b === 0) return null;
  return round(((a - b) / b) * 100, 1);
}

function stageLean(stages: Affinity<LifecycleStage>[]): RevealedRisk['stageLean'] {
  if (stages.length === 0) return null;
  const early = stages.filter((s) => EARLY_STAGES.includes(s.key)).reduce((sum, s) => sum + s.weight, 0);
  const late = stages.filter((s) => LATE_STAGES.includes(s.key)).reduce((sum, s) => sum + s.weight, 0);
  if (early === 0 && late === 0) return null;
  const ratio = early / (early + late);
  if (ratio >= 0.6) return 'early';
  if (ratio <= 0.4) return 'late';
  return 'mixed';
}

// --- The model -----------------------------------------------------------------------------------

/**
 * Compute the deterministic twin profile from a user's own behavioural events. Pure: same inputs +
 * nowMs => same output. Empty inputs => an empty-but-valid profile (hasEnoughData: false).
 */
export function computeTwinProfile(inputs: TwinInputs, nowMs: number = Date.now()): TwinProfile {
  const { trades, watches, capital } = inputs;
  const attention = inputs.attention ?? [];

  const themeC: Array<{ key: string; weight: number }> = [];
  const symbolC: Array<{ key: string; weight: number }> = [];
  const kindC: Array<{ key: SignalKind; weight: number }> = [];
  const stageC: Array<{ key: LifecycleStage; weight: number }> = [];

  const push = (
    base: number,
    ev: { symbol?: string | null; theme?: string | null; signalKinds?: SignalKind[]; stage?: LifecycleStage | null },
  ) => {
    if (ev.symbol) symbolC.push({ key: ev.symbol.toUpperCase(), weight: base });
    if (ev.theme) themeC.push({ key: ev.theme, weight: base });
    for (const k of ev.signalKinds ?? []) kindC.push({ key: k, weight: base });
    if (ev.stage) stageC.push({ key: ev.stage, weight: base });
  };

  for (const t of trades) {
    const w = (eventRecency(t.openedAt, nowMs) / 100) * TRADE_WEIGHT;
    push(w, t);
  }
  for (const wch of watches) {
    const w = (eventRecency(wch.addedAt, nowMs) / 100) * WATCH_WEIGHT;
    push(w, wch);
  }
  for (const a of attention) {
    const w = (eventRecency(a.at, nowMs) / 100) * ATTENTION_WEIGHT;
    push(w, a);
  }

  const themes = toAffinities(themeC);
  const symbols = toAffinities(symbolC);
  const signalKinds = toAffinities(kindC);
  const stages = toAffinities(stageC);

  const notionals = trades.map((t) => t.notional).filter((n): n is number => typeof n === 'number');
  const avgNotional = mean(notionals);
  const avgSizePctOfCap =
    avgNotional !== null && typeof capital === 'number' && capital > 0
      ? round((avgNotional / capital) * 100, 1)
      : null;

  const stagedTrades = trades.filter((t) => t.stage);
  const lateStageChasePct =
    stagedTrades.length > 0
      ? round(
          (stagedTrades.filter((t) => LATE_STAGES.includes(t.stage as LifecycleStage)).length /
            stagedTrades.length) *
            100,
          1,
        )
      : null;

  const revealedRisk: RevealedRisk = {
    tradeCount: trades.length,
    avgNotional: avgNotional !== null ? round(avgNotional, 2) : null,
    avgSizePctOfCap,
    sizeAfterLossDeltaPct: sizeAfterLossDelta(trades),
    topThemeConcentrationPct: themes.length > 0 ? themes[0].sharePct : null,
    lateStageChasePct,
    stageLean: stageLean(stages),
  };

  const interactions = trades.length + watches.length + attention.length;

  return {
    version: TWIN_MODEL_VERSION,
    interactions,
    themes,
    symbols,
    signalKinds,
    stages,
    revealedRisk,
    hasEnoughData: interactions >= MIN_TWIN_EVENTS,
  };
}

/** Convenience: the stable ordering of lifecycle stages, for surfaces that render the stage lean. */
export { LIFECYCLE_ORDER };
