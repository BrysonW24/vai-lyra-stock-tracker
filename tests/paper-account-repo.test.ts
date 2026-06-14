import { describe, it, expect } from 'vitest';
import { averageIn, rollupPersisted } from '@/lib/trading/paper-account-repo';

/**
 * Pure-mapping tests for the persistence layer. The Supabase round-trip needs a configured project +
 * an authenticated session (the demo/sim has neither), but the averaging + rollup math is pure and
 * fully testable here - and must reconcile with the in-memory store's fee-inclusive P/L.
 */
describe('paper-account-repo pure mapping', () => {
  it('averageIn opens a new position at the fill price', () => {
    const r = averageIn(null, { side: 'buy', quantity: 10, fillPrice: 205.4 });
    expect(r).toEqual({ quantity: 10, average_price: 205.4 });
  });

  it('averageIn weight-averages a second buy', () => {
    const first = averageIn(null, { side: 'buy', quantity: 10, fillPrice: 200 });
    const second = averageIn(first, { side: 'buy', quantity: 10, fillPrice: 220 });
    expect(second.quantity).toBe(20);
    expect(second.average_price).toBe(210); // (200*10 + 220*10)/20
  });

  it('averageIn reduces quantity on a sell and never goes negative', () => {
    const pos = { quantity: 10, average_price: 200 };
    expect(averageIn(pos, { side: 'sell', quantity: 4, fillPrice: 210 }).quantity).toBe(6);
    expect(averageIn(pos, { side: 'sell', quantity: 99, fillPrice: 210 }).quantity).toBe(0);
  });

  it('averageIn treats a re-entry after close-out (quantity 0) as a fresh position at the new price', () => {
    const closed = { quantity: 0, average_price: 200 };
    const reentry = averageIn(closed, { side: 'buy', quantity: 5, fillPrice: 250 });
    expect(reentry).toEqual({ quantity: 5, average_price: 250 }); // not averaged with the old 200
  });

  it('rollupPersisted marks to price and nets fees into P/L', () => {
    const s = rollupPersisted({
      positions: [{ symbol: 'NVDA', quantity: 10, average_price: 205.4 }],
      feesBySymbol: { NVDA: 1.03 },
      priceOf: () => 205.19,
      startingCash: 100000,
      equityCurve: [100000, 99996.87],
      fillCount: 1,
    });
    // (205.19-205.4)*10 - 1.03 = -2.1 - 1.03 = -3.13
    expect(s.unrealisedPnl).toBe(-3.13);
    expect(s.equity).toBe(round2(100000 - 3.13));
    expect(s.openPositions).toBe(1);
    expect(s.positions[0].unrealisedPnl).toBe(-3.13);
  });

  it('rollupPersisted account P/L reconciles with the sum of position P/L', () => {
    const s = rollupPersisted({
      positions: [
        { symbol: 'NVDA', quantity: 10, average_price: 205.4 },
        { symbol: 'AMD', quantity: 5, average_price: 150 },
      ],
      feesBySymbol: { NVDA: 1.03, AMD: 0.38 },
      priceOf: (sym) => (sym === 'NVDA' ? 210 : 145),
      startingCash: 100000,
      equityCurve: [],
      fillCount: 2,
    });
    const sumPos = Math.round(s.positions.reduce((a, p) => a + p.unrealisedPnl, 0) * 100) / 100;
    expect(s.unrealisedPnl).toBe(sumPos);
    // empty curve is seeded so the sparkline always has >=2 points
    expect(s.equityCurve.length).toBeGreaterThanOrEqual(2);
  });

  it('rollupPersisted drops zero-quantity (fully closed) positions', () => {
    const s = rollupPersisted({
      positions: [{ symbol: 'NVDA', quantity: 0, average_price: 205 }],
      feesBySymbol: {},
      priceOf: () => 210,
      startingCash: 100000,
      equityCurve: [100000],
      fillCount: 3,
    });
    expect(s.openPositions).toBe(0);
  });
});

const round2 = (n: number) => Math.round(n * 100) / 100;
