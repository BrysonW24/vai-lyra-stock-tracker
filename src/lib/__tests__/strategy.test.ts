import { describe, expect, it } from 'vitest';
import { PRESET_STRATEGIES, getStrategyById, matchStrategy } from '@/lib/strategy';
import { demoDashboardData } from '@/lib/demo-data';

const demoSignals = demoDashboardData.signals;

/**
 * Regression guard for the StrategyLab "0 current matches on every load" bug.
 *
 * The percentage-field thresholds (distanceFromLow, priceVsSma20/50/200) used to be
 * stored as fractions (0.12, -0.08, 0.02) while the SignalRow fields they compare
 * against are already whole percentages (a 4.2 means 4.2%). That mismatch meant the
 * default strategy never matched anything, even though the Radar surfaced those same
 * tickers as strong setups. These tests assert the units now agree.
 */
describe('PRESET_STRATEGIES unit alignment', () => {
  it('exposes the oversold-recovery strategy as the default (first) preset', () => {
    expect(PRESET_STRATEGIES[0].id).toBe('momentum-recovery');
    expect(getStrategyById('momentum-recovery')).toBeDefined();
  });

  it('default strategy returns a non-zero match count against the demo signals', () => {
    const strategy = getStrategyById('momentum-recovery');
    expect(strategy).toBeDefined();
    const matches = matchStrategy(strategy!, demoSignals);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('matches AMD, a clear oversold-recovery setup, in the demo data', () => {
    // AMD: rsi 46.4 (in 30-50), rsiDelta +4.3, histDelta +0.39, distanceFromLow 4.2%,
    // volumeRatio 1.18 - a textbook beaten-down-name-turning-up row.
    const strategy = getStrategyById('momentum-recovery')!;
    const matches = matchStrategy(strategy, demoSignals);
    expect(matches.map((m) => m.symbol)).toContain('AMD');
  });

  it('keeps percentage-field thresholds in whole-percent units, not fractions', () => {
    // The bug signature was a sub-1 threshold over a field that ranges in whole percent.
    // distanceFromLow demo values run 4-18, so a threshold of 0.12 can never be met.
    const strategy = getStrategyById('momentum-recovery')!;
    const distanceRule = strategy.rules.find((rule) => rule.field === 'distanceFromLow');
    expect(distanceRule).toBeDefined();
    expect(distanceRule!.value).toBe(12);
  });

  it('every preset returns a number of matches (never throws on the demo set)', () => {
    for (const strategy of PRESET_STRATEGIES) {
      const matches = matchStrategy(strategy, demoSignals);
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBeGreaterThanOrEqual(0);
    }
  });
});
