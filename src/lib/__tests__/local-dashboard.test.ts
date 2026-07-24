import { describe, expect, it } from 'vitest';
import {
  buildLocalPortfolioHoldings,
  buildLocalWatchlistRows,
  buildSoloMarketDashboard,
} from '@/lib/local-dashboard';
import { demoDashboardData } from '@/lib/demo-data';

describe('Solo local dashboard projection', () => {
  const signal = demoDashboardData.signals[0];

  it('uses local quantities and cost basis while pricing from the scan', () => {
    const [holding] = buildLocalPortfolioHoldings(
      [
        {
          symbol: signal.symbol,
          quantity: 2,
          averageBuyPrice: 100,
        },
      ],
      [signal],
    );

    expect(holding.symbol).toBe(signal.symbol);
    expect(holding.quantity).toBe(2);
    expect(holding.currentPrice).toBe(signal.close);
    expect(holding.marketValue).toBe(signal.close * 2);
    expect(holding.portfolioWeight).toBe(100);
  });

  it('does not fabricate a trigger row when the user did not set a target', () => {
    expect(
      buildLocalWatchlistRows([{ symbol: signal.symbol }], [signal]),
    ).toEqual([]);
  });

  it('computes target distance in percentage points', () => {
    const target = signal.close / 1.048;
    const [row] = buildLocalWatchlistRows(
      [{ symbol: signal.symbol, targetBuyPrice: target }],
      [signal],
    );

    expect(row.distanceToTarget).toBeCloseTo(4.8, 5);
    expect(row.triggerState).toBe('approaching');
  });

  it('never exposes seeded personal data as a Solo user book', () => {
    const solo = buildSoloMarketDashboard(
      demoDashboardData,
      demoDashboardData.signals,
    );

    expect(demoDashboardData.portfolio.length).toBeGreaterThan(0);
    expect(demoDashboardData.watchlist.length).toBeGreaterThan(0);
    expect(solo.portfolio).toEqual([]);
    expect(solo.watchlist).toEqual([]);
    expect(solo.alerts).toEqual([]);
    expect(solo.latestRun.portfolioOverlaysCreated).toBe(0);
    expect(solo.latestRun.watchlistOverlaysCreated).toBe(0);
    expect(solo.latestRun.alertsSent).toBe(0);
  });
});
