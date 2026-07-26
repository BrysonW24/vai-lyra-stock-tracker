import { describe, expect, it } from 'vitest';
import type { DashboardData } from '@/types/scanner';
import { buildSoloDeviceGrounding } from '@/lib/ai/chat-context';

const data = {
  signals: [
    {
      symbol: 'NVDA',
      close: 208.76,
      score: 45,
      scoreDelta: -22,
      rsi: 52.9,
      status: 'weakening',
    },
  ],
} as unknown as DashboardData;

describe('Solo device grounding', () => {
  it('makes an empty local book authoritative over the bundled sample book', () => {
    const result = buildSoloDeviceGrounding({ holdings: [], watchlist: [] }, data);

    expect(result).toContain('authoritative for this user');
    expect(result).toContain('HOLDINGS: none added on this device.');
    expect(result).toContain('WATCHLIST: none added on this device.');
  });

  it('grounds the model on browser-local fractional holdings, watchlist and cash', () => {
    const result = buildSoloDeviceGrounding(
      {
        holdings: [{ symbol: 'NVDA', quantity: 0.48, averageBuyPrice: 208.76 }],
        watchlist: [{ symbol: 'NVDA', targetBuyPrice: 190 }],
        capital: {
          baseCurrency: 'USD',
          cashAvailable: 10_000,
          monthlyContribution: 500,
          maxPositionSizePct: 10,
          primaryOutcome: 'Learning & discipline',
        },
      },
      data,
    );

    expect(result).toContain('0.48 shares');
    expect(result).toContain('WATCHLIST (device-local)');
    expect(result).toContain('target $190.00');
    expect(result).toContain('cash $10,000.00');
    expect(result).toContain('max position 10%');
  });
});
