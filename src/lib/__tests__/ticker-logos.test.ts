import { describe, expect, it } from 'vitest';
import { allTickerSymbols, faviconUrl, tickerDomain, tickerLogoSources, tickerLogoUrl } from '@/lib/ticker-logos';

describe('ticker-logos routing', () => {
  it('maps known tickers to domains, case-insensitively', () => {
    expect(tickerDomain('AMD')).toBe('amd.com');
    expect(tickerDomain('amd')).toBe('amd.com');
    expect(tickerDomain('META')).toBe('meta.com');
  });

  it('returns null for unknown tickers', () => {
    expect(tickerDomain('ZZZZ')).toBeNull();
  });

  it('snaps the favicon size to a served resolution', () => {
    expect(faviconUrl('amd.com', 12)).toContain('sz=32'); // <=16
    expect(faviconUrl('amd.com', 18)).toContain('sz=64'); // <=32
    expect(faviconUrl('amd.com', 64)).toContain('sz=128'); // larger
    expect(faviconUrl('amd.com')).toContain('domain=amd.com');
  });

  it('orders ticker logo sources with the favicon for a known ticker', () => {
    const sources = tickerLogoSources('AMD', 32);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0]).toContain('amd.com');
    expect(tickerLogoUrl('AMD')).toBe(sources[0]);
  });

  it('returns no sources (and a null url) for an unknown ticker with no override', () => {
    expect(tickerLogoSources('ZZZZ')).toEqual([]);
    expect(tickerLogoUrl('ZZZZ')).toBeNull();
  });

  it('exposes a sorted symbol list including the majors', () => {
    const all = allTickerSymbols();
    expect(all).toContain('AMD');
    expect(all).toContain('NVDA');
    expect([...all]).toEqual([...all].sort());
  });
});
