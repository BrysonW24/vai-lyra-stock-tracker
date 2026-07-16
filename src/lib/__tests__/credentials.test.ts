import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveAiCredentials } from '@/lib/ai/credentials';

/**
 * Guards the core financial-DoS fix: the hosted/shared SERVER key must never be reachable by an
 * unauthenticated caller, and when it is used the model is server-pinned (a client cannot select an
 * arbitrary expensive model on our key). A user's own BYOK key is always honoured.
 */
describe('resolveAiCredentials auth gating', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('honours a browser BYOK key regardless of auth, keeping the user-chosen model', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-hosted');
    const creds = resolveAiCredentials(
      { provider: 'openai', apiKey: 'sk-user-own', model: 'gpt-5.5' },
      { authenticated: false },
    );
    expect(creds.source).toBe('user');
    expect(creds.apiKey).toBe('sk-user-own');
    expect(creds.model).toBe('gpt-5.5');
  });

  it('NEVER hands an anonymous caller the hosted server key', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-hosted');
    vi.stubEnv('GOOGLE_AI_KEY', 'g-shared');
    const openai = resolveAiCredentials({ provider: 'openai' }, { authenticated: false });
    expect(openai.source).toBe('none');
    expect(openai.apiKey).toBe('');
    const google = resolveAiCredentials({ provider: 'google' }, { authenticated: false });
    expect(google.source).toBe('none');
    expect(google.apiKey).toBe('');
  });

  it('gives an authenticated caller the hosted key but PINS the model (ignores client model)', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-hosted');
    vi.stubEnv('LYRA_HOSTED_OPENAI_MODEL', 'gpt-5-mini');
    const creds = resolveAiCredentials(
      { provider: 'openai', model: 'gpt-5.5-the-expensive-one' },
      { authenticated: true },
    );
    expect(creds.source).toBe('hosted_openai');
    expect(creds.apiKey).toBe('sk-hosted');
    expect(creds.model).toBe('gpt-5-mini'); // client's model choice was ignored on our key
  });

  it('gives an authenticated caller the shared Google key, model server-pinned', () => {
    vi.stubEnv('GOOGLE_AI_KEY', 'g-shared');
    const creds = resolveAiCredentials(
      { provider: 'google', model: 'gemini-ultra' },
      { authenticated: true },
    );
    expect(creds.source).toBe('shared_google');
    expect(creds.apiKey).toBe('g-shared');
    expect(creds.model).toBeUndefined(); // no LYRA_SHARED_GOOGLE_MODEL set -> gateway default
  });

  it('resolves to none when authenticated but no server key is configured', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const creds = resolveAiCredentials({ provider: 'openai' }, { authenticated: true });
    expect(creds.source).toBe('none');
    expect(creds.apiKey).toBe('');
  });
});
