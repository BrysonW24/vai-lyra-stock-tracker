/**
 * Per-provider circuit breaker: after BREAKER_THRESHOLD consecutive completion failures the
 * provider fast-fails (CircuitOpenError) instead of costing every request retries + timeouts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CircuitOpenError, complete, providerBreakerStatus, resetProviderBreakersForTests } from '../gateway';

const PARAMS = {
  provider: 'openai' as const,
  apiKey: 'sk-test-not-real',
  system: 'system',
  prompt: 'prompt',
};

describe('gateway circuit breaker', () => {
  beforeEach(() => {
    resetProviderBreakersForTests();
    // A permanent (non-retryable) failure so each complete() fails in one fast attempt.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('provider hard down (permanent)');
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetProviderBreakersForTests();
  });

  it('opens after 5 consecutive failures and fast-fails the next call', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(complete(PARAMS)).rejects.toThrow('provider hard down');
    }
    expect(providerBreakerStatus().openai).toEqual({ open: true, consecutiveFailures: 5 });

    await expect(complete(PARAMS)).rejects.toBeInstanceOf(CircuitOpenError);
    // The fast-fail never reached the provider - fetch was called only by the 5 real attempts.
    expect(vi.mocked(fetch).mock.calls.length).toBe(5);
  });

  it('a success closes the breaker and resets the failure count', async () => {
    await expect(complete(PARAMS)).rejects.toThrow();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ output_text: 'grounded answer' }), { status: 200 })),
    );
    const result = await complete(PARAMS);
    expect(result.text.length).toBeGreaterThan(0);
    expect(providerBreakerStatus().openai.consecutiveFailures).toBe(0);
  });
});
