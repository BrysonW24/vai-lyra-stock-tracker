import { describe, it, expect } from 'vitest';
import { computeOrientation } from '@/lib/orientation';
import type { IntelligenceItem } from '@/lib/intelligence';

const news = (over: Partial<IntelligenceItem>): IntelligenceItem =>
  ({
    id: Math.random().toString(36).slice(2),
    tickers: ['NVDA'],
    sourceType: 'news',
    sourceName: 'Reuters',
    sourceDomain: 'reuters.com',
    category: 'company',
    headline: 'headline',
    summary: 'summary',
    publishedAt: '2026-07-10T00:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'medium',
    confidence: 'high',
    ...over,
  }) as IntelligenceItem;

describe('computeOrientation', () => {
  it('splits news into opportunities (good) and risks (bad) across held + watched names', () => {
    const o = computeOrientation({
      news: [
        news({ id: 'a', tickers: ['NVDA'], sentiment: 'positive' }),
        news({ id: 'b', tickers: ['AMD'], sentiment: 'negative' }),
        news({ id: 'c', tickers: ['TSLA'], sentiment: 'positive' }), // not held/watched -> dropped
      ],
      heldSymbols: ['NVDA'],
      watchedSymbols: ['AMD'],
    });
    expect(o.opportunities.map((i) => i.symbol)).toEqual(['NVDA']);
    expect(o.risks.map((i) => i.symbol)).toEqual(['AMD']);
    expect(o.opportunities[0].held).toBe(true);
    expect(o.risks[0].watched).toBe(true);
  });

  it('drops neutral news and names the user does not care about', () => {
    const o = computeOrientation({
      news: [news({ tickers: ['NVDA'], sentiment: 'neutral' }), news({ tickers: ['ZZZZ'], sentiment: 'negative' })],
      heldSymbols: ['NVDA'],
      watchedSymbols: [],
    });
    expect(o.opportunities).toHaveLength(0);
    expect(o.risks).toHaveLength(0);
  });

  it('weights held names above watched, and high relevance above low', () => {
    const o = computeOrientation({
      news: [
        news({ id: 'watch-high', tickers: ['AMD'], sentiment: 'negative', relevance: 'high' }), // watched, weight 3
        news({ id: 'held-low', tickers: ['NVDA'], sentiment: 'negative', relevance: 'low' }), // held, weight 1*2=2
        news({ id: 'held-high', tickers: ['NVDA'], sentiment: 'negative', relevance: 'high' }), // held, weight 3*2=6
      ],
      heldSymbols: ['NVDA'],
      watchedSymbols: ['AMD'],
    });
    expect(o.risks[0].id).toBe('held-high'); // highest weight first
  });

  it('counts distinct held and watched names touched by news', () => {
    const o = computeOrientation({
      news: [
        news({ tickers: ['NVDA'], sentiment: 'positive' }),
        news({ tickers: ['NVDA'], sentiment: 'negative' }),
        news({ tickers: ['AMD'], sentiment: 'positive' }),
      ],
      heldSymbols: ['NVDA'],
      watchedSymbols: ['AMD'],
    });
    expect(o.heldNamesWithNews).toBe(1);
    expect(o.watchedNamesWithNews).toBe(1);
  });

  it('respects the per-side limit', () => {
    const items = Array.from({ length: 8 }, (_, i) => news({ id: `n${i}`, tickers: ['NVDA'], sentiment: 'negative' }));
    const o = computeOrientation({ news: items, heldSymbols: ['NVDA'], watchedSymbols: [], limitPerSide: 3 });
    expect(o.risks).toHaveLength(3);
  });
});
