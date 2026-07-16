/**
 * Recovery-probability inference - the TS mirror of the learned+calibrated model trained offline by
 * workers/stock_scanner/ml/recovery_model.py. It loads the frozen coefficients from
 * src/lib/generated/recovery-model.json and maps the engine's own signal components to a CALIBRATED
 * probability that a beaten-down name recovers. Deterministic, offline, no network.
 *
 * DOCTRINE (unbroken): this INFORMS, it never DECIDES. The deterministic engine still owns the action
 * label; this attaches a probability estimate for research context only - never advice. The number is
 * a model estimate, not a guarantee, and is surfaced as a band, not a false-precision percentage.
 *
 * The feature transform below is a BYTE-FOR-BYTE mirror of recovery_model.py::transform; the drift
 * guard test (./__tests__/recovery-probability.test.ts) replays the model's own fixtures through this
 * code and fails if the two implementations ever diverge (same pattern as the Pine strategy mirror).
 */
import model from '@/lib/generated/recovery-model.json';

export interface RecoverySignal {
  /** RSI (0-100). */
  rsi: number;
  /** Recent RSI change (signed). */
  rsiDelta: number;
  /** MACD histogram (signed; negative-but-improving is the early-turn tell). */
  macdHist: number;
  /** MACD histogram change (signed). */
  macdHistDelta: number;
  /** Distance above the 60-period low, in percent. */
  distFromLowPct: number;
  /** Price above the 200-period SMA. */
  aboveSma200: boolean;
  /** Volume vs its average (1.0 = average). */
  volumeRatio: number;
  /** The deterministic composite score (0-100). */
  score: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Raw signal fields -> the 7 model features. MUST match recovery_model.py::transform exactly. */
export function recoveryFeatures(s: RecoverySignal): number[] {
  const resetBand = Math.max(0, 1 - Math.abs(s.rsi - 42.5) / 12.5);
  const rsiImproving = clamp(s.rsiDelta / 3, -1, 1);
  const macdRecovering = clamp(s.macdHistDelta / 1, -1, 1) * (s.macdHist < 0 ? 1 : 0.5);
  const nearLow = clamp((10 - s.distFromLowPct) / 10, -1, 1);
  const trend = (s.aboveSma200 ? 1 : 0) - 0.5;
  const volume = clamp((s.volumeRatio - 1) / 1, -1, 1);
  const scoreC = (s.score - 50) / 25;
  return [resetBand, rsiImproving, macdRecovering, nearLow, trend, volume, scoreC];
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));

const MEAN = model.mean as number[];
const STD = model.std as number[];
const WEIGHTS = model.weights as number[];
const BIAS = model.bias as number;

/**
 * Calibrated probability in [0,1] that the setup recovers. Deterministic. Informs, never decides -
 * the caller must present this as research context alongside (never in place of) the engine's action.
 */
export function recoveryProbability(s: RecoverySignal): number {
  const feats = recoveryFeatures(s);
  let z = BIAS;
  for (let i = 0; i < feats.length; i++) {
    const std = STD[i] || 1;
    z += WEIGHTS[i] * ((feats[i] - MEAN[i]) / std);
  }
  return sigmoid(z);
}

export type RecoveryBand = 'unlikely' | 'building' | 'likely';

/** Coarse band for display - avoids false-precision. Research context, never a recommendation. */
export function recoveryBand(prob: number): RecoveryBand {
  if (prob >= 0.6) return 'likely';
  if (prob >= 0.4) return 'building';
  return 'unlikely';
}

/** Model card metadata for provenance/observability surfaces. */
export const RECOVERY_MODEL_META = {
  version: model.version as number,
  trainedAt: model.trainedAt as string,
  algorithm: model.algorithm as string,
  oosAuc: (model.metrics as { oos_auc: number }).oos_auc,
  oosBrier: (model.metrics as { oos_brier: number }).oos_brier,
  baselineBrier: (model.metrics as { baseline_brier: number }).baseline_brier,
  provenance: model.provenance as string,
} as const;
