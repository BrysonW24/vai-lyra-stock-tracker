export interface MovementThresholdOptions {
  stepPct?: number;
  maxAbsPct?: number;
  thresholds?: number[];
}

const DEFAULT_STEP_PCT = 5;
const DEFAULT_MAX_ABS_PCT = 50;

export function buildMovementThresholds(options: MovementThresholdOptions = {}): number[] {
  if (options.thresholds?.length) {
    return Array.from(new Set(options.thresholds.filter((value) => value !== 0))).sort((a, b) => a - b);
  }

  const step = Math.max(1, Math.abs(Math.trunc(options.stepPct ?? DEFAULT_STEP_PCT)));
  const max = Math.max(step, Math.abs(Math.trunc(options.maxAbsPct ?? DEFAULT_MAX_ABS_PCT)));
  const thresholds: number[] = [];
  for (let pct = step; pct <= max; pct += step) {
    thresholds.push(-pct, pct);
  }
  return thresholds.sort((a, b) => a - b);
}

export function pctMoveFromReference(currentPrice: number | null | undefined, referencePrice: number | null | undefined): number | null {
  if (currentPrice == null || referencePrice == null || referencePrice <= 0) return null;
  return ((currentPrice - referencePrice) / referencePrice) * 100;
}

export function crossedMovementThresholds(
  previousPct: number | null | undefined,
  currentPct: number | null | undefined,
  options: MovementThresholdOptions = {},
): number[] {
  if (currentPct == null || !Number.isFinite(currentPct)) return [];
  const thresholds = buildMovementThresholds(options);

  if (previousPct == null || !Number.isFinite(previousPct)) {
    return thresholds.filter((threshold) => (threshold > 0 ? currentPct >= threshold : currentPct <= threshold));
  }

  const rising = currentPct >= previousPct;
  const crossed = thresholds.filter((threshold) => {
    if (threshold > 0) return previousPct < threshold && currentPct >= threshold;
    return previousPct > threshold && currentPct <= threshold;
  });

  return rising ? crossed.sort((a, b) => a - b) : crossed.sort((a, b) => b - a);
}

export function buildMovementDedupeKey(scope: 'watchlist' | 'portfolio' | 'paper', symbol: string, thresholdPct: number): string {
  const normalisedSymbol = symbol.trim().toUpperCase();
  const direction = thresholdPct >= 0 ? 'up' : 'down';
  return `${scope}_price_move:${normalisedSymbol}:${direction}:${Math.abs(thresholdPct)}`;
}
