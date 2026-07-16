import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, cacheGet, cacheSet, cacheBackendName, cacheBackendStatus, resetCacheForTests } from '@/lib/cache';

/**
 * The cache contract: Redis (Upstash REST) when configured, in-process fallback otherwise,
 * and EVERY backend failure degrades to a miss - caching may never break a request.
 */
describe('cache', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    // Hermetic: a developer/CI shell may export REAL Upstash creds (they are in
    // .env.example) - blank all four selection vars so the memory suite can never
    // pick the upstash backend and write to a live Redis from a unit test.
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

    it('caps entries at 500 with insertion-order eviction (no unbounded growth)', async () => {
      for (let i = 0; i < 501; i++) await cacheSet(`ev:${i}`, i, 600);
      expect(await cacheGet('ev:0')).toBeNull(); // evicted as the oldest
      expect(await cacheGet('ev:1')).toBe(1);
      expect(await cacheGet('ev:500')).toBe(500);
    });

    it('reports memory status without any network probe', async () => {
      expect(await cacheBackendStatus()).toBe('memory');
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

    it('SETs with EX ttl and GETs the value back through the REST protocol (URL + auth asserted)', async () => {
      const calls: unknown[][] = [];
      const urls: string[] = [];
      const auths: (string | undefined)[] = [];
      stubUpstash((async (url: string, init: RequestInit) => {
        const cmd = JSON.parse(String(init.body)) as unknown[];
        calls.push(cmd);
        urls.push(String(url));
        auths.push((init.headers as Record<string, string>)?.Authorization);
        if (cmd[0] === 'GET') return new Response(JSON.stringify({ result: JSON.stringify({ hit: true }) }));
        return new Response(JSON.stringify({ result: 'OK' }));
      }) as unknown as typeof fetch);

      await cacheSet('quote:AAPL', { hit: true }, 60);
      expect(calls[0]).toEqual(['SET', 'lyra:quote:AAPL', JSON.stringify({ hit: true }), 'EX', 60]);

      expect(await cacheGet('quote:AAPL')).toEqual({ hit: true });
      expect(calls[1]).toEqual(['GET', 'lyra:quote:AAPL']);
      // A regression that posts to the wrong endpoint or drops the bearer must fail here.
      expect(urls.every((u) => u === 'https://example-redis.upstash.io')).toBe(true);
      expect(auths.every((a) => a === 'Bearer test-token')).toBe(true);
    });

    it('treats an Upstash { error } body as a miss, never a throw', async () => {
      stubUpstash((async () =>
        new Response(JSON.stringify({ error: 'WRONGPASS invalid token' }))) as unknown as typeof fetch);
      expect(await cacheGet('anything')).toBeNull();
      await expect(cacheSet('anything', 1, 60)).resolves.toBeUndefined();
    });

    it('cacheBackendStatus PINGs: healthy -> upstash, dead -> upstash-unreachable', async () => {
      stubUpstash((async (_url: string, init: RequestInit) => {
        const cmd = JSON.parse(String(init.body)) as unknown[];
        expect(cmd).toEqual(['PING']);
        return new Response(JSON.stringify({ result: 'PONG' }));
      }) as unknown as typeof fetch);
      expect(await cacheBackendStatus()).toBe('upstash');

      stubUpstash((async () => new Response('nope', { status: 401 })) as unknown as typeof fetch);
      expect(await cacheBackendStatus()).toBe('upstash-unreachable');
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
