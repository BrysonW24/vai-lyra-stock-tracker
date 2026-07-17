/**
 * The v0.45.0 notification types (macro_event, cgt_anniversary) through every renderer,
 * plus the router's macro gate and the calendar's macro metadata. Pins the split that
 * matters: macro briefs are research (suffix ON), CGT notices describe the user's own
 * records (suffix OFF - they carry their own not-tax-advice wording in the body).
 */
import { describe, expect, it } from 'vitest';
import { renderNotificationText } from '../templates';
import { buildSlackTextForEvent } from '../slack-templates';
import { buildTelegramTextForEvent } from '../telegram-templates';
import { routeNotification } from '../router';
import { DEFAULT_NOTIFICATION_PREFERENCES, isNotificationType, type NotificationEvent } from '../types';
import { macroEventMeta, type CalendarEvent } from '@/lib/calendar';

function event(overrides: Partial<NotificationEvent>): NotificationEvent {
  return {
    id: 'evt-1',
    type: 'macro_event',
    userId: 'u1',
    triggerReason: 'Seeded macro calendar: rba_prebrief on 2026-08-11',
    title: 'RBA decision day: announcement 2:30pm AEST',
    body: 'The Monetary Policy Board announces the cash rate decision at 2:30pm Sydney time today.',
    evidenceRefs: [],
    relevanceScore: 100,
    dedupeKey: 'macro_event:rba_prebrief:u1:2026-08-11',
    idempotencyKey: 'evt-1:event',
    createdAt: '2026-08-10T22:05:00.000Z',
    ...overrides,
  };
}

describe('macro_event rendering', () => {
  it('is a valid roster member', () => {
    expect(isNotificationType('macro_event')).toBe(true);
    expect(isNotificationType('cgt_anniversary')).toBe(true);
  });

  it('renders with the MACRO label and the research suffix on every channel', () => {
    const e = event({});
    expect(renderNotificationText(e)).toContain('[MACRO]');
    expect(renderNotificationText(e)).toContain('Research, not advice.');
    expect(buildSlackTextForEvent(e)).toContain(':classical_building:');
    expect(buildSlackTextForEvent(e)).toContain('Research, not advice.');
    expect(buildTelegramTextForEvent(e)).toContain('Macro');
    expect(buildTelegramTextForEvent(e)).toContain('Research, not advice.');
  });
});

describe('cgt_anniversary rendering', () => {
  const cgt = event({
    type: 'cgt_anniversary',
    title: 'AVGO reaches 12 months held in 25 days',
    body: 'Unrealised gain today: +49.3% on cost base including fees.\nGeneral information, not tax advice. Verify with your accountant.',
    dedupeKey: 'cgt_anniversary:u1:pos-1:30d',
  });

  it('does NOT carry the research suffix - it is about the user, not the market', () => {
    expect(renderNotificationText(cgt)).not.toContain('Research, not advice.');
    expect(buildSlackTextForEvent(cgt)).not.toContain('Research, not advice.');
    expect(buildTelegramTextForEvent(cgt)).not.toContain('Research, not advice.');
  });

  it('keeps its own tax wording intact through the wire renderer', () => {
    expect(renderNotificationText(cgt)).toContain('not tax advice');
  });
});

describe('router - macro gate', () => {
  const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, telegramEnabled: true, quietHoursEnabled: false };

  it('macroAlerts defaults ON since v0.45.0 and delivers macro_event', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.macroAlerts).toBe(true);
    const decision = routeNotification(event({}), prefs, { now: new Date('2026-08-10T22:05:00Z') });
    expect(decision.deliver).toBe(true);
  });

  it('macroAlerts=false drops macro_event - one opt-out for the whole pillar', () => {
    const decision = routeNotification(event({}), { ...prefs, macroAlerts: false }, { now: new Date('2026-08-10T22:05:00Z') });
    expect(decision).toEqual({ deliver: false, reason: 'macro alerts disabled' });
  });

  it('cgt_anniversary is not silenced by the macro toggle', () => {
    const decision = routeNotification(
      event({ type: 'cgt_anniversary', dedupeKey: 'cgt_anniversary:u1:pos-1:30d' }),
      { ...prefs, macroAlerts: false },
      { now: new Date('2026-08-10T22:05:00Z') },
    );
    expect(decision.deliver).toBe(true);
  });
});

describe('macroEventMeta', () => {
  function calendarEvent(id: string): CalendarEvent {
    return { id, date: '2026-08-11', type: 'macro', ticker: null, title: 't', importance: 'high' };
  }

  it('resolves every seeded prefix with a source URL and local time', () => {
    for (const [id, url] of [
      ['rba-decision-2026-08-11', 'rba.gov.au/media-releases'],
      ['rba-minutes-2026-08-25', 'rba-board-minutes'],
      ['rba-chart-pack-2026-08-12', 'chart-pack'],
      ['fomc-decision-2026-07-29', 'federalreserve.gov'],
    ] as const) {
      const meta = macroEventMeta(calendarEvent(id));
      expect(meta).not.toBeNull();
      expect(meta!.sourceUrl).toContain(url);
      expect(meta!.timeLocal.length).toBeGreaterThan(0);
    }
  });

  it('returns null for arbitrary rows - only seeded events get the deep treatment', () => {
    expect(macroEventMeta(calendarEvent('earnings-nvda-2026-08-20'))).toBeNull();
  });
});
