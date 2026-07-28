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

  it('stamps mode=solo so surfaces stop re-deriving Solo from isSupabaseConfigured (audit V2)', () => {
    // demo source carries mode 'demo'; the Solo projection must upgrade it to 'solo' so a signed-out
    // Solo user is never re-derived as demo (which could leak the seeded sample book on an error).
    expect(demoDashboardData.mode).toBe('demo');
    const solo = buildSoloMarketDashboard(demoDashboardData, demoDashboardData.signals);
    expect(solo.mode).toBe('solo');
  });
});

/**
 * 2026-07-27 audit V4 fixes: Solo holdings now derive a real risk_state (mirroring the worker's
 * risk_state_for) so protect-capital exits fire, and fold the brokerage fee into cost basis so Solo
 * P/L matches the fee-inclusive engine. The old code hardcoded riskState 'neutral' and dropped fees.
 */
describe('Solo risk_state derivation + brokerage fee', () => {
  const base = demoDashboardData.signals[0];
  const sig = (over: Partial<typeof base>) => ({ ...base, ...over });
  // Priced at cost so unrealised % is ~0 - isolates the status-driven risk state.
  const flat = { symbol: base.symbol, quantity: 1, averageBuyPrice: base.close };

  it('maps an invalidated signal to riskState invalidated (fires the exit action)', () => {
    const [h] = buildLocalPortfolioHoldings([flat], [sig({ status: 'invalidated' })]);
    expect(h.riskState).toBe('invalidated');
    expect(h.suggestedAction).toBe('Exit review');
  });

  it('maps weakening -> elevated_risk, strong_setup -> opportunity, watchlist_setup -> watch', () => {
    expect(buildLocalPortfolioHoldings([flat], [sig({ status: 'weakening' })])[0].riskState).toBe('elevated_risk');
    expect(buildLocalPortfolioHoldings([flat], [sig({ status: 'strong_setup' })])[0].riskState).toBe('opportunity');
    expect(buildLocalPortfolioHoldings([flat], [sig({ status: 'watchlist_setup' })])[0].riskState).toBe('watch');
  });

  it('flags an extended winner (>20% up and RSI>70) as overextended', () => {
    const [h] = buildLocalPortfolioHoldings(
      [{ symbol: base.symbol, quantity: 1, averageBuyPrice: base.close / 2 }], // ~100% gain
      [sig({ status: 'no_signal', rsi: 75, close: base.close })],
    );
    expect(h.unrealisedPnlPercent).toBeGreaterThan(20);
    expect(h.riskState).toBe('overextended');
  });

  it('folds the brokerage fee into cost basis so Solo P/L is lower by exactly the fee', () => {
    const [noFee] = buildLocalPortfolioHoldings([{ symbol: base.symbol, quantity: 2, averageBuyPrice: 100 }], [base]);
    const [withFee] = buildLocalPortfolioHoldings([{ symbol: base.symbol, quantity: 2, averageBuyPrice: 100, brokerageFee: 5 }], [base]);
    expect(noFee.unrealisedPnl - withFee.unrealisedPnl).toBeCloseTo(5, 6);
  });

  it('Solo rows carry no DB id (removed by symbol from local storage, not by id)', () => {
    const [h] = buildLocalPortfolioHoldings([flat], [base]);
    expect(h.id).toBeNull();
  });
});
