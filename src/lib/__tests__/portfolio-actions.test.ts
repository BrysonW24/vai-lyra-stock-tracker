import { describe, it, expect } from 'vitest';
import { computePortfolioActions, thresholdsForRisk } from '@/lib/portfolio-actions';
import type { PortfolioHolding } from '@/types/scanner';

// Minimal holding - the ranker only reads symbol, unrealisedPnlPercent, riskState, signalScore,
// scoreDelta and portfolioWeight, so we cast a partial for the test.
const mk = (over: Partial<PortfolioHolding>): PortfolioHolding =>
  ({
    symbol: 'TST',
    quantity: 10,
    averagePrice: 100,
    currentPrice: 100,
    marketValue: 1000,
    unrealisedPnl: 0,
    unrealisedPnlPercent: 0,
    portfolioWeight: 10,
    signalScore: 60,
    scoreDelta: 0,
    signalStatus: 'neutral',
    actionState: 'hold',
    rsi: 50,
    macdState: 'neutral',
    riskState: 'neutral',
    suggestedAction: '',
    explanation: {} as PortfolioHolding['explanation'],
    ...over,
  }) as PortfolioHolding;

describe('thresholdsForRisk', () => {
  it('widens the loss line and delays profit-taking for aggressive users', () => {
    expect(thresholdsForRisk('conservative').cutLossPct).toBe(-6);
    expect(thresholdsForRisk('aggressive').cutLossPct).toBe(-12);
    expect(thresholdsForRisk('balanced').cutLossPct).toBe(-8);
    expect(thresholdsForRisk('aggressive').takeProfitPct).toBeGreaterThan(thresholdsForRisk('conservative').takeProfitPct);
  });
});

describe('computePortfolioActions', () => {
  it('raises an exit when the thesis is invalidated, as the top item', () => {
    const actions = computePortfolioActions({
      holdings: [mk({ symbol: 'NVDA', riskState: 'invalidated', unrealisedPnlPercent: -4 })],
    });
    expect(actions[0].kind).toBe('exit_invalidated');
    expect(actions[0].urgency).toBe('exit');
    expect(actions[0].symbol).toBe('NVDA');
  });

  it('flags a poor performer past the loss line as a cut-loss', () => {
    const actions = computePortfolioActions({ holdings: [mk({ symbol: 'AMD', unrealisedPnlPercent: -10 })] });
    expect(actions[0].kind).toBe('cut_loss');
    expect(actions[0].urgency).toBe('urgent');
  });

  it('prompts taking profit on an extended winner', () => {
    const actions = computePortfolioActions({ holdings: [mk({ symbol: 'PLTR', unrealisedPnlPercent: 30, riskState: 'overextended' })] });
    expect(actions[0].kind).toBe('take_profit');
  });

  it('flags an over-concentrated position', () => {
    const actions = computePortfolioActions({ holdings: [mk({ symbol: 'MSFT', portfolioWeight: 45 })], maxPositionPct: 20 });
    expect(actions[0].kind).toBe('trim_concentration');
  });

  it('ranks protect-capital moves above grow-capital moves', () => {
    const actions = computePortfolioActions({
      holdings: [
        mk({ symbol: 'WIN', unrealisedPnlPercent: 30, riskState: 'overextended' }), // take_profit (opportunity)
        mk({ symbol: 'BROKE', riskState: 'invalidated', unrealisedPnlPercent: -5 }), // exit (protect)
        mk({ symbol: 'ADD', riskState: 'opportunity', scoreDelta: 5 }), // add (opportunity)
      ],
    });
    expect(actions[0].symbol).toBe('BROKE');
    expect(actions[0].urgency).toBe('exit');
  });

  it('surfaces idle cash only when nothing urgent competes', () => {
    const withUrgent = computePortfolioActions({
      holdings: [mk({ symbol: 'X', riskState: 'invalidated' })],
      cashAvailable: 5000,
      equity: 6000,
    });
    expect(withUrgent.some((a) => a.kind === 'deploy_cash')).toBe(false);

    const calm = computePortfolioActions({ holdings: [], cashAvailable: 5000, equity: 6000 });
    expect(calm.some((a) => a.kind === 'deploy_cash')).toBe(true);
  });

  it('returns a reassuring all-clear when nothing needs action', () => {
    const actions = computePortfolioActions({ holdings: [mk({ symbol: 'CALM', unrealisedPnlPercent: 3, riskState: 'neutral', portfolioWeight: 8 })] });
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe('all_clear');
  });
});
