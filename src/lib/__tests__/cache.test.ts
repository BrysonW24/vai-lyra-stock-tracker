import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, cacheGet, cacheSet, cacheBackendName, resetCacheForTests } from '@/lib/cache';

/**
 * The cache contract: Redis (Upstash REST) when configured, in-process fallback otherwise,
 * and EVERY backend failure degrades to a miss - caching may never break a request.
 */
describe('cache', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetCacheForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetCacheForTests();
  });

  describe('memory backend (no Redis env)', () => {
    it('is selected when no Upstash/KV env vars are set', () => {
      expect(cacheBackendName()).toBe('memory');
    });

    it('stores and returns a JSON value within TTL', async () => {
      await cacheSet('k1', { a: 1 }, 60);
      expect(await cacheGet('k1')).toEqual({ a: 1 });
    });

    it('expires entries after their TTL', async () => {
      vi.useFakeTimers();
      await cacheSet('k2', 'value', 10);
      vi.advanceTimersByTime(9_000);
      expect(await cacheGet('k2')).toBe('value');
      vi.advanceTimersByTime(1_500);
      expect(await cacheGet('k2')).toBeNull();
    });

    it('cached() computes on miss, returns cached on hit, and only calls fn once', async () => {
      const fn = vi.fn(async () => ({ n: 42 }));
      expect(await cached('k3', 60, fn)).toEqual({ n: 42 });
      expect(await cached('k3', 60, fn)).toEqual({ n: 42 });
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('upstash backend (REST env set)', () => {
    const stubUpstash = (impl: typeof fetch) => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example-redis.upstash.io');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
      resetCacheForTests();
      vi.stubGlobal('fetch', impl);
    };

    it('is selected when the Upstash REST env pair is present', () => {
      stubUpstash(vi.fn() as unknown as typeof fetch);
      expect(cacheBackendName()).toBe('upstash');
    });

    it('accepts the legacy Vercel KV env names too', () => {
      vi.stubEnv('KV_REST_API_URL', 'https://example-kv.upstash.io');
      vi.stubEnv('KV_REST_API_TOKEN', 'kv-token');
      resetCacheForTests();
      expect(cacheBackendName()).toBe('upstash');
    });

    it('SETs with EX ttl and GETs the value back through the REST protocol', async () => {
      const calls: unknown[][] = [];
      stubUpstash((async (_url: string, init: RequestInit) => {
        const cmd = JSON.parse(String(init.body)) as unknown[];
        calls.push(cmd);
        if (cmd[0] === 'GET') return new Response(JSON.stringify({ result: JSON.stringify({ hit: true }) }));
        return new Response(JSON.stringify({ result: 'OK' }));
      }) as unknown as typeof fetch);

      await cacheSet('quote:AAPL', { hit: true }, 60);
      expect(calls[0]).toEqual(['SET', 'lyra:quote:AAPL', JSON.stringify({ hit: true }), 'EX', 60]);

      expect(await cacheGet('quote:AAPL')).toEqual({ hit: true });
      expect(calls[1]).toEqual(['GET', 'lyra:quote:AAPL']);
    });

    it('degrades to a miss (and computes) when Redis errors - never throws to the caller', async () => {
      stubUpstash((async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch);
      const fn = vi.fn(async () => 'computed');
      expect(await cached('k4', 60, fn)).toBe('computed');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('treats a non-OK HTTP response as a miss', async () => {
      stubUpstash((async () => new Response('nope', { status: 500 })) as unknown as typeof fetch);
      expect(await cacheGet('missing')).toBeNull();
    });
  });
});
