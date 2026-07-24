import { describe, expect, it } from 'vitest';
import {
  aiFailureMessage,
  classifyAiFailure,
  normaliseAiFailureReason,
} from '../failures';

describe('AI failure classification', () => {
  it.each([
    ['anthropic 401: authentication failed - check the API key', 'invalid_key'],
    ['openai 404: model not found - check the model id', 'invalid_model'],
    ['google 429: rate limited - wait and retry', 'provider_rate_limited'],
    ['anthropic completion: timeout after 30000ms', 'provider_unavailable'],
    ['ai_gateway: openai circuit open - provider is failing', 'provider_unavailable'],
    ['fetch failed', 'provider_unavailable'],
    ['unexpected adapter failure', 'error'],
  ])('classifies %s', (message, expected) => {
    expect(classifyAiFailure(new Error(message))).toBe(expected);
  });

  it('normalises untrusted API response reasons', () => {
    expect(normaliseAiFailureReason('invalid_key')).toBe('invalid_key');
    expect(normaliseAiFailureReason('<script>')).toBe('error');
    expect(normaliseAiFailureReason(null)).toBe('error');
  });

  it('gives every failure an actionable, secret-free user message', () => {
    expect(aiFailureMessage('invalid_key')).toMatch(/key was rejected/i);
    expect(aiFailureMessage('invalid_model')).toMatch(/model is unavailable/i);
    expect(aiFailureMessage('provider_rate_limited')).toMatch(/rate-limiting/i);
    expect(aiFailureMessage('provider_unavailable')).toMatch(/temporarily unavailable/i);
    expect(aiFailureMessage('empty_response')).toMatch(/empty response/i);
  });
});
