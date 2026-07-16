/**
 * Provider resilience primitives - ported from the Vivacity agent-runtime (retry-backoff) and
 * adapted to standalone Lyra. Zero dependencies, and `sleep`/`rand` are injectable so the backoff
 * is deterministically testable without touching the clock.
 *
 * Two things a robust agent harness needs and Lyra lacked: bounded retry with exponential backoff
 * on ONLY transient failures (never retry a bad key), and bounded concurrency so a burst of agent
 * calls cannot fan out unbounded into the providers.
 */

export interface RetryPolicy {
  /** Max attempts including the first (default 4). */
  maxAttempts?: number;
  /** Base delay in ms for the first backoff (default 500). */
  baseDelayMs?: number;
  /** Ceiling on any single backoff (default 8000). */
  maxDelayMs?: number;
  /** Multiplicative growth per attempt (default 2). */
  factor?: number;
}

export interface RetryOptions {
  policy?: RetryPolicy;
  /** Decide whether an error is worth retrying. Default: transient HTTP/network classes. */
  isRetryable?: (err: unknown) => boolean;
  /** Injectable sleep (default real setTimeout). */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable jitter source in [0,1) (default Math.random). */
  rand?: () => number;
  /** Called before each retry with (attempt, delayMs, err) - for logging/tests. */
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
}

const DEFAULT_POLICY: Required<RetryPolicy> = { maxAttempts: 4, baseDelayMs: 500, maxDelayMs: 8000, factor: 2 };

/** Default transient-error classifier: 429/5xx/408 + common network error codes. */
export function defaultIsRetryable(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  if (/\b(?:408|429|500|502|503|504)\b/.test(m)) return true;
  return /timeout|timed out|network|fetch failed|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket/i.test(m);
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn` with bounded exponential backoff + jitter, retrying ONLY on retryable errors. A
 * permanent error (bad key, model-not-found) throws immediately - retrying just burns calls.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const policy = { ...DEFAULT_POLICY, ...(options.policy ?? {}) };
  const isRetryable = options.isRetryable ?? defaultIsRetryable;
  const sleep = options.sleep ?? realSleep;
  const rand = options.rand ?? Math.random;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= policy.maxAttempts || !isRetryable(err)) throw err;
      const raw = Math.min(policy.maxDelayMs, policy.baseDelayMs * Math.pow(policy.factor, attempt - 1));
      // Full jitter in [raw/2, raw] so retries de-synchronise across concurrent callers.
      const delayMs = Math.round(raw / 2 + rand() * (raw / 2));
      options.onRetry?.(attempt, delayMs, err);
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

export class BackpressureError extends Error {
  constructor(message = 'backpressure: too many queued tasks') {
    super(message);
    this.name = 'BackpressureError';
  }
}

/**
 * Bounded-concurrency limiter with a bounded wait queue. Keeps at most `maxConcurrent` tasks in
 * flight; excess tasks wait, and if the wait queue exceeds `maxQueue` the limiter rejects with
 * BackpressureError rather than letting memory grow without limit.
 */
export class BackpressureLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number = 1000,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) throw new BackpressureError();
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  get inFlight(): number {
    return this.active;
  }

  get queued(): number {
    return this.queue.length;
  }
}
