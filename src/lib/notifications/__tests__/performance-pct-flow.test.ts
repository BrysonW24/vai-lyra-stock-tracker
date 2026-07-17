/**
 * performancePct end-to-end flow. The renderers gained a performance badge in v0.37.0,
 * but nothing ever WROTE the field: the dispatch input did not carry it, the event
 * builder did not set it, and held-event reconstruction lost it. These tests pin the
 * whole chain: input -> stored payload (performance_pct) -> live event -> renderer,
 * and the held-release path that rebuilds the event from the stored row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchNotificationEvent, sweepNotifications } from '../dispatch';
import { buildSlackTextForEvent } from '../slack-templates';
import type { NotificationEvent } from '../types';
import { fakeSupabase, SLACK_WEBHOOK as WEBHOOK, type Row } from './fake-supabase';

function baseTables(): Record<string, Row[]> {
  return {
    user_alert_preferences: [
      { user_id: 'u1', quiet_hours_enabled: false, slack_enabled: true, min_signal_score: 40 },
    ],
    notification_channels: [
      { id: 'ch-1', user_id: 'u1', channel_type: 'slack', destination: WEBHOOK, is_active: true, is_verified: true },
    ],
    profiles: [],
    push_subscriptions: [],
    notification_events: [],
    notification_deliveries: [],
  };
}

function slackBodies(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .filter(([target]) => String(target).includes('hooks.slack.com'))
    .map(([, init]) => String((init as RequestInit | undefined)?.body ?? ''));
}

describe('performancePct dispatch flow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('carries input.performancePct into the stored payload and the rendered Slack message', async () => {
    const tables = baseTables();
    const result = await dispatchNotificationEvent(fakeSupabase(tables), {
      userId: 'u1',
      type: 'monthly_review',
      title: 'Your June review',
      body: 'Portfolio moved over the month.',
      triggerReason: 'Scheduled monthly review',
      relevanceScore: 100,
      performancePct: 8.2,
      dedupeKey: 'monthly_review:u1:2026-06',
    });

    expect(result.ok).toBe(true);
    expect(result.deliveredChannels).toContain('slack');

    const stored = tables.notification_events[0];
    expect((stored.payload as Row).performance_pct).toBe(8.2);

    const [body] = slackBodies(fetchMock);
    expect(body).toContain('+8.2%');
    expect(body).toContain('Period return');
  });

  it('omits performance_pct from the payload when the input does not carry one', async () => {
    const tables = baseTables();
    await dispatchNotificationEvent(fakeSupabase(tables), {
      userId: 'u1',
      type: 'signal_alert',
      title: 'NVDA signal',
      body: 'NVDA entered the reset band.',
      relevanceScore: 90,
      dedupeKey: 'signal_alert:nvda:2026-07-17',
    });

    const stored = tables.notification_events[0];
    expect(Object.prototype.hasOwnProperty.call(stored.payload as Row, 'performance_pct')).toBe(false);
  });

  it('rejects a non-finite performancePct instead of storing NaN', async () => {
    const tables = baseTables();
    await dispatchNotificationEvent(fakeSupabase(tables), {
      userId: 'u1',
      type: 'monthly_review',
      title: 'Broken review',
      body: 'body',
      relevanceScore: 100,
      performancePct: Number.NaN,
      dedupeKey: 'monthly_review:u1:2026-05',
    });

    const stored = tables.notification_events[0];
    expect(Object.prototype.hasOwnProperty.call(stored.payload as Row, 'performance_pct')).toBe(false);
  });

  it('survives held-event release - the badge is rebuilt from the stored payload', async () => {
    const tables = baseTables();
    // A review stored WITH performance_pct, held by an earlier quiet window.
    tables.notification_events.push({
      id: 'evt-review-1',
      type: 'quarterly_review',
      severity: 'medium',
      user_id: 'u1',
      title: 'Your Q2 review',
      body: 'Quarter in numbers.',
      trigger_reason: 'Scheduled quarterly review',
      evidence_refs: [],
      relevance_score: 100,
      payload: { performance_pct: 12.4 },
      dedupe_key: 'quarterly_review:u1:2026-q2',
      idempotency_key: 'evt-review-1:event',
      url: '/portfolio',
      created_at: new Date().toISOString(),
    });
    tables.notification_deliveries.push({
      event_id: 'evt-review-1',
      user_id: 'u1',
      channel: 'held',
      status: 'held',
      idempotency_key: 'evt-review-1:held',
      created_at: new Date().toISOString(),
    });

    const result = await sweepNotifications(fakeSupabase(tables), new Date());
    expect(result.released).toBe(1);

    const [body] = slackBodies(fetchMock);
    expect(body).toContain('+12.4%');
  });
});

describe('Slack performance grain', () => {
  function reviewEvent(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
    return {
      id: 'evt-1',
      type: 'monthly_review',
      userId: 'u1',
      triggerReason: 'Scheduled monthly review',
      title: 'Your June review',
      body: 'The month in numbers.',
      evidenceRefs: [],
      relevanceScore: 100,
      dedupeKey: 'monthly_review:u1:2026-06',
      idempotencyKey: 'evt-1:slack',
      createdAt: '2026-06-30T22:10:00.000Z',
      ...overrides,
    };
  }

  it.each([
    [16, ':money_with_wings::money_with_wings::money_with_wings:'],
    [10, ':money_with_wings::money_with_wings:'],
    [5, ':money_with_wings:'],
    [2.5, ':large_green_circle:'],
    [0, ':heavy_minus_sign:'],
    [-3.1, ':small_red_triangle_down:'],
  ])('renders the %s%% tier badge', (pct, badge) => {
    const text = buildSlackTextForEvent(reviewEvent({ performancePct: pct as number }));
    expect(text).toContain(badge);
  });

  it('shows a loss honestly with its sign', () => {
    const text = buildSlackTextForEvent(reviewEvent({ performancePct: -3.1 }));
    expect(text).toContain('-3.1%');
  });

  it('never shows the grain on a non-outcome type even if a pct sneaks in', () => {
    const text = buildSlackTextForEvent(reviewEvent({ type: 'signal_alert', performancePct: 9.9 }));
    expect(text).not.toContain('Period return');
  });

  it('never shows the grain when the event has no measured pct', () => {
    const text = buildSlackTextForEvent(reviewEvent());
    expect(text).not.toContain('Period return');
  });
});
