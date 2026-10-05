import { describe, expect, it } from 'vitest';
import { scrubSentryEvent } from '@/lib/sentry-scrub';

describe('scrubSentryEvent', () => {
  it('removes the request body - it is where users put their own AI keys and conversations', () => {
    const event = scrubSentryEvent({
      request: {
        url: 'https://lyra.example/api/ai/chat',
        data: { ai: { apiKey: 'sk-user-secret' }, messages: [{ role: 'user', content: 'my salary is...' }] },
        cookies: { 'sb-access-token': 'jwt' },
        headers: { 'content-type': 'application/json' },
      },
    });
    expect(event.request).not.toHaveProperty('data');
    expect(event.request).not.toHaveProperty('cookies');
    expect(JSON.stringify(event)).not.toContain('sk-user-secret');
    expect(JSON.stringify(event)).not.toContain('salary');
  });

  it('removes credential headers whatever their casing, and keeps the harmless ones', () => {
    const event = scrubSentryEvent({
      request: {
        headers: {
          Authorization: 'Bearer abc', Cookie: 'a=b', 'X-Notification-Secret': 's3cret',
          'x-telegram-bot-api-secret-token': 't', 'X-Hub-Signature-256': 'sha256=..', 'user-agent': 'curl/8',
        },
      },
    });
    expect(Object.keys(event.request!.headers!)).toEqual(['user-agent']);
  });

  it('leaves an event with no request untouched', () => {
    const event: { message: string; request?: { data?: unknown } } = { message: 'boom' };
    expect(scrubSentryEvent(event)).toBe(event);
  });
});
