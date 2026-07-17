import { describe, it, expect } from 'vitest';
import { aggregateTrackRecord, formatPct, type OutcomeRow, WIN_THRESHOLD_PCT } from '../track-record';

/**
 * These lock the Track Record to HONEST measurement. The whole point of this surface is that
 * it replaced hardcoded win rates (strategy.ts claimed 67%/72% "from simulation") with numbers
 * measured from real signal_outcomes - and the real numbers are humbler, sometimes below a coin
 * toss. If aggregation ever starts inflating (counting break-evens as wins, dropping losers,
 * smoothing), these go red.
 */

function row(status: string, r20: number | null, extra: Partial<OutcomeRow> = {}): OutcomeRow {
  return {
    signal_type: 'momentum_recovery_v1',
    signal_status: status,
    return_1d: null,
    return_5d: null,
    return_20d: r20,
    return_60d: null,
    ...extra,
  };
}

describe('aggregateTrackRecord', () => {
  it('is total on empty input - no decorative fallback', () => {
    const tr = aggregateTrackRecord([]);
    expect(tr.provenance).toBe('empty');
    expect(tr.totalOutcomes).toBe(0);
    expect(tr.groups).toEqual([]);
  });

  it('measures win rate at the 20d horizon with the friction floor, not > 0', () => {
    // 4 rows: +5 (win), +0.1 (below the 0.3 friction floor - NOT a win), -2 (loss), +1 (win).
    const rows = [row('strong_setup', 5), row('strong_setup', 0.1), row('strong_setup', -2), row('strong_setup', 1)];
    const g = aggregateTrackRecord(rows).groups[0];
    const h20 = g.horizons.find((h) => h.horizon === '20d')!;
    expect(h20.n).toBe(4);
    // 2 of 4 clear the floor => 50%, NOT 75% (which counting +0.1 as a win would give).
    expect(h20.winRatePct).toBe(50);
    expect(WIN_THRESHOLD_PCT).toBe(0.3);
  });

  it('computes avg, median, best, worst without changing the sign of any value', () => {
    const rows = [row('x', -4), row('x', -1), row('x', 2), row('x', 8)];
    const h = aggregateTrackRecord(rows).groups[0].horizons.find((h) => h.horizon === '20d')!;
    expect(h.avgReturnPct).toBeCloseTo(1.25, 5);
    expect(h.medianReturnPct).toBeCloseTo(0.5, 5); // (-1 + 2) / 2
    expect(h.bestPct).toBe(8);
    expect(h.worstPct).toBe(-4);
  });

  it('counts only rows that carry a value at each horizon', () => {
    const rows = [
      row('s', 3, { return_5d: 1 }),
      row('s', null, { return_5d: 2 }), // no 20d, has 5d
    ];
    const g = aggregateTrackRecord(rows).groups[0];
    expect(g.totalRows).toBe(2);
    expect(g.horizons.find((h) => h.horizon === '20d')!.n).toBe(1);
    expect(g.horizons.find((h) => h.horizon === '5d')!.n).toBe(2);
    expect(g.horizons.find((h) => h.horizon === '1d')!.n).toBe(0);
    expect(g.horizons.find((h) => h.horizon === '1d')!.winRatePct).toBeNull();
  });

  it('orders groups by sample size desc, and reports the real (humbling) shape of prod data', () => {
    // A faithful miniature of production: watchlist_setup out-samples strong_setup, and the
    // "strong" signal is NOT the more reliable one - its win rate sits below 50%. This is the
    // exact truth the invented winRate:67 hid. If someone re-inflates the numbers, this fails.
    const rows: OutcomeRow[] = [
      ...Array.from({ length: 6 }, (_, i) => row('watchlist_setup', i < 4 ? 3 : -2)), // 4/6 win
      ...Array.from({ length: 4 }, (_, i) => row('strong_setup', i < 1 ? 5 : -1)), //   1/4 win
    ];
    const tr = aggregateTrackRecord(rows);
    expect(tr.groups[0].signalStatus).toBe('watchlist_setup'); // more samples leads
    const strong = tr.groups.find((g) => g.signalStatus === 'strong_setup')!;
    const strong20 = strong.horizons.find((h) => h.horizon === '20d')!;
    expect(strong20.winRatePct).toBeLessThan(50); // the honest, humbling truth
  });
});

describe('formatPct', () => {
  it('shows a + on positive, keeps the sign on negative, and n/a on null', () => {
    expect(formatPct(1.324)).toBe('+1.3%');
    expect(formatPct(-1.69)).toBe('-1.7%');
    expect(formatPct(0)).toBe('0.0%');
    expect(formatPct(null)).toBe('n/a');
  });
});
