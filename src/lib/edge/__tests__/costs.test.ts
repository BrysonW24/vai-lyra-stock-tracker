import { describe, it, expect } from 'vitest';
import { computeTradeCost, effectiveSlippagePct, DEFAULT_COST_MODEL } from '../costs';

describe('effectiveSlippagePct', () => {
  it('returns the base for a deep-liquidity name', () => {
    expect(effectiveSlippagePct(0.1, 100)).toBeCloseTo(0.1, 4);
  });

  it('widens for thin names - a micro-cap fills much worse', () => {
    // liquidity 0 => base * (1 + 1*4) = 5x
    expect(effectiveSlippagePct(0.1, 0)).toBeCloseTo(0.5, 4);
    // liquidity 50 => base * 3
    expect(effectiveSlippagePct(0.1, 50)).toBeCloseTo(0.3, 4);
  });

  it('treats missing liquidity as mid-book 60 (conservative), not best-case', () => {
    // liquidity 60 => base * (1 + 0.4*4) = base * 2.6
    expect(effectiveSlippagePct(0.1, undefined)).toBeCloseTo(0.26, 4);
  });
});

describe('computeTradeCost', () => {
  it('is dominated by the fixed commission floor on a tiny position', () => {
    // $300 notional: % commission is 0.30/side but the $3 floor binds => $3/side => $6 round trip
    const c = computeTradeCost({ notional: 300 });
    expect(c.commission).toBe(6);
    // that alone is 2% of a $300 position
    expect(c.breakEvenMovePct).toBeGreaterThan(2);
  });

  it('shows the fixed commission barely matters on a large position', () => {
    const small = computeTradeCost({ notional: 300 });
    const large = computeTradeCost({ notional: 30000 });
    expect(large.breakEvenMovePct).toBeLessThan(small.breakEvenMovePct);
  });

  it('adds FX cost on both legs for a cross-currency trade', () => {
    const domestic = computeTradeCost({ notional: 10000 });
    const foreign = computeTradeCost({ notional: 10000, crossCurrency: true });
    expect(foreign.fx).toBeGreaterThan(0);
    expect(domestic.fx).toBe(0);
    // FX = 0.5% * 10000 * 2 = 100
    expect(foreign.fx).toBeCloseTo(100, 2);
    expect(foreign.roundTripCost).toBeGreaterThan(domestic.roundTripCost);
  });

  it('charges more slippage on an illiquid name', () => {
    const deep = computeTradeCost({ notional: 10000, liquidity: 100 });
    const thin = computeTradeCost({ notional: 10000, liquidity: 10 });
    expect(thin.slippage).toBeGreaterThan(deep.slippage);
  });

  it('break-even move equals cost as a percent of notional', () => {
    const c = computeTradeCost({ notional: 5000, crossCurrency: true, liquidity: 30 });
    expect(c.breakEvenMovePct).toBeCloseTo(c.costPctOfNotional, 4);
  });

  it('handles a zero position without dividing by zero', () => {
    const c = computeTradeCost({ notional: 0 });
    expect(c.costPctOfNotional).toBe(0);
    expect(c.breakEvenMovePct).toBe(0);
  });

  it('uses the default cost model when none is supplied', () => {
    const c = computeTradeCost({ notional: 10000 });
    expect(c.effectiveSlippagePct).toBeCloseTo(effectiveSlippagePct(DEFAULT_COST_MODEL.baseSlippagePct, 60), 4);
  });
});
