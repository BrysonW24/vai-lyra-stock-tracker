import { describe, expect, it } from 'vitest';
import { buildSmallCapResearchBackend, SMALL_CAP_RESEARCH_SOURCES } from '@/lib/small-cap-research';
import type { SignalRow } from '@/types/scanner';

function signal(symbol: string, score: number, volumeRatio: number, scoreDelta = 8): SignalRow {
  return {
    symbol,
    companyName: symbol,
    score,
    scoreDelta,
    status: 'strong_setup',
    actionState: 'buy_review',
    lifecycleState: 'new_signal',
    signalType: 'momentum_recovery',
    scoreBreakdown: { rsiScore: 70, macdScore: 70, priceLocationScore: 70, trendScore: 70, volumeScore: 70 },
    close: 10,
    priceChange1h: 2,
    priceChange1d: 4,
    rsi: 52,
    previousRsi: 49,
    rsiDelta: 3,
    macdHistogram: 0.4,
    previousMacdHistogram: 0.1,
    histDelta: 0.3,
    macdState: 'Improving',
    histogramSlope: 0.3,
    volumeRatio,
    distanceFromLow: 12,
    priceVsSma20: 3,
    priceVsSma50: 6,
    priceVsSma200: 10,
    lastAlert: null,
    lastUpdated: '2026-06-17T00:00:00.000Z',
    explanation: { action: 'buy_review', triggeredBecause: [], missingConfirmation: [], riskNotes: [] },
    summary: { rsi: '', macd: '', volume: '', trend: '', price: '' },
  };
}

describe('small-cap research backend', () => {
  it('includes official primary sources first', () => {
    expect(SMALL_CAP_RESEARCH_SOURCES[0]?.tier).toBe('official-primary');
    expect(SMALL_CAP_RESEARCH_SOURCES.some((source) => source.id === 'edgar')).toBe(true);
  });

  it('builds scored candidates and marks only qualifying names paper-bot eligible', () => {
    const backend = buildSmallCapResearchBackend([signal('BKSY', 82, 2.5)]);
    expect(backend.candidates.length).toBeGreaterThan(0);
    const candidate = backend.candidates.find((item) => item.symbol === 'BKSY');
    expect(candidate).toBeTruthy();
    expect(candidate?.score.totalScore).toBeGreaterThan(0);
    expect(candidate?.paperBot.route).toContain('/paper-bot');
  });
});
