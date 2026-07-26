import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveAiCredentials } from '@/lib/ai/credentials';

/**
 * Guards the core financial-DoS fix AND the per-user entitlement: the hosted/shared SERVER key must
 * never be reachable by an unauthenticated caller, and now also never by an authenticated caller who
 * is not AI-included (past their free trial and not granted). A user's own BYOK key is always
 * honoured, and when a server key IS used the model is server-pinned.
 */
describe('resolveAiCredentials auth + entitlement gating', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('honours a browser BYOK key regardless of auth or entitlement, keeping the user-chosen model', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-hosted');
    const creds = resolveAiCredentials(
      { provider: 'openai', apiKey: 'sk-user-own', model: 'gpt-5.5' },
      { authenticated: false, aiIncluded: false },
    );
    expect(creds.source).toBe('user');
    expect(creds.apiKey).toBe('sk-user-own');
    expect(creds.model).toBe('gpt-5.5');
  });

  it('NEVER hands an anonymous caller the hosted server key (even if flagged included)', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-hosted');
    vi.stubEnv('GOOGLE_AI_KEY', 'g-shared');
    expect(resolveAiCredentials({ provider: 'openai' }, { authenticated: false, aiIncluded: true }).source).toBe('none');
    expect(resolveAiCredentials({ provider: 'google' }, { authenticated: false, aiIncluded: true }).source).toBe('none');
  });

  it('NEVER hands the hosted key to a signed-in user who is not AI-included (trial lapsed)', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-hosted');
    vi.stubEnv('GOOGLE_AI_KEY', 'g-shared');
    const openai = resolveAiCredentials({ provider: 'openai' }, { authenticated: true, aiIncluded: false });
    expect(openai.source).toBe('none');
    expect(openai.apiKey).toBe('');
    expect(resolveAiCredentials({ provider: 'google' }, { authenticated: true, aiIncluded: false }).source).toBe('none');
  });

  it('gives an authenticated + included caller the hosted key but PINS the model', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-hosted');
    vi.stubEnv('LYRA_HOSTED_OPENAI_MODEL', 'gpt-5-mini');
    const creds = resolveAiCredentials(
      { provider: 'openai', model: 'gpt-5.5-the-expensive-one' },
      { authenticated: true, aiIncluded: true },
    );
    expect(creds.source).toBe('hosted_openai');
    expect(creds.apiKey).toBe('sk-hosted');
    expect(creds.model).toBe('gpt-5-mini'); // client's model choice was ignored on our key
  });

  it('gives an authenticated + included caller the shared Google key, model server-pinned', () => {
    vi.stubEnv('GOOGLE_AI_KEY', 'g-shared');
    const creds = resolveAiCredentials(
      { provider: 'google', model: 'gemini-ultra' },
      { authenticated: true, aiIncluded: true },
    );
    expect(creds.source).toBe('shared_google');
    expect(creds.apiKey).toBe('g-shared');
    expect(creds.model).toBeUndefined(); // no LYRA_SHARED_GOOGLE_MODEL set -> gateway default
  });

  it('resolves to none when authenticated + included but no server key is configured', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const creds = resolveAiCredentials({ provider: 'openai' }, { authenticated: true, aiIncluded: true });
    expect(creds.source).toBe('none');
    expect(creds.apiKey).toBe('');
  });
});
