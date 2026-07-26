import { describe, it, expect } from 'vitest';
import { computeNextBestActions } from '@/lib/next-best-actions';

const sig = (symbol: string, score: number, status = 'strong_setup') => ({ symbol, score, status, companyName: symbol });

describe('computeNextBestActions', () => {
  it('ranks an underwater holding (past the comfort stop) as the top urgent action', () => {
    const out = computeNextBestActions({
      signals: [sig('NVDA', 80)],
      portfolio: [{ symbol: 'AMD', unrealisedPnl: -200, marketValue: 1800 }], // cost 2000 -> -10%
      watchlist: [],
      profile: { riskComfort: 'balanced', portfolioCount: 1, watchlistCount: 1 },
    });
    expect(out[0].kind).toBe('review_position');
    expect(out[0].tone).toBe('urgent');
    expect(out[0].symbol).toBe('AMD');
    expect(out[0].title).toMatch(/down 10%/);
  });

  it('proposes a strong, un-tracked setup as a reversible add-to-watchlist action', () => {
    const out = computeNextBestActions({
      signals: [sig('NVDA', 82)],
      portfolio: [],
      watchlist: [],
      profile: { portfolioCount: 1, watchlistCount: 1 },
    });
    const nvda = out.find((a) => a.symbol === 'NVDA');
    expect(nvda?.kind).toBe('watch_setup');
    expect(nvda?.cta?.addWatchlist).toBe(true);
  });

  it('does NOT propose adding a setup you already hold or watch', () => {
    const out = computeNextBestActions({
      signals: [sig('NVDA', 82)],
      portfolio: [{ symbol: 'NVDA', unrealisedPnl: 100, marketValue: 2100 }],
      watchlist: [],
      profile: { portfolioCount: 1, watchlistCount: 1 },
    });
    expect(out.find((a) => a.kind === 'watch_setup')).toBeUndefined();
  });

  it('surfaces a triggered watchlist name as an opportunity', () => {
    const out = computeNextBestActions({
      signals: [],
      portfolio: [{ symbol: 'X', unrealisedPnl: 0, marketValue: 1000 }],
      watchlist: [{ symbol: 'TSLA', triggerState: 'triggered', distanceToTarget: 0 }],
      profile: { portfolioCount: 1, watchlistCount: 1 },
    });
    const tsla = out.find((a) => a.symbol === 'TSLA');
    expect(tsla?.kind).toBe('approaching_target');
    expect(tsla?.title).toMatch(/at its target/);
  });

  it('renders watchlist distance in percentage points without multiplying it twice', () => {
    const out = computeNextBestActions({
      signals: [],
      portfolio: [{ symbol: 'X', unrealisedPnl: 0, marketValue: 1000 }],
      watchlist: [
        {
          symbol: 'TSLA',
          triggerState: 'approaching',
          distanceToTarget: 4.8,
        },
      ],
      profile: { portfolioCount: 1, watchlistCount: 1 },
    });
    const tsla = out.find((action) => action.symbol === 'TSLA');
    expect(tsla?.detail).toContain('Distance 4.8%');
    expect(tsla?.detail).not.toContain('480%');
  });

  it('conservative comfort flags risk sooner than balanced', () => {
    const port = [{ symbol: 'AMD', unrealisedPnl: -120, marketValue: 1880 }]; // cost 2000 -> -6%
    const balanced = computeNextBestActions({ signals: [], portfolio: port, watchlist: [], profile: { riskComfort: 'balanced', portfolioCount: 1, watchlistCount: 1 } });
    const conservative = computeNextBestActions({ signals: [], portfolio: port, watchlist: [], profile: { riskComfort: 'conservative', portfolioCount: 1, watchlistCount: 1 } });
    expect(balanced.find((a) => a.kind === 'review_position')).toBeUndefined(); // -6% within balanced -8%
    expect(conservative.find((a) => a.kind === 'review_position')).toBeTruthy(); // -6% past conservative -5%
  });

  it('shows setup gaps in the empty state (no signals to supersede them)', () => {
    const out = computeNextBestActions({ signals: [], portfolio: [], watchlist: [], profile: { watchlistCount: 0, portfolioCount: 0 } });
    expect(out.find((a) => a.id === 'gap-watchlist')).toBeTruthy();
    expect(out.find((a) => a.id === 'gap-portfolio')).toBeTruthy();
  });

  it('prefers a concrete strong-setup suggestion over the generic watchlist gap (dedupe by symbol)', () => {
    const out = computeNextBestActions({ signals: [sig('NVDA', 90)], portfolio: [], watchlist: [], profile: { watchlistCount: 0, portfolioCount: 0 } });
    // NVDA surfaces as a watch_setup, so the generic gap-watchlist is suppressed for NVDA.
    expect(out.find((a) => a.kind === 'watch_setup' && a.symbol === 'NVDA')).toBeTruthy();
    expect(out.find((a) => a.id === 'gap-watchlist')).toBeUndefined();
  });

  it('dedupes to one action per symbol and caps at the limit', () => {
    const out = computeNextBestActions(
      {
        signals: [sig('A', 90), sig('B', 88), sig('C', 86), sig('D', 84), sig('E', 82), sig('F', 80)],
        portfolio: [],
        watchlist: [],
        profile: { portfolioCount: 1, watchlistCount: 1 },
      },
      5,
    );
    expect(out.length).toBeLessThanOrEqual(5);
    const symbols = out.map((a) => a.symbol);
    expect(new Set(symbols).size).toBe(symbols.length); // no duplicate symbols
  });
});
