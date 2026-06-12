import { describe, expect, it } from 'vitest';
import { derivePrimeSetups } from '@/lib/prime-setups';
import type { SignalRow } from '@/types/scanner';

function row(overrides: Partial<SignalRow>): SignalRow {
  return {
    symbol: 'TEST',
    companyName: 'Test Corp',
    close: 100,
    rsi: 50,
    rsiDelta: 0,
    macdHistogram: 0.5,
    histDelta: 0.1,
    score: 60,
    scoreDelta: 0,
    status: 'no_signal',
    priceChange1d: 0,
    volumeRatio: 1,
    ...overrides,
  } as unknown as SignalRow;
}

// A genuine strong setup that momentum also confirms (RSI rising, MACD up, volume, score up).
const PRIME = row({
  symbol: 'PRIME',
  status: 'strong_setup',
  score: 82,
  scoreDelta: 5,
  rsi: 45,
  rsiDelta: 2,
  histDelta: 0.2,
  volumeRatio: 1.4,
});

// A watchlist name gaining score - approaching, not prime.
const WATCH = row({
  symbol: 'WATCH',
  status: 'watchlist_setup',
  score: 64,
  scoreDelta: 6,
  rsi: 50,
  rsiDelta: 1,
  histDelta: 0.1,
  volumeRatio: 0.8,
});

// Fading name - belongs in neither bucket.
const QUIET = row({
  symbol: 'QUIET',
  status: 'weakening',
  score: 40,
  scoreDelta: -3,
  rsi: 70,
  rsiDelta: -1,
  histDelta: -0.2,
  volumeRatio: 0.5,
});

describe('derivePrimeSetups - bucketing', () => {
  it('flags a confirming strong_setup as prime', () => {
    const { prime } = derivePrimeSetups([PRIME, WATCH, QUIET]);
    expect(prime.map((p) => p.signal.symbol)).toEqual(['PRIME']);
    expect(prime[0].tier).toBe('prime');
  });

  it('counts all four confirmation conditions', () => {
    const { prime } = derivePrimeSetups([PRIME]);
    // RSI rising + MACD up + volume >=1 + score up = 4/4.
    expect(prime[0].confirming).toBe(4);
    expect(prime[0].reasons).toContain('MACD turning up');
  });

  it('puts a gaining watchlist name in approaching, not prime', () => {
    const { prime, approaching } = derivePrimeSetups([WATCH]);
    expect(prime).toHaveLength(0);
    expect(approaching.map((p) => p.signal.symbol)).toEqual(['WATCH']);
    expect(approaching[0].tier).toBe('approaching');
  });

  it('excludes a fading name from both buckets', () => {
    const { prime, approaching } = derivePrimeSetups([QUIET]);
    expect(prime).toHaveLength(0);
    expect(approaching).toHaveLength(0);
  });

  it('never lists a prime name in approaching as well', () => {
    const { prime, approaching } = derivePrimeSetups([PRIME, WATCH, QUIET]);
    const primeSymbols = new Set(prime.map((p) => p.signal.symbol));
    expect(approaching.some((a) => primeSymbols.has(a.signal.symbol))).toBe(false);
  });
});

describe('derivePrimeSetups - fallback when nothing is officially strong', () => {
  it('surfaces a high-score (>=75), highly-confirming name as prime', () => {
    const fallback = row({
      symbol: 'FALL',
      status: 'watchlist_setup',
      score: 78,
      scoreDelta: 2,
      rsi: 40,
      rsiDelta: 1,
      histDelta: 0.3,
      volumeRatio: 1.2,
    });
    const { prime } = derivePrimeSetups([fallback, WATCH]);
    expect(prime.map((p) => p.signal.symbol)).toContain('FALL');
  });

  it('returns empty buckets honestly when the radar is quiet', () => {
    const { prime, approaching } = derivePrimeSetups([QUIET]);
    expect(prime).toHaveLength(0);
    expect(approaching).toHaveLength(0);
  });
});
