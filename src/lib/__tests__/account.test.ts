import { describe, expect, it } from 'vitest';
import { type AiSettings, withoutAiKey } from '@/lib/account';

describe('withoutAiKey', () => {
  it('removes only the browser-held credential', () => {
    const settings: AiSettings = {
      mode: 'byo',
      provider: 'anthropic',
      apiKey: 'sk-test-not-real',
      model: 'claude-haiku-4-5',
    };

    expect(withoutAiKey(settings)).toEqual({
      mode: 'byo',
      provider: 'anthropic',
      apiKey: '',
      model: 'claude-haiku-4-5',
    });
    expect(settings.apiKey).toBe('sk-test-not-real');
  });
});
