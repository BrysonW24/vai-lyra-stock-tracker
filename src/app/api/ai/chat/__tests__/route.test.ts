/**
 * /api/ai/chat, end to end with the model stubbed out.
 *
 * Pins what the free pool changed about chat: who gets the engine's figures instead of an error
 * (and who does not), that a no-account reader's book reaches the model only when they sent it,
 * and that an authored sample row never reaches the model or the figures-only answer as if it
 * were today's.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { DashboardData, SignalRow } from '@/types/scanner';

const mocks = vi.hoisted(() => ({
  body: {} as Record<string, unknown>,
  data: null as unknown,
  answerWith: vi.fn(),
  recordAiRun: vi.fn(),
}));

vi.mock('@/lib/api/ai-guard', () => ({
  guardAiRoute: async () => ({ ok: true, body: mocks.body, authenticated: false, aiIncluded: false, identity: 'ip:203.0.113.7' }),
}));
vi.mock('@/lib/ai/free-pool', () => ({
  freePoolAvailable: () => true,
  poolTargets: () => [{ provider: 'groq', model: 'openai/gpt-oss-120b' }],
}));
vi.mock('@/lib/ai/answer', () => ({ answerWith: mocks.answerWith }));
vi.mock('@/lib/data', () => ({ getDashboardData: async () => mocks.data }));
vi.mock('@/lib/market-context-live', async () => {
  const { demoMarketContext } = await import('@/lib/market-context');
  return { getMarketContextLive: async () => ({ ...demoMarketContext, source: 'sample' }) };
});
vi.mock('@/lib/ai/user-context', () => ({ getUserConstraints: async () => null, buildConstraintsBlock: () => '' }));
vi.mock('@/lib/ai/audit', () => ({ recordAiRun: mocks.recordAiRun, hashInput: () => 'hash' }));
vi.mock('@/lib/twin/chat-memory', () => ({ loadRecentChatTurns: async () => [], appendChatTurns: async () => {} }));
vi.mock('@/lib/market/quote', () => ({ lookupMarketQuote: async () => null }));

import { demoDashboardData } from '@/lib/demo-data';
import { FIGURES_ONLY_LEADS } from '@/lib/ai/figures-answer';
import { POST } from '../route';

const AI = { mode: 'hosted', provider: 'openai', apiKey: '' };
const live = demoDashboardData.signals[0] as SignalRow;
const other = demoDashboardData.signals[1] as SignalRow;

interface Reply {
  ok: boolean;
  text?: string;
  reason?: string;
  figuresOnly?: boolean;
  answeredBy?: string;
}

const ask = async (question: string, extra: Record<string, unknown> = {}): Promise<Reply> => {
  mocks.body = { messages: [{ role: 'user', content: question }], ai: AI, ...extra };
  return (await (await POST({} as NextRequest)).json()) as Reply;
};

/** The system prompt the model would have been shown on the last call. */
const shown = (): string => (mocks.answerWith.mock.calls.at(-1)?.[2] as { system: string }).system;

const failed = (reason: string, via: string) => ({ ok: false, reason, provider: 'groq', model: 'n/a', via });

describe('POST /api/ai/chat with the free pool', () => {
  beforeEach(() => {
    mocks.data = { ...demoDashboardData, mode: 'solo', portfolio: [], watchlist: [] } as DashboardData;
    mocks.answerWith.mockReset();
    mocks.recordAiRun.mockReset();
    mocks.answerWith.mockResolvedValue({ ok: true, text: 'The scan is mixed today.', provider: 'groq', model: 'openai/gpt-oss-120b', usage: null, costUsd: 0, via: 'free_pool' });
  });

  it('answers an anonymous reader from the pool and says who answered', async () => {
    const reply = await ask('What does the scan look like?');
    expect(reply).toMatchObject({ ok: true, text: 'The scan is mixed today.', answeredBy: 'free_pool' });
    expect(mocks.answerWith.mock.calls[0][0]).toMatchObject({ source: 'free_pool', apiKey: '' });
  });

  it("gives the engine's figures, not an error, when the pool is used up", async () => {
    mocks.answerWith.mockResolvedValue(failed('free_pool_exhausted', 'free_pool'));
    const reply = await ask(`How is ${live.symbol} looking?`);
    expect(reply.ok).toBe(true);
    expect(reply.figuresOnly).toBe(true);
    const lines = (reply.text ?? '').split('\n');
    expect(lines[0]).toBe(FIGURES_ONLY_LEADS.used_up);
    expect(lines[1]).toContain(`- ${live.symbol}: score ${Math.round(live.score)}`);
    // The market backdrop here is the bundled sample: it is never printed as today's.
    expect(reply.text).not.toContain('Risk-');
  });

  it('says the model could not answer - not that the allowance is used up - when a provider stumbled', async () => {
    mocks.answerWith.mockResolvedValue(failed('provider_unavailable', 'free_pool'));
    const reply = await ask(`How is ${live.symbol} looking?`);
    expect(reply.figuresOnly).toBe(true);
    expect((reply.text ?? '').split('\n')[0]).toBe(FIGURES_ONLY_LEADS.unavailable);
  });

  it('gives figures when a house key handed over to the pool and the pool was out too', async () => {
    // The request started on a hosted key; `via` says the pool is where it ended.
    mocks.answerWith.mockResolvedValue(failed('free_pool_exhausted', 'free_pool'));
    expect((await ask('What happened today?')).figuresOnly).toBe(true);
  });

  it("does not hand out figures to someone over their own share, or in place of a reader's own failing key", async () => {
    mocks.answerWith.mockResolvedValue(failed('free_limit', 'free_pool'));
    expect(await ask('What happened today?')).toEqual({ ok: false, reason: 'free_limit' });
    mocks.answerWith.mockResolvedValue(failed('invalid_key', 'user'));
    expect(await ask('What happened today?', { ai: { ...AI, apiKey: 'sk-theirs' } })).toEqual({ ok: false, reason: 'invalid_key' });
  });

  it("shows the model a no-account reader's book only when they sent it", async () => {
    const book = { holdings: [{ symbol: live.symbol, quantity: 12.5, averageBuyPrice: 101.25 }], watchlist: [], capital: { cashAvailable: 4321, baseCurrency: 'USD' } };

    await ask('How is my book?', { soloContext: { ...book, withheld: true } });
    expect(shown()).toContain('has NOT shared them with you');
    expect(shown()).not.toContain('12.5 shares');
    expect(shown()).not.toContain('4,321');

    await ask('How is my book?', { soloContext: book });
    expect(shown()).toContain('12.5 shares');
    expect(shown()).toContain('4,321');
    expect(shown()).not.toContain('has NOT shared');
  });

  it('never shows the model, or prints, a sample row kept because its live recompute failed', async () => {
    const sample = { ...other, symbol: 'ZZZQ', score: 99, sample: true } as SignalRow;
    mocks.data = { ...demoDashboardData, mode: 'solo', portfolio: [], watchlist: [], signals: [live, sample] } as DashboardData;

    await ask('What are the top signals?');
    expect(shown()).toContain(live.symbol);
    expect(shown()).not.toContain('ZZZQ');

    mocks.answerWith.mockResolvedValue(failed('free_pool_exhausted', 'free_pool'));
    const reply = await ask('What are the top signals?');
    expect(reply.text).not.toContain('ZZZQ');
    expect(reply.text).toContain('- On the scan now: 1 name');
  });

  it('refuses to narrate the authored sample book when the live read failed on a configured deployment', async () => {
    mocks.data = { ...demoDashboardData, mode: 'demo' } as DashboardData;
    expect(await ask('How is my book?')).toEqual({ ok: false, reason: 'provider_unavailable' });
    expect(mocks.answerWith).not.toHaveBeenCalled();
  });
});
