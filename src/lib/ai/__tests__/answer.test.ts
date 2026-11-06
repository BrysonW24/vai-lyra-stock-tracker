/**
 * answerWith - one way to get a completion, with the right fence for whoever is paying:
 * nothing for the caller's own key, the house budget for a hosted key, the per-caller caps for
 * the free pool. Pins that each fence is charged BEFORE the model is called, that a failure comes
 * back as a reason, never an exception, and that a house key which cannot answer hands over to the
 * free pool - while a reader's own key never does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  budget: vi.fn(),
  caps: vi.fn(),
  pool: vi.fn(),
}));

vi.mock('@/lib/ai/gateway', async (original) => ({ ...(await original<typeof import('@/lib/ai/gateway')>()), complete: mocks.complete }));
vi.mock('@/lib/ai/budget-tracker', () => ({ chargeHostedBudgetShared: mocks.budget }));
vi.mock('@/lib/ai/free-pool', () => ({ chargeFreeCaps: mocks.caps, completeFromPool: mocks.pool, freePoolAvailable: () => true, poolTargets: () => [] }));

import { answerWith } from '../answer';
import type { ResolvedAiCredentials } from '../credentials';

const REQUEST = { system: 's', prompt: 'p', maxTokens: 600, budgetTokens: 600 };
const DONE = { text: 'An answer.', provider: 'openai', model: 'gpt-5.5', usage: { inputTokens: 900, outputTokens: 80 }, costUsd: 0.002 };
const creds = (source: ResolvedAiCredentials['source'], extra: Partial<ResolvedAiCredentials> = {}): ResolvedAiCredentials => ({
  provider: 'openai',
  apiKey: source === 'none' || source === 'free_pool' ? '' : 'key',
  model: undefined,
  source,
  ...extra,
});

describe('answerWith', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.complete.mockResolvedValue(DONE);
    mocks.budget.mockResolvedValue({ decision: 'allow' });
    mocks.caps.mockResolvedValue({ ok: true });
    mocks.pool.mockResolvedValue({ ok: true, result: { ...DONE, provider: 'groq', model: 'openai/gpt-oss-120b', costUsd: 0 }, tried: [] });
  });
  afterEach(() => vi.clearAllMocks());

  it('has nothing to answer with when there is no key and no pool', async () => {
    expect(await answerWith(creds('none'), 'ip:1', REQUEST)).toMatchObject({ ok: false, reason: 'no_key' });
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.pool).not.toHaveBeenCalled();
  });

  it("uses the caller's own key with no budget and no caps, and retries their rate limit", async () => {
    const answer = await answerWith(creds('user', { provider: 'anthropic', model: 'claude-x' }), 'ip:1', REQUEST);
    expect(answer).toMatchObject({ ok: true, text: 'An answer.' });
    expect(mocks.budget).not.toHaveBeenCalled();
    expect(mocks.caps).not.toHaveBeenCalled();
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ provider: 'anthropic', apiKey: 'key', model: 'claude-x', retryOn429: true, maxTokens: 600 }));
  });

  it('charges the house budget before a hosted key is used, and never retries a hosted rate limit', async () => {
    await answerWith(creds('hosted_openai'), 'user-1', REQUEST);
    expect(mocks.budget).toHaveBeenCalledWith('hosted_openai', 600);
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ retryOn429: false }));

    mocks.budget.mockResolvedValue({ decision: 'block', window: 'day', reason: 'day ceiling exceeded' });
    mocks.complete.mockClear();
    expect(await answerWith(creds('hosted_openai'), 'user-1', REQUEST)).toMatchObject({ ok: false, reason: 'budget' });
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('charges the free caps before the pool is asked, and reports who actually answered', async () => {
    const answer = await answerWith(creds('free_pool', { provider: 'cloudflare' }), 'ip:1.2.3.4', REQUEST);
    expect(mocks.caps).toHaveBeenCalledWith('ip:1.2.3.4');
    expect(mocks.pool).toHaveBeenCalledWith({ system: 's', prompt: 'p', maxTokens: 600 });
    expect(answer).toMatchObject({ ok: true, provider: 'groq', model: 'openai/gpt-oss-120b', costUsd: 0 });
    expect(mocks.budget).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();

    mocks.caps.mockResolvedValue({ ok: false, reason: 'free_limit', retryAfterSec: 30 });
    mocks.pool.mockClear();
    expect(await answerWith(creds('free_pool'), 'ip:1.2.3.4', REQUEST)).toMatchObject({ ok: false, reason: 'free_limit' });
    expect(mocks.pool).not.toHaveBeenCalled();
  });

  it('says which fence answered', async () => {
    expect(await answerWith(creds('user'), 'ip:1', REQUEST)).toMatchObject({ ok: true, via: 'user' });
    expect(await answerWith(creds('hosted_openai'), 'user-1', REQUEST)).toMatchObject({ ok: true, via: 'hosted' });
    expect(await answerWith(creds('free_pool'), 'ip:1', REQUEST)).toMatchObject({ ok: true, via: 'free_pool' });
    expect(await answerWith(creds('none'), 'ip:1', REQUEST)).toMatchObject({ ok: false, via: 'none' });
  });

  it('hands over to the free pool when the house key cannot answer and the route allows it', async () => {
    const hosted = creds('hosted_openai', { poolFallback: true });

    // The house budget is spent: the model is never called on the house key, the pool answers.
    mocks.budget.mockResolvedValue({ decision: 'block', window: 'day', reason: 'day ceiling exceeded' });
    expect(await answerWith(hosted, 'user-1', REQUEST)).toMatchObject({ ok: true, via: 'free_pool', provider: 'groq', costUsd: 0 });
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.caps).toHaveBeenCalledWith('user-1');

    // The provider refuses the house key (its credit ran out, it is rate limited, it is down).
    mocks.budget.mockResolvedValue({ decision: 'allow' });
    for (const failure of ['openai 429: rate limited - wait and retry', 'openai 401: authentication failed - check the API key', 'openai 503']) {
      mocks.complete.mockRejectedValue(new Error(failure));
      expect(await answerWith(hosted, 'user-1', REQUEST)).toMatchObject({ ok: true, via: 'free_pool' });
    }

    // And when the pool cannot answer either, the reason is the pool's - so chat gives the figures.
    mocks.pool.mockResolvedValue({ ok: false, reason: 'free_pool_exhausted', tried: [] });
    expect(await answerWith(hosted, 'user-1', REQUEST)).toMatchObject({ ok: false, reason: 'free_pool_exhausted', via: 'free_pool' });
  });

  it('does not hand over without the route saying so, and never for a reader\'s own key', async () => {
    mocks.complete.mockRejectedValue(new Error('openai 429: rate limited - wait and retry'));
    expect(await answerWith(creds('hosted_openai'), 'user-1', REQUEST)).toMatchObject({ ok: false, reason: 'provider_rate_limited', via: 'hosted' });
    expect(await answerWith(creds('user', { poolFallback: true }), 'ip:1', REQUEST)).toMatchObject({ ok: false, reason: 'provider_rate_limited', via: 'user' });
    expect(mocks.pool).not.toHaveBeenCalled();
    expect(mocks.caps).not.toHaveBeenCalled();
  });

  it('passes on the pool being out, a provider failing, and an empty answer as reasons', async () => {
    mocks.pool.mockResolvedValue({ ok: false, reason: 'free_pool_exhausted', tried: [] });
    expect(await answerWith(creds('free_pool'), 'ip:1', REQUEST)).toMatchObject({ ok: false, reason: 'free_pool_exhausted' });

    mocks.complete.mockRejectedValue(new Error('openai 429: rate limited - wait and retry'));
    expect(await answerWith(creds('user'), 'ip:1', REQUEST)).toMatchObject({ ok: false, reason: 'provider_rate_limited' });
    mocks.complete.mockRejectedValue(new Error('openai 401: authentication failed - check the API key'));
    expect(await answerWith(creds('user'), 'ip:1', REQUEST)).toMatchObject({ ok: false, reason: 'invalid_key' });
    mocks.complete.mockResolvedValue({ ...DONE, text: '' });
    expect(await answerWith(creds('user'), 'ip:1', REQUEST)).toMatchObject({ ok: false, reason: 'empty_response' });
  });
});
