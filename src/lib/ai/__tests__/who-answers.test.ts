/**
 * whoAnswers - the browser's account of who will answer a reader with no key of their own.
 *
 * The chat sheet shows the free-model disclosure, and a no-account reader's "Include my book"
 * choice, only when this says 'free'. If it ever said 'hosted' while the server sent the question
 * to the free pool, a reader's book would go to Cloudflare or Groq with no notice. So it is pinned
 * to the resolver that actually decides, across every combination of session, entitlement,
 * selected provider, house keys and pool.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAiCredentials, getAiRuntimeStatus } from '../credentials';
import { whoAnswers, type AiStatusFacts } from '../who-answers';

const PROVIDERS = ['openai', 'google', 'anthropic', 'openrouter', 'xai'] as const;
const BOOL = [false, true];

/** What GET /api/ai/status would report for this caller (see src/app/api/ai/status/route.ts). */
function statusFor(authenticated: boolean, aiIncluded: boolean): AiStatusFacts {
  const status = getAiRuntimeStatus();
  const freeAvailable = status.freePool === true;
  if (!authenticated) return { freeAvailable, authenticated: false };
  return { ...status, freeAvailable, aiIncluded, authenticated: true };
}

describe('whoAnswers', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('agrees with the server resolver in every case', () => {
    let cases = 0;
    for (const openaiKey of BOOL) for (const googleKey of BOOL) for (const pool of BOOL) {
      vi.stubEnv('OPENAI_API_KEY', openaiKey ? 'sk-hosted' : '');
      vi.stubEnv('GOOGLE_AI_KEY', googleKey ? 'g-shared' : '');
      vi.stubEnv('GROQ_API_KEY', pool ? 'groq-free' : '');
      vi.stubEnv('CLOUDFLARE_AI_TOKEN', '');
      vi.stubEnv('OPENROUTER_API_KEY', '');
      for (const authenticated of BOOL) for (const aiIncluded of BOOL) for (const provider of PROVIDERS) {
        const source = resolveAiCredentials({ provider }, { authenticated, aiIncluded: authenticated && aiIncluded, allowFreePool: true }).source;
        const expected = source === 'free_pool' ? 'free' : source === 'none' ? 'none' : 'hosted';
        const told = whoAnswers(statusFor(authenticated, authenticated && aiIncluded), provider);
        expect(told, JSON.stringify({ openaiKey, googleKey, pool, authenticated, aiIncluded, provider })).toBe(expected);
        cases += 1;
      }
    }
    expect(cases).toBe(160);
  });

  it('says free - not hosted - when the house holds a key for the OTHER provider', () => {
    // The case a per-deployment "hosted is available" flag gets wrong: only a Google key exists,
    // the reader is entitled and on the default OpenAI. The server sends them to the free pool.
    const status: AiStatusFacts = { authenticated: true, aiIncluded: true, hostedOpenAi: false, sharedGoogle: true, freeAvailable: true };
    expect(whoAnswers(status, 'openai')).toBe('free');
    expect(whoAnswers(status, 'google')).toBe('hosted');
  });

  it('never tells a signed-out reader the house answers them', () => {
    expect(whoAnswers({ authenticated: false, freeAvailable: true, hostedOpenAi: true, aiIncluded: true }, 'openai')).toBe('free');
    expect(whoAnswers({ freeAvailable: false }, 'openai')).toBe('none');
    expect(whoAnswers(null, 'openai')).toBe('none');
  });
});
