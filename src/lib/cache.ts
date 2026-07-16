/**
 * Server-side cache with a Redis backend and a safe in-process fallback.
 *
 * Backend selection (at first use, per server process):
 *   1. Upstash Redis over REST when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 *      are set (the Vercel marketplace "Upstash for Redis" integration injects these;
 *      the legacy Vercel KV names `KV_REST_API_URL` + `KV_REST_API_TOKEN` are also accepted).
 *      REST is deliberate: serverless-safe (no TCP connection churn) and zero dependencies.
 *   2. Otherwise an in-process TTL map, so demo mode and keyless deploys work unchanged.
 *
 * Contract: caching is an OPTIMISATION, never a requirement. Every backend error degrades
 * to a miss (compute the value) - a broken Redis must never break a request. Only
 * JSON-serialisable values belong here, and never secrets or per-user private data unless
 * the key is scoped to that user.
 */

interface CacheBackend {
  readonly name: 'upstash' | 'memory';
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Liveness probe (network backends only). Throws when the backend is unreachable. */
  ping?(): Promise<void>;
}

/** Namespace every key so a shared Redis can host more than one app safely. */
const PREFIX = 'lyra:';

// --- Upstash REST backend ------------------------------------------------------------------

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

function upstashBackend(cfg: { url: string; token: string }): CacheBackend {
  // Single-command endpoint: POST the command as a JSON array, get { result } back.
  const command = async (cmd: (string | number)[], signal?: AbortSignal): Promise<unknown> => {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
      cache: 'no-store',
      signal,
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) throw new Error(json.error);
    return json.result;
  };
  return {
    name: 'upstash',
    async get(key) {
      const result = await command(['GET', PREFIX + key]);
      return typeof result === 'string' ? result : null;
    },
    async set(key, value, ttlSeconds) {
      await command(['SET', PREFIX + key, value, 'EX', Math.max(1, Math.floor(ttlSeconds))]);
    },
    async ping() {
      // Short deadline: health checks must stay fast even when Redis is unreachable.
      await command(['PING'], AbortSignal.timeout(800));
    },
  };
}

/**
 * Low-level Upstash REST command for callers that need more than get/set (e.g. INCR/EXPIRE for a
 * shared rate limiter). Returns null when Upstash is NOT configured (caller falls back). Throws on a
 * transport error so the caller can decide how to degrade.
 */
export async function upstashCommand(cmd: (string | number)[]): Promise<unknown | null> {
  const cfg = upstashConfig();
  if (!cfg) return null;
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result ?? null;
}

// --- In-process fallback backend -----------------------------------------------------------

const MEMORY_MAX_ENTRIES = 500;

function memoryBackend(): CacheBackend {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    name: 'memory',
    async get(key) {
      const hit = store.get(key);
      if (!hit) return null;
      if (Date.now() >= hit.expiresAt) {
        store.delete(key);
        return null;
      }
      return hit.value;
    },
    async set(key, value, ttlSeconds) {
      // Simple insertion-order eviction keeps the map bounded; entries also self-expire on read.
      if (store.size >= MEMORY_MAX_ENTRIES && !store.has(key)) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.delete(key); // refresh insertion order on overwrite
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
  };
}

// --- Public API -----------------------------------------------------------------------------

let backend: CacheBackend | null = null;

function getBackend(): CacheBackend {
  if (!backend) {
    const cfg = upstashConfig();
    backend = cfg ? upstashBackend(cfg) : memoryBackend();
  }
  return backend;
}

/** Which backend is SELECTED from env (no liveness implied) - see cacheBackendStatus(). */
export function cacheBackendName(): 'upstash' | 'memory' {
  return getBackend().name;
}

/**
 * Verified backend status for /api/health. Because every cache operation swallows errors
 * (cache is an optimisation, never a requirement), this probe is the ONE place a broken
 * Redis can surface: a dead/revoked Upstash reports 'upstash-unreachable' instead of
 * silently missing forever. Never throws; bounded at ~800ms; health's ok stays unconditional.
 */
export async function cacheBackendStatus(): Promise<'upstash' | 'upstash-unreachable' | 'memory'> {
  const b = getBackend();
  if (b.name !== 'upstash') return 'memory';
  try {
    await b.ping?.();
    return 'upstash';
  } catch {
    return 'upstash-unreachable';
  }
}

/** Test seam: reset backend selection (e.g. after changing env in a test). */
export function resetCacheForTests(): void {
  backend = null;
}

/** Read a cached JSON value. Any backend error reads as a miss, never a failure. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const hit = await getBackend().get(key);
    return hit !== null ? (JSON.parse(hit) as T) : null;
  } catch {
    return null;
  }
}

/** Store a JSON value best-effort. AWAIT this (it never throws): on serverless, un-awaited
 *  work can be frozen mid-flight when the response is sent, silently dropping the write.
 *  The Upstash REST SET is single-digit ms; the memory backend is synchronous in practice. */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await getBackend().set(key, JSON.stringify(value), ttlSeconds);
  } catch {
    // Best-effort write; the caller already has the value.
  }
}

/**
 * Read-through cache. On hit, returns the cached value; on miss (or any backend error),
 * computes `fn()` and stores the result best-effort. `ttlSeconds` bounds staleness - pick it
 * per call site from how fresh the data must be, not from what feels fast. When some results
 * must not be cached (e.g. transient failures), use cacheGet/cacheSet directly instead.
 */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await fn();
  // Awaited deliberately: fire-and-forget writes get dropped on serverless freeze.
  await cacheSet(key, value, ttlSeconds);
  return value;
}
