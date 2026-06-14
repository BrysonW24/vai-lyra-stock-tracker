import { describe, it, expect } from 'vitest';
import { computeTradeAnalytics, closePaperPosition, recordPaperFill, getPaperAccountSummary } from '@/lib/trading/paper-account-store';

/**
 * Realised-P/L + trade analytics. computeTradeAnalytics is pure; the close round-trip exercises the
 * in-memory store (records a buy, closes it, and checks the realised P/L + analytics surface).
 */
describe('trade analytics', () => {
  it('computeTradeAnalytics returns zeros for no closed trades', () => {
    const a = computeTradeAnalytics([]);
    expect(a).toEqual({ realisedPnl: 0, closedTrades: 0, wins: 0, losses: 0, winRate: 0, avgWin: 0, avgLoss: 0, expectancy: 0 });
  });

  it('computeTradeAnalytics computes win rate, avg win/loss, expectancy', () => {
    const a = computeTradeAnalytics([100, 50, -40, -10]); // 2 wins (avg 75), 2 losses (avg 25)
    expect(a.closedTrades).toBe(4);
    expect(a.wins).toBe(2);
    expect(a.losses).toBe(2);
    expect(a.winRate).toBe(50);
    expect(a.avgWin).toBe(75);
    expect(a.avgLoss).toBe(25);
    expect(a.realisedPnl).toBe(100);
    // 0.5*75 - 0.5*25 = 25
    expect(a.expectancy).toBe(25);
  });

  it('treats a scratch (0) as a non-win', () => {
    const a = computeTradeAnalytics([0, 20]);
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.winRate).toBe(50);
  });

  it('close round-trip realises P/L into the account summary', async () => {
    recordPaperFill({ symbol: 'TESTX', side: 'buy', quantity: 10, fillPrice: 100, simulatedFee: 0.5 });
    const closed = closePaperPosition('TESTX', 110, 0.55); // gross (110-100)*10=100, minus fees 0.5+0.55
    expect(closed).not.toBeNull();
    expect(closed!.realisedPnl).toBe(98.95);

    const summary = await getPaperAccountSummary();
    expect(summary.closedTrades).toBeGreaterThanOrEqual(1);
    // TESTX is no longer an open position
    expect(summary.positions.find((p) => p.symbol === 'TESTX')).toBeUndefined();
    // realised P/L is reflected in equity (start + realised + unrealised)
    expect(summary.realisedPnl).toBeGreaterThanOrEqual(98.95);
  });

  it('closePaperPosition returns null when there is nothing to close', () => {
    expect(closePaperPosition('NOPELX', 100, 0.5)).toBeNull();
  });
});
