import type { ScorePoint } from '@/types/scanner';

/**
 * Per-ticker momentum history.
 *
 * The backend (or the demo layer) owns the *current* truth for a ticker: its score,
 * RSI, and MACD histogram. What this helper does is reconstruct a believable 7-scan
 * lead-in that TERMINATES EXACTLY at those current values and trends in the correct
 * direction (a weakening ticker declines into its value; a recovering one climbs).
 *
 * This guarantees data parity across every surface that draws a ticker's history:
 * the detail page and the overview board call this same function, so they can never
 * disagree. When a live provider supplies real intraday history, swap the body of
 * buildScoreHistory for the provider series - the call sites stay identical.
 */

const LABELS = ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now'] as const;

export interface ScoreHistoryInput {
  symbol: string;
  score: number;
  rsi: number;
  macdHistogram: number;
  scoreDelta?: number;
  rsiDelta?: number;
  histDelta?: number;
  macdState?: string;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Deterministic, symbol-seeded PRNG so each ticker gets a distinct-but-stable shape. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** -1 = weakening into the present, +1 = recovering into the present, 0 = roughly flat. */
function direction(input: ScoreHistoryInput): number {
  const state = (input.macdState ?? '').toLowerCase();
  const delta = input.scoreDelta ?? 0;
  if (/weak|fad|roll|soft|cool|down|over/.test(state) || delta < -1) return -1;
  if (/recov|improv|ris|strength|build|up/.test(state) || delta > 1) return 1;
  return 0;
}

/**
 * Build a 7-point path that eases from a derived start to the exact `end`, with the
 * final point pinned to truth. Easing > 1 keeps most of the move recent (momentum).
 */
function path(end: number, swing: number, rand: () => number, lo: number, hi: number, decimals: number): number[] {
  const start = end - swing;
  const out: number[] = [];
  const n = LABELS.length;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      out.push(round(end, decimals));
      break;
    }
    const t = i / (n - 1);
    const eased = t ** 1.7;
    const base = start + (end - start) * eased;
    const jitter = (rand() - 0.5) * Math.abs(swing) * 0.1;
    out.push(round(clamp(base + jitter, lo, hi), decimals));
  }
  return out;
}

export function buildScoreHistory(input: ScoreHistoryInput): ScorePoint[] {
  const rand = seededRandom(input.symbol);
  const dir = direction(input);

  const scoreMag = clamp(Math.abs(input.scoreDelta ?? 6) * 1.6 + 10, 12, 28);
  const scoreSwing = dir === 0 ? (rand() > 0.5 ? 6 : -6) : dir * scoreMag;

  const rsiSwing = dir === 0 ? 3 : dir * clamp(Math.abs(input.rsiDelta ?? 4) * 1.4 + 5, 6, 15);

  const histMag = clamp(Math.abs(input.histDelta ?? 0.2) * 3 + 0.7, 0.7, 1.7);
  const histSwing = dir === 0 ? 0.25 : dir * histMag;

  const scores = path(input.score, scoreSwing, rand, 3, 99, 0);
  const rsis = path(input.rsi, rsiSwing, rand, 5, 95, 1);
  const histograms = path(input.macdHistogram, histSwing, rand, -5, 5, 3);

  return LABELS.map((label, i) => ({
    label,
    score: scores[i],
    rsi: rsis[i],
    histogram: histograms[i],
  }));
}
