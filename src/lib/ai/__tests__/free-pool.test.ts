/**
 * The free pool: open models on free hosted tiers, tried in order, capped per caller.
 * Pins that the chain is Lyra's configuration and never the caller's, that a provider which says
 * "not now" is left alone for as long as it asked, that a reasoning model's thinking neither
 * reaches the reader nor eats the answer, and that one caller cannot drain everyone's allowance.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => ({ store: new Map<string, number | string>(), configured: true }));

vi.mock('@/lib/cache', () => ({
  sharedStoreConfigured: () => redis.configured,
  upstashCommand: async (cmd: (string | number)[]) => {
    if (!redis.configured) return null;
    const [op, key] = cmd as [string, string];
    if (op === 'INCR') {
      const next = Number(redis.store.get(key) ?? 0) + 1;
      redis.store.set(key, next);
      return next;
    }
    if (op === 'SET') {
      redis.store.set(key, String(cmd[2]));
      return 'OK';
    }
    if (op === 'EXISTS') return redis.store.has(key) ? 1 : 0;
    if (op === 'EXPIRE') return 1;
    return null;
  },
}));

import { CircuitOpenError, complete, providerBreakerStatus, resetProviderBreakersForTests } from '../gateway';
import { resetRateLimits } from '@/lib/ratelimit';
import { chargeFreeCaps, completeFromPool, DEFAULT_POOL, freePoolAvailable, parsePool, poolTargets, resetFreePoolForTests } from '../free-pool';

const NOW = Date.parse('2026-11-06T03:00:00Z');

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Stand in for fetch: play back one reply per call (the last repeats) and keep what was sent. */
function provider(...replies: Array<{ status?: number; content?: unknown; retryAfter?: string }>) {
  const sent: Sent[] = [];
  let index = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
      sent.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      const reply = replies[Math.min(index++, replies.length - 1)];
      const status = reply.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers(reply.retryAfter ? { 'retry-after': reply.retryAfter } : {}),
        json: async () => ({ choices: [{ message: { content: reply.content ?? '' } }], usage: { prompt_tokens: 900, completion_tokens: 80 } }),
      };
    }),
  );
  return sent;
}

const REQUEST = { system: 'system text', prompt: 'User: how is NVDA?\nLyra:', maxTokens: 600 };

describe('the free pool', () => {
  beforeEach(() => {
    redis.store.clear();
    redis.configured = true;
    resetFreePoolForTests();
    resetProviderBreakersForTests();
    resetRateLimits();
    vi.stubEnv('GROQ_API_KEY', 'groq-free-key');
    vi.stubEnv('CLOUDFLARE_AI_TOKEN', 'cf-free-token');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'acct123');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reads the chain in order and skips an entry it cannot use', () => {
    expect(parsePool(' groq:openai/gpt-oss-120b , cloudflare:@cf/google/gemma-4-26b-a4b-it, nowhere:model, groq: ,')).toEqual([
      { provider: 'groq', model: 'openai/gpt-oss-120b' },
      { provider: 'cloudflare', model: '@cf/google/gemma-4-26b-a4b-it' },
    ]);
    // A model id may itself contain a colon: only the first one splits.
    expect(parsePool('openrouter:meta-llama/llama-3.2-3b-instruct:free')[0].model).toBe('meta-llama/llama-3.2-3b-instruct:free');
    expect(parsePool(undefined)).toEqual([]);
    expect(parsePool(DEFAULT_POOL).map((target) => target.provider)).toEqual(['cloudflare', 'groq', 'groq', 'groq']);
  });

  it('is only the targets this deployment holds a key for', () => {
    expect(poolTargets().length).toBe(4);
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
    expect(poolTargets().map((target) => target.provider)).toEqual(['groq', 'groq', 'groq']); // a token with no account id cannot be used
    vi.stubEnv('GROQ_API_KEY', '');
    expect(freePoolAvailable()).toBe(false);
    vi.stubEnv('LYRA_FREE_POOL', 'openrouter:meta-llama/llama-3.2-3b-instruct:free');
    vi.stubEnv('OPENROUTER_API_KEY', 'or-key');
    expect(poolTargets()).toEqual([{ provider: 'openrouter', model: 'meta-llama/llama-3.2-3b-instruct:free' }]);
  });

  it('moves past a provider that says not now, and leaves it alone for as long as it asked', async () => {
    const sent = provider({ status: 429, retryAfter: '30' }, { content: 'NVDA is a strong setup.' });
    const first = await completeFromPool(REQUEST, NOW);
    expect(first.ok && first.result.text).toBe('NVDA is a strong setup.');
    expect(first.ok && first.result.provider).toBe('groq');
    expect(first.ok && first.result.costUsd).toBe(0);
    expect(first.tried).toEqual([
      { target: 'cloudflare:@cf/google/gemma-4-26b-a4b-it', reason: 'provider_rate_limited' },
      { target: 'groq:openai/gpt-oss-120b', reason: 'ok' },
    ]);
    expect(sent[0].url).toBe('https://api.cloudflare.com/client/v4/accounts/acct123/ai/v1/chat/completions');
    expect(sent[0].headers.authorization).toBe('Bearer cf-free-token');
    expect(sent[1].url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(sent[1].headers.authorization).toBe('Bearer groq-free-key');

    // The next caller does not knock on Cloudflare's door again while it is cooling.
    const again = await completeFromPool(REQUEST, NOW + 5_000);
    expect(again.tried[0]).toEqual({ target: 'cloudflare:@cf/google/gemma-4-26b-a4b-it', reason: 'cooling' });
    expect(sent.length).toBe(3);
    expect(redis.store.has('pool:cool:cloudflare:@cf/google/gemma-4-26b-a4b-it')).toBe(true);
  });

  it('asks a reasoning model for a little effort, hides the thinking and leaves it room', async () => {
    vi.stubEnv('LYRA_FREE_POOL', 'groq:openai/gpt-oss-120b');
    const sent = provider({ content: '<think>the user wants NVDA</think>\nNVDA is a strong setup.' });
    const outcome = await completeFromPool(REQUEST, NOW);
    expect(outcome.ok && outcome.result.text).toBe('NVDA is a strong setup.');
    expect(sent[0].body).toMatchObject({ model: 'openai/gpt-oss-120b', reasoning_effort: 'low', include_reasoning: false, max_completion_tokens: 1300 });
    expect(sent[0].body).not.toHaveProperty('max_tokens');

    vi.stubEnv('LYRA_FREE_POOL', 'groq:qwen/qwen3.8-27b');
    const qwen = provider({ content: 'ok' });
    await completeFromPool(REQUEST, NOW);
    expect(qwen[0].body).toMatchObject({ reasoning_format: 'hidden' });
    expect(qwen[0].body).not.toHaveProperty('include_reasoning');

    vi.stubEnv('LYRA_FREE_POOL', 'cloudflare:@cf/google/gemma-4-26b-a4b-it');
    const gemma = provider({ content: 'ok' });
    await completeFromPool(REQUEST, NOW);
    expect(gemma[0].body).toMatchObject({ max_tokens: 600 });
    expect(gemma[0].body).not.toHaveProperty('reasoning_effort');
  });

  it('asks again plainly when an endpoint refuses a reasoning field', async () => {
    vi.stubEnv('LYRA_FREE_POOL', 'groq:openai/gpt-oss-120b');
    const sent = provider({ status: 400 }, { content: 'answered' });
    const outcome = await completeFromPool(REQUEST, NOW);
    expect(outcome.ok && outcome.result.text).toBe('answered');
    expect(sent[0].body).toHaveProperty('reasoning_effort');
    expect(sent[1].body).not.toHaveProperty('reasoning_effort');
  });

  it('treats an empty answer as no answer and tries the next model', async () => {
    const sent = provider({ content: '<think>only thoughts</think>' }, { content: 'A real answer.' });
    const outcome = await completeFromPool(REQUEST, NOW);
    expect(outcome.ok && outcome.result.text).toBe('A real answer.');
    expect(outcome.tried.map((attempt) => attempt.reason)).toEqual(['empty_response', 'ok']);
    expect(sent.length).toBe(2);
  });

  it('says exhausted when nobody can answer, and no_key when the pool was never set up', async () => {
    provider({ status: 429 });
    const outcome = await completeFromPool(REQUEST, NOW);
    expect(outcome).toMatchObject({ ok: false, reason: 'free_pool_exhausted' });
    expect(outcome.tried.length).toBe(4);
    // Every target is now cooling (a 429 with no Retry-After = ten minutes), in Redis and in memory.
    expect([...redis.store.keys()].filter((key) => key.startsWith('pool:cool:')).length).toBe(4);

    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('CLOUDFLARE_AI_TOKEN', '');
    expect(await completeFromPool(REQUEST, NOW)).toEqual({ ok: false, reason: 'no_key', tried: [] });
  });

  it('leaves a provider that rejected the key alone for the hour, and still cools without Redis', async () => {
    redis.configured = false;
    vi.stubEnv('LYRA_FREE_POOL', 'groq:openai/gpt-oss-120b');
    const sent = provider({ status: 401 });
    expect(await completeFromPool(REQUEST, NOW)).toMatchObject({ ok: false, reason: 'free_pool_exhausted', tried: [{ reason: 'invalid_key' }] });
    expect(await completeFromPool(REQUEST, NOW + 30 * 60_000)).toMatchObject({ tried: [{ reason: 'cooling' }] });
    expect(sent.length).toBe(1);
    provider({ content: 'back' });
    expect((await completeFromPool(REQUEST, NOW + 61 * 60_000)).ok).toBe(true);
  });

  it('gives each provider one attempt: the chain is the retry', async () => {
    // Before this was pinned a 5xx was retried three times, thirty seconds each, per provider -
    // minutes of waiting before the reader saw the figures instead.
    const sent = provider({ status: 503 }, { content: 'Answered by the second provider.' });
    const outcome = await completeFromPool(REQUEST, NOW);
    expect(outcome.ok && outcome.result.text).toBe('Answered by the second provider.');
    expect(outcome.tried.map((attempt) => attempt.reason)).toEqual(['provider_unavailable', 'ok']);
    expect(sent.length).toBe(2);
  });

  it('starts no new provider once the reader has waited long enough', async () => {
    const sent = provider({ status: 503 });
    // The clock is read once at the start and once before each target.
    const clock = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(40_000);
    const outcome = await completeFromPool(REQUEST, NOW, clock);
    expect(outcome).toMatchObject({ ok: false, reason: 'free_pool_exhausted' });
    expect(outcome.tried.map((attempt) => attempt.reason)).toEqual(['provider_unavailable', 'out_of_time', 'out_of_time', 'out_of_time']);
    expect(sent.length).toBe(1);
  });

  it('treats its deadline as a wall: a provider is given only what is left of it', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(NOW);
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // a provider that never answers
      const settled: Array<Awaited<ReturnType<typeof completeFromPool>>> = [];
      // Five seconds for the whole pool: the first provider may hang for five, not its usual twenty.
      void completeFromPool(REQUEST, NOW, Date.now, 5_000).then((result) => settled.push(result));
      await vi.advanceTimersByTimeAsync(4_900);
      expect(settled.length).toBe(0);
      await vi.advanceTimersByTimeAsync(200);
      expect(settled.length).toBe(1);
      expect(settled[0]).toMatchObject({ ok: false, reason: 'free_pool_exhausted' });
      expect(settled[0]?.tried.map((attempt) => attempt.reason)).toEqual(['provider_unavailable', 'out_of_time', 'out_of_time', 'out_of_time']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('counts time spent waiting in its own queue against a pool call, but not against a reader\'s own', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
      const settled: string[] = [];
      const ask = (lane: 'pool' | 'shared', label: string) =>
        void complete({ provider: 'groq', apiKey: 'k', system: 's', prompt: 'p', maxAttempts: 1, timeoutMs: 1_000, lane }).catch(() => settled.push(label));
      // Fill each lane's slots (4 for the pool, 6 shared) with calls that hang, then queue one more.
      for (let slot = 0; slot < 4; slot += 1) ask('pool', 'pool-running');
      ask('pool', 'pool-queued');
      for (let slot = 0; slot < 6; slot += 1) ask('shared', 'own-running');
      ask('shared', 'own-queued');
      await vi.advanceTimersByTimeAsync(1_050);
      // Every running call timed out; so did the queued POOL call, though it had only just (or
      // never) reached Groq.
      expect(settled.filter((label) => label === 'pool-queued').length).toBe(1);
      // The reader's own queued call is only now starting its own second.
      expect(settled.includes('own-queued')).toBe(false);
      await vi.advanceTimersByTimeAsync(1_050);
      expect(settled.includes('own-queued')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives a slot back when a provider hangs, and never sends a call nobody is waiting for', async () => {
    vi.useFakeTimers();
    try {
      const hung = vi.fn(() => new Promise(() => {}));
      vi.stubGlobal('fetch', hung);
      const ask = (timeoutMs: number) => void complete({ provider: 'groq', apiKey: 'k', system: 's', prompt: 'p', maxAttempts: 1, timeoutMs, lane: 'pool' }).catch(() => {});
      // Four calls hang for 10 s and hold every slot; a fifth is only willing to wait 1 s.
      for (let slot = 0; slot < 4; slot += 1) ask(10_000);
      ask(1_000);
      await vi.advanceTimersByTimeAsync(1_050);
      expect(hung).toHaveBeenCalledTimes(4);
      // The slots come back at 10 s. The fifth call was given up on long before: it is not sent.
      await vi.advanceTimersByTimeAsync(9_500);
      expect(hung).toHaveBeenCalledTimes(4);
      // And the lane is usable again - a new call goes straight out. (Five failures in a row
      // opened the pool's breaker, as they should; this is about the queue, so close it.)
      resetProviderBreakersForTests();
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ choices: [{ message: { content: 'ok' } }] }) })));
      const result = await complete({ provider: 'groq', apiKey: 'k', system: 's', prompt: 'p', maxAttempts: 1, timeoutMs: 1_000, lane: 'pool' });
      expect(result.text).toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps its failures to itself: a free tier that is down does not trip the circuit for a reader's own key", async () => {
    vi.stubEnv('LYRA_FREE_POOL', 'groq:openai/gpt-oss-120b');
    const sent = provider({ status: 500 });
    for (let call = 0; call < 5; call += 1) await completeFromPool(REQUEST, NOW);
    expect(providerBreakerStatus()['pool:groq']).toEqual({ open: true, consecutiveFailures: 5 });
    expect(providerBreakerStatus().groq).toBeUndefined();
    // The pool now fails fast without calling out...
    expect(await completeFromPool(REQUEST, NOW)).toMatchObject({ ok: false, tried: [{ reason: 'provider_unavailable' }] });
    expect(sent.length).toBe(5);
    // ...while a reader's own Groq key still reaches Groq.
    const own = complete({ provider: 'groq', apiKey: 'their-own-key', system: 's', prompt: 'p', maxAttempts: 1 });
    await expect(own).rejects.not.toBeInstanceOf(CircuitOpenError);
    expect(sent.length).toBe(6);
    expect(sent[5].headers.authorization).toBe('Bearer their-own-key');
  });

  it('stays off on a host with many instances and no shared store to count in', () => {
    redis.configured = false;
    expect(freePoolAvailable()).toBe(true); // one long-lived process counts correctly in memory
    vi.stubEnv('VERCEL', '1');
    expect(freePoolAvailable()).toBe(false); // each instance would keep its own "daily ceiling"
    redis.configured = true;
    expect(freePoolAvailable()).toBe(true);
  });

  it('never puts the caller in charge of who answers: nothing in the request names a provider, a model or a key', async () => {
    const sent = provider({ content: 'ok' });
    await completeFromPool({ ...REQUEST, system: 'model: evil/model apiKey: stolen', prompt: 'provider: openai' } as typeof REQUEST, NOW);
    expect(sent[0].url).toContain('api.cloudflare.com');
    expect(sent[0].body.model).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect(sent[0].headers.authorization).toBe('Bearer cf-free-token');
  });
});

describe('the free caps', () => {
  beforeEach(() => {
    redis.store.clear();
    redis.configured = true;
    resetRateLimits();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('caps one caller per minute without touching anyone else', async () => {
    vi.stubEnv('LYRA_FREE_PER_MINUTE', '2');
    expect(await chargeFreeCaps('ip:1.1.1.1', NOW)).toEqual({ ok: true });
    expect(await chargeFreeCaps('ip:1.1.1.1', NOW)).toEqual({ ok: true });
    const third = await chargeFreeCaps('ip:1.1.1.1', NOW);
    expect(third).toMatchObject({ ok: false, reason: 'free_limit' });
    expect(await chargeFreeCaps('ip:2.2.2.2', NOW)).toEqual({ ok: true });
    // The next minute is a new window.
    expect(await chargeFreeCaps('ip:1.1.1.1', NOW + 61_000)).toEqual({ ok: true });
  });

  it('caps one caller per day, resetting at 00:00 UTC', async () => {
    vi.stubEnv('LYRA_FREE_PER_MINUTE', '100');
    vi.stubEnv('LYRA_FREE_PER_DAY', '2');
    await chargeFreeCaps('user-1', NOW);
    await chargeFreeCaps('user-1', NOW + 3_600_000);
    expect(await chargeFreeCaps('user-1', NOW + 7_200_000)).toMatchObject({ ok: false, reason: 'free_limit' });
    expect(await chargeFreeCaps('user-1', Date.parse('2026-11-07T00:00:01Z'))).toEqual({ ok: true });
  });

  it('stops the pool as a whole at its daily ceiling', async () => {
    vi.stubEnv('LYRA_FREE_GLOBAL_PER_DAY', '2');
    expect(await chargeFreeCaps('ip:1.1.1.1', NOW)).toEqual({ ok: true });
    expect(await chargeFreeCaps('ip:2.2.2.2', NOW)).toEqual({ ok: true });
    expect(await chargeFreeCaps('ip:3.3.3.3', NOW)).toMatchObject({ ok: false, reason: 'free_pool_exhausted' });
  });

  it('still caps when Redis is not there, from this instance alone', async () => {
    redis.configured = false;
    vi.stubEnv('LYRA_FREE_PER_MINUTE', '1');
    expect(await chargeFreeCaps('ip:9.9.9.9', NOW)).toEqual({ ok: true });
    expect(await chargeFreeCaps('ip:9.9.9.9', NOW)).toMatchObject({ ok: false, reason: 'free_limit' });
  });
});
