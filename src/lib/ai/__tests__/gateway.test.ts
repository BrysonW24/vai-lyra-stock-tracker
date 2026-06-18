import { describe, it, expect } from 'vitest';
import { resolveModel, DEFAULT_MODELS, SUPPORTED_PROVIDERS, type AiProvider } from '../gateway';

describe('ai gateway · resolveModel', () => {
  it('falls back to the provider default when no model is given', () => {
    expect(resolveModel('anthropic')).toBe(DEFAULT_MODELS.anthropic);
    expect(resolveModel('openai')).toBe('gpt-5.5');
    expect(resolveModel('openrouter')).toBe(DEFAULT_MODELS.openrouter);
    expect(resolveModel('google')).toBe(DEFAULT_MODELS.google);
  });

  it('falls back to the default for blank / whitespace-only models', () => {
    expect(resolveModel('anthropic', '')).toBe(DEFAULT_MODELS.anthropic);
    expect(resolveModel('anthropic', '   ')).toBe(DEFAULT_MODELS.anthropic);
    expect(resolveModel('anthropic', undefined)).toBe(DEFAULT_MODELS.anthropic);
  });

  it('honours a user-supplied model (bring your own model) and trims it', () => {
    expect(resolveModel('openrouter', 'meta-llama/llama-3.1-70b-instruct')).toBe(
      'meta-llama/llama-3.1-70b-instruct',
    );
    expect(resolveModel('openai', '  gpt-4o  ')).toBe('gpt-4o');
  });

  it('has a default model for every supported provider', () => {
    SUPPORTED_PROVIDERS.forEach((provider: AiProvider) => {
      expect(DEFAULT_MODELS[provider]).toBeTruthy();
    });
  });

  it('defaults Anthropic to the current Haiku 4.5 id, not the retired 3.5 family', () => {
    // Regression guard: 'claude-3-5-haiku-latest' resolved to the RETIRED claude-3.5-haiku
    // family and hard-failed every BYO-Anthropic request.
    expect(DEFAULT_MODELS.anthropic).toBe('claude-haiku-4-5');
    expect(DEFAULT_MODELS.anthropic).not.toContain('3-5-haiku');
  });
});
