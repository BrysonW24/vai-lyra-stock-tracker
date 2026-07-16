import { describe, it, expect } from 'vitest';
import { computeExpectancy, describeExpectancy } from '../expectancy';

describe('computeExpectancy', () => {
  it('computes positive expectancy when the payoff outweighs the loss rate', () => {
    // 60% win, +10% wins, -5% losses => EV = 0.6*10 - 0.4*5 = 4.0
    const e = computeExpectancy({ winRatePct: 60, avgWinPct: 10, avgLossPct: 5 });
    expect(e.expectedValuePct).toBe(4);
    expect(e.payoffRatio).toBe(2);
    expect(e.edge).toBe('positive');
    // break-even win rate = 5 / (10+5) = 33.33%
    expect(e.breakEvenWinRatePct).toBeCloseTo(33.33, 1);
  });

  it('flags the mean-reversion trap: a high win rate can still be negative expectancy', () => {
    // 70% win but wins are small (+2%) and losses are large (-8%): EV = 1.4 - 2.4 = -1.0
    const e = computeExpectancy({ winRatePct: 70, avgWinPct: 2, avgLossPct: 8 });
    expect(e.expectedValuePct).toBe(-1);
    expect(e.edge).toBe('negative');
    expect(e.halfKellyFraction).toBe(0); // never sizes a losing edge
  });

  it('returns a bounded, conservative half-Kelly for a positive edge', () => {
    const e = computeExpectancy({ winRatePct: 60, avgWinPct: 10, avgLossPct: 5 });
    // Kelly = 0.6 - 0.4/2 = 0.4; half = 0.2; within the 0.25 cap
    expect(e.halfKellyFraction).toBeCloseTo(0.2, 4);
    expect(e.halfKellyFraction).toBeLessThanOrEqual(0.25);
  });

  it('caps half-Kelly at 25% even for a huge edge', () => {
    const e = computeExpectancy({ winRatePct: 90, avgWinPct: 50, avgLossPct: 2 });
    expect(e.halfKellyFraction).toBe(0.25);
  });

  it('treats a pure breakeven as breakeven, not a win', () => {
    // 50% win, symmetric +5/-5 => EV 0
    const e = computeExpectancy({ winRatePct: 50, avgWinPct: 5, avgLossPct: 5 });
    expect(e.expectedValuePct).toBe(0);
    expect(e.edge).toBe('breakeven');
    expect(e.halfKellyFraction).toBe(0);
  });

  it('degrades safely on invalid input instead of throwing', () => {
    const e = computeExpectancy({ winRatePct: NaN, avgWinPct: -3, avgLossPct: NaN });
    expect(Number.isFinite(e.expectedValuePct)).toBe(true);
    expect(e.edge).not.toBe('positive');
  });

  it('describeExpectancy is neutral and mentions the break-even win rate', () => {
    const text = describeExpectancy(computeExpectancy({ winRatePct: 60, avgWinPct: 10, avgLossPct: 5 }));
    expect(text.toLowerCase()).toContain('break-even');
    expect(text.toLowerCase()).not.toMatch(/\bbuy\b|\bsell\b/);
  });
});
