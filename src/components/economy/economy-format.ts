/**
 * Display formatting for economy indicators. Formatting only - meaning lives in the read
 * engine (src/lib/economy/read.ts) and is never recomputed here.
 */
import { periodLabel } from '@/lib/economy/period';
import type { EconomyIndicator, EconomyVerdict } from '@/lib/economy/types';

/**
 * Signed, at one decimal - or two when the value is under 0.1, so a figure the read quotes as
 * "+0.05%" is not shown beside it as "+0.1%". Two true roundings of one number read as two numbers.
 */
const signed = (v: number, dp?: number) => {
  const places = dp ?? (v !== 0 && Math.abs(v) < 0.1 ? 2 : 1);
  const r = Number(v.toFixed(places));
  return `${r > 0 ? '+' : r < 0 ? '-' : ''}${Math.abs(v).toFixed(places)}`;
};

/** The figure a reader should see first: the change over a year when we have it, else the latest. */
export function primaryFigure(i: EconomyIndicator): string {
  if (i.provenance !== 'live' || !Number.isFinite(i.value)) return 'Not available';
  if (Number.isFinite(i.annual)) return `${signed(i.annual)}% over the year`;
  switch (i.unit) {
    case 'percentChange':
      return `${signed(i.value)}%`;
    case 'points':
      return `${signed(i.value)} pts`;
    case 'index':
      return i.value.toFixed(1);
    default:
      // The cash rate is quoted to two places everywhere; the rest to one.
      return `${i.value.toFixed(i.id === 'cashRate' ? 2 : 1)}%`;
  }
}

/** The quieter second line: when, and what it was before - or the quarter's own move. */
export function secondaryFigure(i: EconomyIndicator): string {
  if (i.provenance !== 'live' || !Number.isFinite(i.value)) return 'Could not be loaded just now';
  const when = periodLabel(i.period);
  if (Number.isFinite(i.annual)) return `${signed(i.value)}% in the ${when}`;
  if (i.unit === 'percentChange' || i.unit === 'points') return when;
  if (!Number.isFinite(i.previous)) return when;
  const dp = i.id === 'cashRate' ? 2 : 1;
  return `${when} - was ${i.previous.toFixed(dp)}%`;
}

export const VERDICT_LABEL: Record<EconomyVerdict, string> = {
  improving: 'Improving',
  mixed: 'Mixed',
  'under-pressure': 'Under pressure',
  unknown: 'Not enough data',
};

/**
 * Verdict tones. A verdict IS a judgement, so it may carry good/bad colour (unlike a raw
 * direction, which the macro strip keeps neutral). Soft coral for pressure, not amber: amber
 * is Lyra's "Sample" chip, and a live verdict must never be mistaken for sample data.
 */
export const VERDICT_TONE: Record<EconomyVerdict, string> = {
  improving: 'border-positive/40 bg-positive-tint text-positive',
  mixed: 'border-line-strong bg-panel text-ink-2',
  'under-pressure': 'border-negative-soft/40 bg-negative-soft/10 text-negative-soft',
  unknown: 'border-line text-ink-dim',
};

/** Short names for the four questions, for the at-a-glance chip row. */
export const QUESTION_SHORT: Record<string, string> = {
  growth: 'Growth',
  living: 'Living standards',
  jobs: 'Jobs',
  prices: 'Inflation and rates',
};
