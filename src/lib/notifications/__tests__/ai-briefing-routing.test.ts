import { describe, expect, it } from 'vitest';
import { DROP_REASONS, buildDedupeKey, buildIdempotencyKey, routeNotification } from '../router';
import { DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_TYPES, isNotificationType } from '../types';
import type { NotificationEvent, NotificationPreferences } from '../types';
import { buildTelegramTextForEvent } from '../telegram-templates';
import { buildWhatsAppMessageForEvent } from '../whatsapp-templates';

const DAYTIME = new Date('2026-10-07T09:20:00.000Z');

function briefing(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    id: 'evt-brief',
    type: 'ai_briefing',
    userId: 'user-1',
    triggerReason: 'Daily AI briefing for 2026-10-07',
    title: 'AI briefing · Wed 7 Oct: Constellation, Teradyne, SAP + 4 more',
    body: '⚡ Constellation (Nasdaq: CEG): Google signed a 20-year agreement.\nFull briefing with sources: open Lyra > AI Briefing.',
    evidenceRefs: [],
    relatedEntityType: 'symbol',
    relatedEntityId: '',
    relevanceScore: 100,
    url: '/briefing',
    dedupeKey: buildDedupeKey('ai_briefing', 'user-1', '2026-10-07'),
    idempotencyKey: buildIdempotencyKey('evt-brief', 'telegram'),
    createdAt: '2026-10-07T09:20:00.000Z',
    ...overrides,
  };
}

function prefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, telegramEnabled: true, quietHoursEnabled: false, ...overrides };
}

describe('ai_briefing - a scheduled daily summary that rides the digest preference', () => {
  it('is a registered type', () => {
    expect(isNotificationType('ai_briefing')).toBe(true);
    expect(NOTIFICATION_TYPES).toContain('ai_briefing');
  });

  it('delivers to the enabled channels when the daily digest is on, never deferred', () => {
    expect(routeNotification(briefing(), prefs(), { now: DAYTIME })).toEqual({ deliver: true, channels: ['telegram'], deferredToDigest: false });
  });

  it('drops when the daily digest is off, or when no channel is connected', () => {
    expect(routeNotification(briefing(), prefs({ dailyDigest: false }), { now: DAYTIME })).toEqual({ deliver: false, reason: DROP_REASONS.dailyDigestDisabled });
    expect(
      routeNotification(briefing(), prefs({ telegramEnabled: false, pushEnabled: false, whatsappEnabled: false, slackEnabled: false }), { now: DAYTIME }),
    ).toEqual({ deliver: false, reason: DROP_REASONS.noChannels });
  });

  it('survives quiet mode like the digest, and still respects a global mute', () => {
    expect(routeNotification(briefing(), prefs({ alertMode: 'quiet' }), { now: DAYTIME })).toEqual({ deliver: true, channels: ['telegram'], deferredToDigest: false });
    expect(routeNotification(briefing(), prefs({ muteAll: true }), { now: DAYTIME })).toEqual({ deliver: false, reason: DROP_REASONS.mutedAll });
  });

  it('renders as research with the deep link and no symbol chip', () => {
    const text = buildTelegramTextForEvent(briefing());
    expect(text).toContain('🗞️ <b>AI briefing</b>');
    expect(text).not.toContain('<code>$');
    expect(text).toContain('Research, not advice');
    const whatsapp = buildWhatsAppMessageForEvent(briefing());
    expect(whatsapp.kind).toBe('text');
  });
});
