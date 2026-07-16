/**
 * Best-effort in-memory token-bucket rate limiter, shared across API routes.
 *
 * IMPORTANT: buckets live in instance memory, so on serverless each cold instance starts
 * fresh - treat this as abuse damping, not a hard guarantee. A production multi-instance
 * deploy should back this with a shared store (Upstash / Redis / a Supabase table) keyed by
 * the same identity. The interface stays the same, so swapping the store is a one-file change.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const MAX_BUCKETS = 20_000;

/** Named bucket sets so different route classes get independent budgets. */
const registries = new Map<string, Map<string, Bucket>>();

export interface RateLimitOptions {
  /** Distinct budget name (e.g. 'ai', 'lookup'). */
  scope: string;
  /** Max requests allowed in the window. */
  capacity: number;
  /** Window length in milliseconds the capacity refills over. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Whole tokens left after this call (floored). */
  remaining: number;
  /** Seconds until at least one token is available again (0 when allowed). */
  retryAfterSec: number;
}

/**
 * Consume one token for `identity` in the given scope. Deterministic in `nowMs` so it is
 * unit-testable without touching the clock.
 */
export function rateLimit(identity: string, opts: RateLimitOptions, nowMs: number = Date.now()): RateLimitResult {
  const { scope, capacity, windowMs } = opts;
  const refillPerMs = capacity / windowMs;

  let buckets = registries.get(scope);
  if (!buckets) {
    buckets = new Map<string, Bucket>();
    registries.set(scope, buckets);
  }
  if (buckets.size > MAX_BUCKETS) buckets.clear(); // crude memory guard

  const bucket = buckets.get(identity) ?? { tokens: capacity, lastRefillMs: nowMs };
  const refilled = Math.min(capacity, bucket.tokens + (nowMs - bucket.lastRefillMs) * refillPerMs);

  if (refilled < 1) {
    buckets.set(identity, { tokens: refilled, lastRefillMs: nowMs });
    const retryAfterSec = Math.ceil((1 - refilled) / refillPerMs / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  buckets.set(identity, { tokens: refilled - 1, lastRefillMs: nowMs });
  return { allowed: true, remaining: Math.floor(refilled - 1), retryAfterSec: 0 };
}

/** Test/util: wipe all buckets. */
export function resetRateLimits(): void {
  registries.clear();
}

/**
 * Multi-instance rate limiter backed by an Upstash fixed-window counter (INCR + EXPIRE), for the
 * higher-frequency capture paths a single-instance in-memory bucket cannot guard. Degrades to the
 * in-memory rateLimit() when Upstash is unconfigured OR unreachable - so it never fails open on error.
 * Same interface as rateLimit(); swapping the store stays a one-call change per route.
 */
export async function rateLimitShared(
  identity: string,
  opts: RateLimitOptions,
  nowMs: number = Date.now(),
): Promise<RateLimitResult> {
  const { scope, capacity, windowMs } = opts;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const bucketId = Math.floor(nowMs / windowMs);
  const key = `rl:${scope}:${identity}:${bucketId}`;

  try {
    const { upstashCommand } = await import('@/lib/cache');
    const raw = await upstashCommand(['INCR', key]);
    if (raw === null) return rateLimit(identity, opts, nowMs); // not configured -> in-memory
    const count = Number(raw);
    if (count === 1) {
      // First hit in this window - set its TTL. Best-effort; a missed EXPIRE just lets the key linger.
      try {
        await upstashCommand(['EXPIRE', key, windowSec]);
      } catch {
        /* ignore */
      }
    }
    if (count > capacity) {
      const retryAfterSec = Math.max(1, Math.ceil(((bucketId + 1) * windowMs - nowMs) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }
    return { allowed: true, remaining: Math.max(0, capacity - count), retryAfterSec: 0 };
  } catch {
    // Upstash unreachable -> degrade to the in-memory limiter rather than failing open.
    return rateLimit(identity, opts, nowMs);
  }
}
