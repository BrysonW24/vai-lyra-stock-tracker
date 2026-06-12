import type { ScoreBreakdown } from '@/types/scanner';

export interface ScoreComponent {
  key: keyof ScoreBreakdown;
  label: string;
  /** The maximum points this factor can contribute. The maxes sum to 100. */
  max: number;
}

/**
 * Canonical score-component weights - the single source of truth for how the
 * composite 0-100 score is built. Every surface that renders the breakdown (the
 * ticker page, the signal drawer) maps over THIS, so the numbers + bar fills can
 * never drift apart. The component values for a signal sum to its score.
 */
export const SCORE_COMPONENTS: ScoreComponent[] = [
  { key: 'rsiScore', label: 'RSI', max: 25 },
  { key: 'macdScore', label: 'MACD', max: 30 },
  { key: 'priceLocationScore', label: 'Price location', max: 15 },
  { key: 'trendScore', label: 'Trend', max: 15 },
  { key: 'volumeScore', label: 'Volume', max: 15 },
];

export const SCORE_MAX_TOTAL = SCORE_COMPONENTS.reduce((sum, c) => sum + c.max, 0); // 100

export interface ScoreComponentValue extends ScoreComponent {
  value: number;
  /** value / max as a 0-100 percentage, for the progress-bar fill. */
  pct: number;
}

/** Resolve a signal's raw breakdown into render-ready rows (value, max, fill %). */
export function buildScoreBreakdown(breakdown: ScoreBreakdown): ScoreComponentValue[] {
  return SCORE_COMPONENTS.map((component) => {
    const value = breakdown[component.key] ?? 0;
    return { ...component, value, pct: Math.min(100, Math.max(0, (value / component.max) * 100)) };
  });
}
