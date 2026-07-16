import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupMarketQuote, lookupMarketQuoteUncached } from '@/lib/market/quote';
import { cacheGet, cacheSet, resetCacheForTests } from '@/lib/cache';

/**
 * Quote-cache integration: pins the load-bearing invariants of the 60s quote cache.
 *  - valid quotes are cached under quote:SYMBOL and short-circuit Yahoo on the next call
 *  - INVALID results are never written (a transient Yahoo outage must not pin "no data")
 *  - the uncached lookup (used to log fill prices) always bypasses the cache
 */

const yahooBody = (symbol: string, price: number) =>
  JSON.stringify({
    chart: {
      result: [
        {
          meta: {
            symbol,
            currency: 'USD',
            exchangeName: 'NMS',
            regularMarketPrice: price,
            chartPreviousClose: price - 1,
            shortName: `${symbol} Inc.`,
          },
        },
      ],
    },
  });

describe('lookupMarketQuote cache integration', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    // Hermetic: force the in-process cache backend even if a shell exports real creds.
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    vi.unstubAllGlobals();
    resetCacheForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetCacheForTests();
  });

  it('caches a valid quote and short-circuits Yahoo on the second call', async () => {
    const fetchMock = vi.fn(async () => new Response(yahooBody('AAPL', 210)));
    vi.stubGlobal('fetch', fetchMock);

    const first = await lookupMarketQuote('AAPL');
    expect(first.valid).toBe(true);
    expect(first.price).toBe(210);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await lookupMarketQuote('AAPL');
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1); // served from cache, not Yahoo
  });

  it('never caches an invalid result - a transient outage cannot pin "no data"', async () => {
    let down = true;
    const fetchMock = vi.fn(async () =>
      down ? new Response('gone', { status: 500 }) : new Response(yahooBody('NVDA', 130)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const outage = await lookupMarketQuote('NVDA');
    expect(outage.valid).toBe(false);
    expect(await cacheGet('quote:NVDA')).toBeNull(); // nothing pinned

    down = false;
    const recovered = await lookupMarketQuote('NVDA');
    expect(recovered.valid).toBe(true);
    expect(recovered.price).toBe(130);
  });

  it('a pre-seeded cache entry short-circuits the network entirely', async () => {
    const seeded = {
      valid: true, symbol: 'MSFT', name: 'Microsoft', price: 500,
      currency: 'USD', exchange: 'NMS', changePercent: 1,
    };
    await cacheSet('quote:MSFT', seeded, 60);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await lookupMarketQuote('MSFT')).toEqual(seeded);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lookupMarketQuoteUncached bypasses the cache (fill prices must be fresh)', async () => {
    await cacheSet('quote:AMD', { valid: true, symbol: 'AMD', name: null, price: 1, currency: 'USD', exchange: null, changePercent: null }, 60);
    const fetchMock = vi.fn(async () => new Response(yahooBody('AMD', 155)));
    vi.stubGlobal('fetch', fetchMock);

    const fresh = await lookupMarketQuoteUncached('AMD');
    expect(fresh.price).toBe(155); // fetched, not the stale cached 1
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
