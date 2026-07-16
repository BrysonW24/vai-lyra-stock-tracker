import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidSlackWebhook, redactSlackWebhook, sendSlackMessage } from '../slack';
import { buildDedupeKey, buildIdempotencyKey, routeNotification } from '../router';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../types';
import type { NotificationEvent } from '../types';

const WEBHOOK = 'https://hooks.slack.com/services/T0AAA/B0BBB/secretsecretsecret';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isValidSlackWebhook - the SSRF fence', () => {
  it('accepts a real incoming-webhook URL', () => {
    expect(isValidSlackWebhook(WEBHOOK)).toBe(true);
  });

  it('rejects every non-hooks.slack.com destination', () => {
    expect(isValidSlackWebhook('https://evil.example.com/services/T0/B0/x')).toBe(false);
    expect(isValidSlackWebhook('http://hooks.slack.com/services/T0/B0/x')).toBe(false);
    expect(isValidSlackWebhook('https://hooks.slack.com.evil.com/services/T0/B0/x')).toBe(false);
    expect(isValidSlackWebhook('https://hooks.slack.com/other/T0/B0/x')).toBe(false);
    expect(isValidSlackWebhook('https://hooks.slack.com/services/')).toBe(false);
    expect(isValidSlackWebhook('')).toBe(false);
    expect(isValidSlackWebhook('not a url')).toBe(false);
  });
});

describe('redactSlackWebhook', () => {
  it('keeps the team id but strips the secret path', () => {
    const redacted = redactSlackWebhook(`slack webhook 404: ${WEBHOOK}`);
    expect(redacted).toBe('slack webhook 404: https://hooks.slack.com/services/T0AAA/[REDACTED]');
    expect(redacted).not.toContain('secretsecretsecret');
  });
});

describe('sendSlackMessage', () => {
  it('returns sent on a 200 webhook response, with the destination redacted', async () => {
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const record = await sendSlackMessage(WEBHOOK, 'NVDA setup alert', 'key-1', { eventId: 'evt-1', userId: 'u-1' });
    expect(record.status).toBe('sent');
    expect(record.channel).toBe('slack');
    expect(record.destination).not.toContain('secretsecretsecret');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ text: 'NVDA setup alert' });
  });

  it('refuses a non-Slack destination without ever fetching', async () => {
    const record = await sendSlackMessage('https://internal-service.local/steal', 'text', 'key-2');
    expect(record.status).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns failed with a redacted error on a webhook error response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('no_service', { status: 404 }));
    const record = await sendSlackMessage(WEBHOOK, 'text', 'key-3');
    expect(record.status).toBe('failed');
    expect(record.errorMessage).toContain('no_service');
    expect(record.errorMessage).not.toContain('secretsecretsecret');
  });

  it('never throws on a network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error(`connect failed to ${WEBHOOK}`));
    const record = await sendSlackMessage(WEBHOOK, 'text', 'key-4');
    expect(record.status).toBe('failed');
    expect(record.errorMessage).not.toContain('secretsecretsecret');
  });

  it('suppresses a duplicate idempotency key instead of double-sending', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
    const first = await sendSlackMessage(WEBHOOK, 'text', 'dup-key');
    const second = await sendSlackMessage(WEBHOOK, 'text', 'dup-key');
    expect(first.status).toBe('sent');
    expect(second.status).toBe('suppressed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('router - slack as an enabled channel', () => {
  it('routes to slack when slackEnabled and includes it alongside other channels', () => {
    const event: NotificationEvent = {
      id: 'evt-9',
      type: 'signal_alert',
      userId: 'user-1',
      triggerReason: 'score crossed 80',
      title: 'NVDA signal',
      body: 'NVDA crossed the threshold.',
      evidenceRefs: [],
      relatedEntityType: 'symbol',
      relatedEntityId: 'NVDA',
      relevanceScore: 85,
      dedupeKey: buildDedupeKey('signal_alert', 'NVDA', '2026-07-16'),
      idempotencyKey: buildIdempotencyKey('evt-9', 'slack'),
      createdAt: '2026-07-16T14:00:00.000Z',
    };
    const decision = routeNotification(
      event,
      { ...DEFAULT_NOTIFICATION_PREFERENCES, quietHoursEnabled: false, telegramEnabled: true, slackEnabled: true },
      { now: new Date('2026-07-16T14:00:00.000Z') },
    );
    expect(decision.deliver).toBe(true);
    if (decision.deliver) expect(decision.channels).toEqual(['telegram', 'slack']);
  });

  it('does not route to slack by default', () => {
    const event: NotificationEvent = {
      id: 'evt-10',
      type: 'signal_alert',
      userId: 'user-1',
      triggerReason: 'score crossed 80',
      title: 'NVDA signal',
      body: 'NVDA crossed the threshold.',
      evidenceRefs: [],
      relevanceScore: 85,
      dedupeKey: buildDedupeKey('signal_alert', 'NVDA', '2026-07-16'),
      idempotencyKey: buildIdempotencyKey('evt-10', 'push'),
      createdAt: '2026-07-16T14:00:00.000Z',
    };
    const decision = routeNotification(
      event,
      { ...DEFAULT_NOTIFICATION_PREFERENCES, quietHoursEnabled: false, pushEnabled: true },
      { now: new Date('2026-07-16T14:00:00.000Z') },
    );
    expect(decision.deliver).toBe(true);
    if (decision.deliver) expect(decision.channels).toEqual(['push']);
  });
});
