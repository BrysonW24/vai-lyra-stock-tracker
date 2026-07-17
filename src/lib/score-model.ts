/**
 * The ONE TypeScript implementation of Lyra's deterministic 0-100 oversold-recovery score.
 *
 * SOURCE OF TRUTH: workers/stock_scanner/signal_engine.py::calculate_score. This file must stay
 * byte-for-byte faithful to it. Two things guard that: contracts/score-golden-vectors.json holds
 * input->score cases that BOTH this function (src/lib/__tests__/score-parity.test.ts) and the
 * Python engine (tests/test_score_parity.py) assert against - so if either language drifts from
 * the shared golden numbers, its own test goes red. The Pine export (src/lib/pine/lyra-strategy.ts)
 * mirrors the same weights.
 *
 * Before this module there were three TS score copies (live-signals scoreSnap, the pine constants,
 * and ad-hoc UI reads). live-signals now delegates here; the pine model asserts the same weights.
 */

/** Raw indicator inputs the score reads. Nulls mean "not enough history" and award nothing. */
export interface ScoreInputs {
  rsi14: number | null;
  rsiD1: number | null;
  rsiD2: number | null;
  macd: number | null;
  macdSignal: number | null;
  hist: number | null;
  histD1: number | null;
  histD2: number | null;
  close: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  distFrom60Low: number | null;
  volumeRatio: number | null;
  volume: number | null;
  /** Previous candle's volume, for the "volume increased" term. Null on the first bar. */
  prevVolume: number | null;
}

export interface ScoreComponents {
  rsiScore: number;
  macdScore: number;
  priceLocationScore: number;
  trendScore: number;
  volumeScore: number;
  final: number;
}

/** Component point weights - the single numeric source for the TS side. Caps: 25/30/15/15/15. */
export const LYRA_SCORE_WEIGHTS = {
  rsi: { band: 10, rising1: 10, rising2: 5, bandLow: 35, bandHigh: 50 },
  macd: { negative: 8, improving1: 12, improving2: 5, belowSignalImproving: 5 },
  price: { lowDistance: 10, lowDistancePct: 10, nearSma50: 5, nearSma50Mult: 1.03 },
  trend: { aboveSma200: 10, nearSma200: 5, nearSma200Mult: 0.95, sma20VsSma50: 5, sma20VsSma50Mult: 0.95 },
  volume: { ratioLow: 5, ratioLowThresh: 0.8, ratioHigh: 5, ratioHighThresh: 1.0, rising: 5 },
} as const;

/**
 * Compute the deterministic score components + final (0-100) from raw inputs. Pure. Mirrors
 * calculate_score exactly, including every None/null-skip: a null input awards nothing, never a
 * default. Do not "simplify" a condition here without changing signal_engine.py in lockstep -
 * the golden-vector parity tests exist to catch exactly that.
 */
export function computeLyraScore(v: ScoreInputs): ScoreComponents {
  const w = LYRA_SCORE_WEIGHTS;
  let rsiScore = 0;
  let macdScore = 0;
  let priceLocationScore = 0;
  let trendScore = 0;
  let volumeScore = 0;

  if (v.rsi14 !== null && v.rsi14 >= w.rsi.bandLow && v.rsi14 <= w.rsi.bandHigh) rsiScore += w.rsi.band;
  if (v.rsiD1 !== null && v.rsiD1 > 0) rsiScore += w.rsi.rising1;
  if (v.rsiD2 !== null && v.rsiD2 > 0) rsiScore += w.rsi.rising2;

  if (v.hist !== null && v.hist < 0) macdScore += w.macd.negative;
  if (v.histD1 !== null && v.histD1 > 0) macdScore += w.macd.improving1;
  if (v.histD2 !== null && v.histD2 > 0) macdScore += w.macd.improving2;
  if (v.macd !== null && v.macdSignal !== null && v.macd < v.macdSignal && v.histD1 !== null && v.histD1 > 0) {
    macdScore += w.macd.belowSignalImproving;
  }

  if (v.distFrom60Low !== null && v.distFrom60Low <= w.price.lowDistancePct) priceLocationScore += w.price.lowDistance;
  if (v.close !== null && v.sma50 !== null && v.close <= v.sma50 * w.price.nearSma50Mult) priceLocationScore += w.price.nearSma50;

  if (v.close !== null && v.sma200 !== null && v.close >= v.sma200) trendScore += w.trend.aboveSma200;
  else if (v.close !== null && v.sma200 !== null && v.close >= v.sma200 * w.trend.nearSma200Mult) trendScore += w.trend.nearSma200;
  if (v.sma20 !== null && v.sma50 !== null && v.sma20 >= v.sma50 * w.trend.sma20VsSma50Mult) trendScore += w.trend.sma20VsSma50;

  if (v.volumeRatio !== null && v.volumeRatio >= w.volume.ratioLowThresh) volumeScore += w.volume.ratioLow;
  if (v.volumeRatio !== null && v.volumeRatio >= w.volume.ratioHighThresh) volumeScore += w.volume.ratioHigh;
  if (v.prevVolume !== null && v.volume !== null && v.volume > v.prevVolume) volumeScore += w.volume.rising;

  const final = Math.min(rsiScore + macdScore + priceLocationScore + trendScore + volumeScore, 100);
  return { rsiScore, macdScore, priceLocationScore, trendScore, volumeScore, final };
}
