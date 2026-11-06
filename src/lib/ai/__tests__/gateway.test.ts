import { describe, it, expect } from 'vitest';
import { resolveModel, reasoningExtras, stripThinking, DEFAULT_MODELS, SUPPORTED_PROVIDERS, ProviderHttpError, type AiProvider } from '../gateway';
import { estimateCostUsd, extractUsage } from '../cost';

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

describe('ai gateway · the free pool providers', () => {
  it('keeps Groq and Cloudflare out of the list a user may choose from', () => {
    // SUPPORTED_PROVIDERS is what a client-supplied provider string is checked against: the pool's
    // providers are reached only with Lyra's own keys, never by a string from a request.
    expect(SUPPORTED_PROVIDERS).toEqual(['anthropic', 'openai', 'openrouter', 'google', 'xai']);
    expect(DEFAULT_MODELS.groq).toBe('openai/gpt-oss-120b');
    expect(DEFAULT_MODELS.cloudflare).toBe('@cf/google/gemma-4-26b-a4b-it');
  });

  it("asks a reasoning model for low effort and keeps its thinking out of the reader's sight", () => {
    expect(reasoningExtras('groq', 'openai/gpt-oss-120b')).toEqual({ reasoning_effort: 'low', include_reasoning: false });
    expect(reasoningExtras('groq', 'qwen/qwen3.8-27b')).toEqual({ reasoning_effort: 'low', reasoning_format: 'hidden' });
    expect(reasoningExtras('cloudflare', '@cf/openai/gpt-oss-120b')).toEqual({ reasoning_effort: 'low' });
    expect(reasoningExtras('cloudflare', '@cf/google/gemma-4-26b-a4b-it')).toBeUndefined();
    expect(reasoningExtras('openrouter', 'meta-llama/llama-3.1-70b-instruct')).toBeUndefined();
  });

  it('strips reasoning a model printed inline', () => {
    expect(stripThinking('<think>the user wants\na read</think>\n\nBreadth was narrow.')).toBe('Breadth was narrow.');
    expect(stripThinking('reasoning here</think>Breadth was narrow.')).toBe('Breadth was narrow.');
    expect(stripThinking('<THINK>x</THINK>ok <think>y</think>then')).toBe('ok then');
    expect(stripThinking('  plain answer  ')).toBe('plain answer');
  });

  it('reads their usage and prices a free answer at a real zero', () => {
    const usage = extractUsage('groq', { usage: { prompt_tokens: 900, completion_tokens: 80 } });
    expect(usage).toEqual({ inputTokens: 900, outputTokens: 80 });
    expect(extractUsage('cloudflare', { usage: { prompt_tokens: 10, completion_tokens: 2 } })).toEqual({ inputTokens: 10, outputTokens: 2 });
    expect(estimateCostUsd('groq', 'openai/gpt-oss-120b', usage)).toBe(0);
    expect(estimateCostUsd('cloudflare', '@cf/google/gemma-4-26b-a4b-it', usage)).toBe(0);
    expect(estimateCostUsd('groq', 'openai/gpt-oss-120b', null)).toBeNull(); // unknown usage stays unknown
  });

  it("carries a provider's status and how long it asked us to wait, in the same message as before", () => {
    const error = new ProviderHttpError('groq', 429, 12);
    expect(error.message).toBe('groq 429: rate limited - wait and retry');
    expect([error.status, error.retryAfterSec, error.provider]).toEqual([429, 12, 'groq']);
    expect(new ProviderHttpError('cloudflare', 401, null).message).toMatch(/authentication failed/);
  });
});
