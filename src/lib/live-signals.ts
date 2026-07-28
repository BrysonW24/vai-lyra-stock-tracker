/**
 * Server-side real signal brain. Computes the deterministic momentum-recovery_v1
 * signal from REAL daily OHLCV (Yahoo - the same source the Python worker uses via
 * yfinance) so the signal panels agree with the live TradingView chart.
 *
 * This is a faithful TS port of workers/stock_scanner/{indicators,signal_engine}.py:
 * Wilder RSI(14), MACD(12,26,9), SMA 20/50/200, the weighted score, status thresholds
 * (strong >= 75, watchlist >= 60), action/lifecycle states, and the structured
 * explanation. It runs server-side only (data layer / middleware), so the frontend
 * still never recomputes - it renders backend-owned truth, just like the Supabase path.
 *
 * Fails soft: any fetch/parse error per symbol keeps that symbol's demo signal.
 */

import type {
  ActionState,
  LifecycleState,
  ScoreBreakdown,
  SignalExplanation,
  SignalRow,
  SignalStatus,
} from '@/types/scanner';
import { computeLyraScore } from '@/lib/score-model';

const ALERT_THRESHOLD = 75;
const WATCHLIST_THRESHOLD = 60;
const CHANGE_THRESHOLD = 8;

interface Ohlcv {
  close: number[];
  high: number[];
  low: number[];
  volume: number[];
}

interface Snap {
  close: number;
  rsi14: number;
  rsiD1: number;
  rsiD2: number;
  macd: number;
  macdSignal: number;
  hist: number;
  histD1: number;
  histD2: number;
  volume: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  volumeRatio: number | null;
  distFrom60Low: number | null;
  priceVsSma20: number | null;
  priceVsSma50: number | null;
  priceVsSma200: number | null;
}

// ---- Yahoo fetch -----------------------------------------------------------

async function fetchOhlcv(symbol: string): Promise<Ohlcv | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      // Cache per symbol for 10 min so a page load never fans out fresh calls.
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: Array<{ indicators?: { quote?: Array<Record<string, (number | null)[]>> } }> };
    };
    const q = json?.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!q) return null;

    const close: number[] = [];
    const high: number[] = [];
    const low: number[] = [];
    const volume: number[] = [];
    const n = q.close?.length ?? 0;
    for (let i = 0; i < n; i++) {
      const c = q.close[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const v = q.volume?.[i];
      // Yahoo includes null candles (holidays); drop any row without a close.
      if (c == null || h == null || l == null) continue;
      close.push(c);
      high.push(h);
      low.push(l);
      volume.push(v ?? 0);
    }
    return close.length >= 35 ? { close, high, low, volume } : null;
  } catch {
    return null;
  }
}

// ---- Indicator math (ports of indicators.py) -------------------------------

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out = new Array<number>(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) out[i] = values[i] * k + out[i - 1] * (1 - k);
  return out;
}

/** Wilder's RSI (RMA smoothing) - matches TradingView + the `ta` library. */
function wilderRsi(close: number[], period = 14): number[] {
  const out = new Array<number>(close.length).fill(NaN);
  if (close.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = close[i] - close[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < close.length; i++) {
    const ch = close[i] - close[i - 1];
    gain = (gain * (period - 1) + Math.max(ch, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-ch, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

function smaAt(values: number[], period: number, i: number): number | null {
  if (i + 1 < period) return null;
  let s = 0;
  for (let k = i - period + 1; k <= i; k++) s += values[k];
  return s / period;
}

function minLowAt(low: number[], period: number, i: number): number | null {
  if (i + 1 < period) return null;
  let m = Infinity;
  for (let k = i - period + 1; k <= i; k++) m = Math.min(m, low[k]);
  return m;
}

function pctRatio(value: number, base: number | null): number | null {
  if (base == null || base === 0) return null;
  return ((value - base) / base) * 100;
}

function buildSnap(ohlcv: Ohlcv, rsi: number[], macdLine: number[], signal: number[], hist: number[], i: number): Snap | null {
  if (i < 2) return null;
  const { close, low, volume } = ohlcv;
  if (![rsi[i], rsi[i - 1], rsi[i - 2], macdLine[i], signal[i], hist[i], hist[i - 1], hist[i - 2]].every(Number.isFinite)) {
    return null;
  }
  const sma20 = smaAt(close, 20, i);
  const sma50 = smaAt(close, 50, i);
  const sma200 = smaAt(close, 200, i);
  const volSma20 = smaAt(volume, 20, i);
  const low60 = minLowAt(low, 60, i);
  return {
    close: close[i],
    rsi14: rsi[i],
    rsiD1: rsi[i] - rsi[i - 1],
    rsiD2: rsi[i] - rsi[i - 2],
    macd: macdLine[i],
    macdSignal: signal[i],
    hist: hist[i],
    histD1: hist[i] - hist[i - 1],
    histD2: hist[i] - hist[i - 2],
    volume: volume[i],
    sma20,
    sma50,
    sma200,
    volumeRatio: volSma20 && volSma20 > 0 ? volume[i] / volSma20 : null,
    distFrom60Low: pctRatio(close[i], low60),
    priceVsSma20: pctRatio(close[i], sma20),
    priceVsSma50: pctRatio(close[i], sma50),
    priceVsSma200: pctRatio(close[i], sma200),
  };
}

// ---- Scoring + states (ports of signal_engine.py) --------------------------

function scoreSnap(s: Snap, prev: Snap | null): ScoreBreakdown & { final: number } {
  // One canonical TS scorer now lives in src/lib/score-model.ts (guarded against Python drift
  // by contracts/score-golden-vectors.json). This used to be a hand-inlined third copy of the
  // weights; it delegates so a weight can only be edited in one place.
  const c = computeLyraScore({
    rsi14: s.rsi14,
    rsiD1: s.rsiD1,
    rsiD2: s.rsiD2,
    macd: s.macd,
    macdSignal: s.macdSignal,
    hist: s.hist,
    histD1: s.histD1,
    histD2: s.histD2,
    close: s.close,
    sma20: s.sma20,
    sma50: s.sma50,
    sma200: s.sma200,
    distFrom60Low: s.distFrom60Low,
    volumeRatio: s.volumeRatio,
    volume: s.volume,
    prevVolume: prev ? prev.volume : null,
  });
  return {
    final: c.final,
    rsiScore: c.rsiScore,
    macdScore: c.macdScore,
    priceLocationScore: c.priceLocationScore,
    trendScore: c.trendScore,
    volumeScore: c.volumeScore,
  };
}

export function statusFor(score: number, prev: number | null): SignalStatus {
  if (score >= ALERT_THRESHOLD) return 'strong_setup';
  if (score >= WATCHLIST_THRESHOLD) return 'watchlist_setup';
  if (prev != null && prev >= ALERT_THRESHOLD && score < WATCHLIST_THRESHOLD) return 'invalidated';
  if (prev != null && score < prev - CHANGE_THRESHOLD) return 'weakening';
  return 'no_signal';
}

export function actionFor(status: SignalStatus): ActionState {
  if (status === 'strong_setup') return 'buy_review';
  if (status === 'watchlist_setup') return 'watch';
  if (status === 'weakening') return 'do_not_add';
  if (status === 'invalidated') return 'invalidated';
  return 'hold';
}

export function lifecycleFor(status: SignalStatus, prevStatus: SignalStatus | null, scoreDelta: number): LifecycleState {
  // Mirrors signal_engine.py lifecycle_state_for, including the previous_status is None branch.
  if (prevStatus === null) {
    return status === 'strong_setup' || status === 'watchlist_setup' ? 'new_signal' : 'unchanged';
  }
  if (status === 'invalidated') return 'invalidated';
  if (prevStatus !== 'strong_setup' && status === 'strong_setup') return 'upgraded';
  if (prevStatus === 'strong_setup' && status === 'watchlist_setup') return 'downgraded';
  if ((prevStatus === 'invalidated' || prevStatus === 'weakening') && (status === 'watchlist_setup' || status === 'strong_setup')) {
    return 'recovered';
  }
  if (Math.abs(scoreDelta) >= CHANGE_THRESHOLD) return scoreDelta > 0 ? 'upgraded' : 'downgraded';
  if (prevStatus === status) return 'continuing';
  return 'unchanged';
}

function explanationFor(s: Snap, action: ActionState): SignalExplanation {
  const triggeredBecause: string[] = [];
  const missingConfirmation: string[] = [];
  const riskNotes = ['Signal is technical only and does not include earnings, filings, or news context'];

  if (s.rsi14 < 50 && s.rsiD1 > 0) triggeredBecause.push('RSI is below 50 and rising');
  else missingConfirmation.push('RSI is not yet below 50 and rising');

  if (s.hist < 0 && s.histD1 > 0) triggeredBecause.push('MACD histogram is negative but improving');
  else missingConfirmation.push('MACD histogram recovery is not confirmed');

  if (s.distFrom60Low != null && s.distFrom60Low <= 10) triggeredBecause.push('Price is within 10% of the 60-period low');
  else missingConfirmation.push('Price is not close enough to the 60-period low');

  if (s.volumeRatio != null && s.volumeRatio >= 0.8) triggeredBecause.push('Volume is at least 80% of the 20-period average');
  else missingConfirmation.push('Volume confirmation is weak');

  if (s.macd <= s.macdSignal) missingConfirmation.push('MACD bullish cross has not occurred yet');

  return { action, triggeredBecause, missingConfirmation, riskNotes };
}

function summaryFor(s: Snap): SignalRow['summary'] {
  const rsiZone = s.rsi14 < 30 ? 'oversold' : s.rsi14 > 70 ? 'overbought' : s.rsi14 < 50 ? 'below neutral' : 'above neutral';
  return {
    rsi: `RSI ${s.rsi14.toFixed(1)} ${s.rsiD1 >= 0 ? 'rising' : 'falling'} (${rsiZone}).`,
    macd: `MACD histogram ${s.hist.toFixed(2)} ${s.histD1 >= 0 ? 'improving' : 'fading'}.`,
    volume: s.volumeRatio != null ? `Volume ${s.volumeRatio.toFixed(2)}x the 20-day average.` : 'Volume context building.',
    trend:
      s.priceVsSma200 != null
        ? `Price is ${s.priceVsSma200 >= 0 ? 'above' : 'below'} the 200-day SMA (${s.priceVsSma200.toFixed(1)}%).`
        : 'Trend context building.',
    price: s.distFrom60Low != null ? `Price is ${s.distFrom60Low.toFixed(1)}% above the 60-day low.` : 'Price location building.',
  };
}

// ---- Public API ------------------------------------------------------------

// Exported for the per-symbol refresh route (/api/signals/[symbol]) so an open
// drawer can pull current engine numbers instead of the page-load snapshot.
export async function buildLiveSignal(symbol: string): Promise<Partial<SignalRow> | null> {
  const ohlcv = await fetchOhlcv(symbol);
  if (!ohlcv) return null;

  const { close } = ohlcv;
  const rsi = wilderRsi(close, 14);
  const ema12 = ema(close, 12);
  const ema26 = ema(close, 26);
  const macdLine = close.map((_, i) => ema12[i] - ema26[i]);
  const signal = ema(macdLine, 9);
  const hist = macdLine.map((_, i) => macdLine[i] - signal[i]);

  const i = close.length - 1;
  const snap = buildSnap(ohlcv, rsi, macdLine, signal, hist, i);
  const prevSnap = buildSnap(ohlcv, rsi, macdLine, signal, hist, i - 1);
  // Third snapshot (i-2) so the previous candle's score and STATUS are computed like-for-like
  // with the current one: scoreSnap's volume-vs-previous term needs a prior snap, and statusFor
  // needs a prior score to ever return 'weakening'/'invalidated'. Without it, scoreDelta was
  // inflated by up to 5 and the 'recovered' lifecycle branch was unreachable (parity with
  // signal_engine.py's previous-status logic).
  const prevPrevSnap = buildSnap(ohlcv, rsi, macdLine, signal, hist, i - 2);
  if (!snap) return null;

  const score = scoreSnap(snap, prevSnap);
  const prevScore = prevSnap ? scoreSnap(prevSnap, prevPrevSnap) : null;
  const prevPrevScore = prevPrevSnap ? scoreSnap(prevPrevSnap, null) : null;
  const scoreDelta = prevScore ? score.final - prevScore.final : 0;
  const status = statusFor(score.final, prevScore ? prevScore.final : null);
  const prevStatus = prevScore ? statusFor(prevScore.final, prevPrevScore ? prevPrevScore.final : null) : null;
  const action = actionFor(status);

  const prevClose = close[i - 1];
  const macdImproving = snap.histD1 >= 0;

  return {
    score: Math.round(score.final),
    scoreDelta: Math.round(scoreDelta),
    status,
    actionState: action,
    lifecycleState: lifecycleFor(status, prevStatus, scoreDelta),
    scoreBreakdown: {
      rsiScore: score.rsiScore,
      macdScore: score.macdScore,
      priceLocationScore: score.priceLocationScore,
      trendScore: score.trendScore,
      volumeScore: score.volumeScore,
    },
    close: snap.close,
    priceChange1h: 0, // daily series - intraday change isn't available from this feed
    priceChange1d: prevClose ? ((snap.close - prevClose) / prevClose) * 100 : 0,
    rsi: snap.rsi14,
    previousRsi: rsi[i - 1],
    rsiDelta: snap.rsiD1,
    macdHistogram: snap.hist,
    previousMacdHistogram: hist[i - 1],
    histDelta: snap.histD1,
    macdState: snap.hist >= 0 ? (macdImproving ? 'Above signal, rising' : 'Above signal, fading') : (macdImproving ? 'Below signal, improving' : 'Below signal, weakening'),
    histogramSlope: snap.histD1,
    volumeRatio: snap.volumeRatio ?? 0,
    distanceFromLow: snap.distFrom60Low ?? 0,
    priceVsSma20: snap.priceVsSma20 ?? 0,
    priceVsSma50: snap.priceVsSma50 ?? 0,
    priceVsSma200: snap.priceVsSma200 ?? 0,
    explanation: explanationFor(snap, action),
    summary: summaryFor(snap),
  };
}

/**
 * Overlay real computed signal fields onto the given signals (demo or Supabase),
 * matched by symbol. Returns the array unchanged for any symbol that can't be
 * computed (network/parse failure), so the dashboard never regresses below demo.
 */
/** Max simultaneous upstream OHLCV fetches, so a cold cache can't fan out N calls at once. */
const LIVE_FETCH_CONCURRENCY = 8;

export async function applyLiveSignals(signals: SignalRow[]): Promise<SignalRow[]> {
  if (signals.length === 0) return signals;

  // Bounded worker pool: at most LIVE_FETCH_CONCURRENCY Yahoo requests in flight regardless of how
  // many signals render. Each fetch is still cached 10 min (see fetchOhlcv), so a warm page pays
  // nothing; this only caps the cold-cache burst that used to block the render with ~80 parallel calls.
  const out = new Array<SignalRow>(signals.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < signals.length) {
      const index = cursor++;
      const signal = signals[index];
      const computed = await buildLiveSignal(signal.symbol);
      out[index] = computed ? { ...signal, ...computed } : signal;
    }
  }
  await Promise.all(Array.from({ length: Math.min(LIVE_FETCH_CONCURRENCY, signals.length) }, worker));
  return out;
}
