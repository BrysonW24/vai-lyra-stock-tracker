/**
 * /api/ai/explain-signal - the AI phrasing of one signal.
 *
 * The signal drawer asks this route by itself every time it opens. Before this was pinned, those automatic calls
 * could reach the FREE POOL - a daily allowance shared by everyone - so page views alone would
 * have spent it: about a thousand of them, and nobody could chat for the rest of the day. The pool
 * answers a tap (`asked: true`) and nothing else.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  body: {} as Record<string, unknown>,
  authenticated: false,
  aiIncluded: false,
  poolOn: true,
  answerWith: vi.fn(),
}));

vi.mock('@/lib/api/ai-guard', () => ({
  guardAiRoute: async () => ({ ok: true, body: mocks.body, authenticated: mocks.authenticated, aiIncluded: mocks.aiIncluded, identity: 'ip:203.0.113.7' }),
}));
vi.mock('@/lib/ai/free-pool', () => ({
  freePoolAvailable: () => mocks.poolOn,
  poolTargets: () => (mocks.poolOn ? [{ provider: 'groq', model: 'openai/gpt-oss-120b' }] : []),
}));
vi.mock('@/lib/ai/answer', () => ({ answerWith: mocks.answerWith }));
vi.mock('@/lib/live-signals', () => ({ buildLiveSignal: async () => ({ score: 82, status: 'strong_setup', rsi: 41.2 }) }));

import { POST } from '../route';

const AI = { mode: 'hosted', provider: 'openai', apiKey: '' };
const call = async (body: Record<string, unknown>) => {
  mocks.body = body;
  return (await (await POST({} as NextRequest)).json()) as { ok: boolean; reason?: string; text?: string };
};

describe('POST /api/ai/explain-signal and the free pool', () => {
  beforeEach(() => {
    mocks.authenticated = false;
    mocks.aiIncluded = false;
    mocks.poolOn = true;
    mocks.answerWith.mockReset();
    mocks.answerWith.mockResolvedValue({ ok: true, text: 'NVDA scores 82 with an RSI of 41.2.', provider: 'groq', model: 'openai/gpt-oss-120b', usage: null, costUsd: 0, via: 'free_pool' });
    vi.unstubAllEnvs();
  });

  it('does not spend the free pool on an automatic call: it says the answer is there on request', async () => {
    expect(await call({ symbol: 'NVDA', ai: AI })).toEqual({ ok: false, reason: 'on_request' });
    expect(mocks.answerWith).not.toHaveBeenCalled();
  });

  it('answers from the free pool when a person tapped', async () => {
    const reply = await call({ symbol: 'NVDA', ai: AI, asked: true });
    expect(reply.ok).toBe(true);
    expect(mocks.answerWith).toHaveBeenCalledTimes(1);
    expect(mocks.answerWith.mock.calls[0][0]).toMatchObject({ source: 'free_pool', apiKey: '' });
    expect(mocks.answerWith.mock.calls[0][1]).toBe('ip:203.0.113.7');
  });

  it('takes only a real true as a tap', async () => {
    for (const asked of ['true', 1, {}, null]) {
      expect(await call({ symbol: 'NVDA', ai: AI, asked })).toEqual({ ok: false, reason: 'on_request' });
    }
    expect(mocks.answerWith).not.toHaveBeenCalled();
  });

  it('says there is no key, not "on request", when the pool is off', async () => {
    mocks.poolOn = false;
    expect(await call({ symbol: 'NVDA', ai: AI })).toEqual({ ok: false, reason: 'no_key' });
    expect(await call({ symbol: 'NVDA', ai: AI, asked: true })).toEqual({ ok: false, reason: 'no_key' });
  });

  it("still answers an automatic call with the reader's own key, or a hosted entitlement", async () => {
    await call({ symbol: 'NVDA', ai: { ...AI, apiKey: 'sk-their-own' } });
    expect(mocks.answerWith.mock.calls[0][0]).toMatchObject({ source: 'user', apiKey: 'sk-their-own' });

    vi.stubEnv('OPENAI_API_KEY', 'sk-hosted');
    mocks.authenticated = true;
    mocks.aiIncluded = true;
    await call({ symbol: 'NVDA', ai: AI });
    // An automatic call on the house key has nothing behind it: if the house cannot answer, the
    // pool is not spent in its place.
    expect(mocks.answerWith.mock.calls[1][0]).toMatchObject({ source: 'hosted_openai', poolFallback: false });
  });
});
