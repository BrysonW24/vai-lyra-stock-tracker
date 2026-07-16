import { describe, it, expect } from 'vitest';
import { buildTradePlan, renderTradePlanText } from '../trade-plan';

const base = {
  symbol: 'DEMO',
  entryPrice: 10,
  stopPrice: 9,
  accountSize: 5000,
  riskPercentPerTrade: 1,
  maxPositionPct: 20,
};

describe('buildTradePlan sizing', () => {
  it('sizes risk-first off the stop distance and floors to whole shares', () => {
    // risk$ = 1% of 5000 = 50; stop distance = 1; ideal = 50 shares.
    // concentration cap = 20% of 5000 / 10 = 100 shares (not binding).
    const p = buildTradePlan(base);
    expect(p.riskDollars).toBe(50);
    expect(p.shares).toBe(50);
    expect(p.positionValue).toBe(500);
    expect(p.flags).not.toContain('over-concentration');
  });

  it('caps size at the concentration limit and flags it', () => {
    // Tight stop makes risk-based size huge; concentration cap must bind.
    const p = buildTradePlan({ ...base, stopPrice: 9.9 }); // stop distance 0.10 => risk-based 500 shares
    // concentration cap = 100 shares
    expect(p.shares).toBe(100);
    expect(p.flags).toContain('over-concentration');
  });

  it('flags capital-too-small when one whole share is out of reach', () => {
    // $600 stock, 20% of a $500 account = $100 < one share.
    const p = buildTradePlan({ ...base, entryPrice: 600, stopPrice: 540, accountSize: 500 });
    expect(p.shares).toBe(0);
    expect(p.flags).toContain('capital-too-small');
  });

  it('falls back to the concentration cap and flags a missing stop', () => {
    const p = buildTradePlan({ symbol: 'X', entryPrice: 10, accountSize: 5000, riskPercentPerTrade: 1 });
    expect(p.flags).toContain('stop-missing');
    expect(p.stopDistancePct).toBeNull();
    expect(p.worstCaseLossDollars).toBeNull();
    // sized by the default 20% cap: 100 shares
    expect(p.shares).toBe(100);
  });

  it('computes worst-case loss including entry-side friction', () => {
    const p = buildTradePlan(base);
    // 50 shares * $1 stop distance = $50, plus one-side friction > 0
    expect(p.worstCaseLossDollars).toBeGreaterThan(50);
  });

  it('flags a very wide stop', () => {
    const p = buildTradePlan({ ...base, stopPrice: 6 }); // 40% below entry
    expect(p.flags).toContain('wide-stop');
  });
});

describe('buildTradePlan cost + expectancy', () => {
  it('flags cost drag on a tiny cross-currency position', () => {
    const p = buildTradePlan({
      symbol: 'AU', entryPrice: 20, stopPrice: 18, accountSize: 400, riskPercentPerTrade: 2,
      crossCurrency: true, liquidity: 20,
    });
    expect(p.flags).toContain('cost-drag-high');
  });

  it('flags negative expectancy from the base rates', () => {
    const p = buildTradePlan({ ...base, outcome: { winRatePct: 70, avgWinPct: 2, avgLossPct: 8 }, provenance: 'illustrative' });
    expect(p.expectancy?.edge).toBe('negative');
    expect(p.flags).toContain('negative-expectancy');
    expect(p.provenance).toBe('illustrative');
  });

  it('flags cost-exceeds-edge when friction wipes out a thin positive edge', () => {
    // small position (high friction %) with a tiny positive gross edge
    const p = buildTradePlan({
      symbol: 'THIN', entryPrice: 5, stopPrice: 4.5, accountSize: 300, riskPercentPerTrade: 2,
      crossCurrency: true, liquidity: 15,
      outcome: { winRatePct: 52, avgWinPct: 1.5, avgLossPct: 1.3 }, provenance: 'measured',
    });
    expect(p.expectancy?.edge).toBe('positive');
    expect(p.expectancyNetPct).not.toBeNull();
    expect(p.flags).toContain('cost-exceeds-edge');
  });

  it('marks concept-stage names lottery-tier', () => {
    const p = buildTradePlan({ ...base, lifecycleStage: 'concept' });
    expect(p.flags).toContain('lottery-tier');
  });

  it('reports reward-to-risk and break-even win rate when a target is set', () => {
    const p = buildTradePlan({ ...base, targetPrice: 13 }); // reward 3, risk 1 => 3R
    expect(p.rMultipleToTarget).toBe(3);
    expect(p.breakEvenWinRatePct).toBeCloseTo(25, 1);
  });

  it('provenance is none when no outcome is supplied', () => {
    const p = buildTradePlan(base);
    expect(p.provenance).toBe('none');
    expect(p.expectancy).toBeNull();
  });
});

describe('renderTradePlanText', () => {
  it('renders a neutral, research-only summary with no advice verbs', () => {
    const text = renderTradePlanText(buildTradePlan({ ...base, targetPrice: 13, outcome: { winRatePct: 60, avgWinPct: 10, avgLossPct: 5 }, provenance: 'illustrative' }));
    expect(text).toContain('research only');
    expect(text).toContain('DEMO');
    expect(text.toLowerCase()).not.toMatch(/\byou should\b|\bbuy now\b|\bsell now\b/);
  });
});
