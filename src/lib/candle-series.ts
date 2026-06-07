import type { ScorePoint } from '@/types/scanner';
import { buildScoreHistory, type ScoreHistoryInput } from '@/lib/score-history';

/**
 * Per-ticker OHLC candle series for the home board.
 *
 * The backend owns the current close; this reconstructs a believable 7-bar price lead-in
 * that ENDS EXACTLY at that close and trends the same direction as the ticker's setup
 * score (so the candles, RSI and MACD in the carousel all tell one consistent story).
 * Deterministic + symbol-seeded. When real intraday candles are available, replace the
 * body of this function with the provider series - the carousel call sites stay identical.
 */
export interface Candle {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandleSeries {
  candles: Candle[];
  points: ScorePoint[];
}

function seeded(seed: string): () => number {
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

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildCandleSeries(input: ScoreHistoryInput & { close: number }): CandleSeries {
  const points = buildScoreHistory(input);
  const n = points.length;
  const endClose = input.close > 0 ? input.close : 100;

  // Trend the price the same way the score trends, so candles and indicators agree.
  const scoreMove = points[n - 1].score - points[0].score;
  const dir = scoreMove > 0 ? 1 : scoreMove < 0 ? -1 : 0;
  const swingPct = clamp(Math.abs(scoreMove) * 0.25, 3, 12) / 100;
  const startClose = endClose * (1 - dir * swingPct);

  const rand = seeded(`${input.symbol}:candles`);

  const closes: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      closes.push(endClose);
      break;
    }
    const t = i / (n - 1);
    const base = startClose + (endClose - startClose) * t;
    const jitter = (rand() - 0.5) * endClose * 0.012;
    closes.push(base + jitter);
  }

  const candles: Candle[] = closes.map((close, i) => {
    const open = i === 0 ? close * (1 - dir * 0.004) : closes[i - 1];
    const top = Math.max(open, close);
    const bot = Math.min(open, close);
    const high = top * (1 + (0.002 + rand() * 0.006));
    const low = bot * (1 - (0.002 + rand() * 0.006));
    return {
      label: points[i].label,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
    };
  });

  return { candles, points };
}
