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

/**
 * Everything in `ai` arrives from a request body. Before 2026-10 the provider and model strings
 * were trusted as typed: an anonymous caller could send any non-empty "key" plus ~31 KB of text as
 * the model name, trip the injection screen, and have the server store that text in the audit
 * table through the service role - 30 times a minute per address.
 */
describe('resolveAiCredentials treats the request body as untrusted', () => {
  afterEach(() => vi.unstubAllEnvs());
  const anonymous = { authenticated: false, aiIncluded: false };

  it('drops a model string that is not shaped like a model id', () => {
    const huge = 'x'.repeat(31_000);
    for (const model of [huge, 'gpt 5 <script>', '../../etc/passwd\n', '', '   ']) {
      const creds = resolveAiCredentials({ provider: 'openai', apiKey: 'sk-user', model }, anonymous);
      expect(creds.model).toBeUndefined();
    }
  });

  it('keeps every real model-id shape the providers use', () => {
    for (const model of ['gpt-5.5', 'claude-fable-5-1', 'anthropic/claude-3.5-sonnet:beta', 'models/gemini-2.5-pro', 'ft:gpt-4o-mini-2024-07-18:org::abc123', 'x-ai/grok-4']) {
      expect(resolveAiCredentials({ provider: 'openrouter', apiKey: 'sk-user', model }, anonymous).model).toBe(model);
    }
  });

  it('never lets a client-chosen string become the provider', () => {
    const forged = { provider: 'x'.repeat(5_000), apiKey: 'sk-user' } as unknown as Parameters<typeof resolveAiCredentials>[0];
    expect(resolveAiCredentials(forged, anonymous).provider).toBe('openai');
    expect(resolveAiCredentials(forged, anonymous, 'anthropic').provider).toBe('anthropic');
  });

  it('survives non-string fields instead of throwing', () => {
    const junk = { provider: 42, apiKey: { nested: true }, model: ['a'] } as unknown as Parameters<typeof resolveAiCredentials>[0];
    expect(resolveAiCredentials(junk, anonymous)).toEqual({ provider: 'openai', apiKey: '', model: undefined, source: 'none' });
  });

  it('does not treat an absurdly long string as a key', () => {
    expect(resolveAiCredentials({ provider: 'openai', apiKey: 'k'.repeat(5_000) }, anonymous).source).toBe('none');
  });
});
