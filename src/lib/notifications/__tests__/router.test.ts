import { describe, expect, it } from 'vitest';
import {
  DROP_REASONS,
  buildDedupeKey,
  buildIdempotencyKey,
  isWithinQuietHours,
  routeNotification,
} from '../router';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../types';
import type { NotificationEvent, NotificationPreferences } from '../types';

function event(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    id: 'evt-1',
    type: 'signal_alert',
    userId: 'user-1',
    triggerReason: 'score crossed 80 with volume 2.4x average',
    title: 'NVDA momentum signal',
    body: 'NVDA crossed the buy-zone threshold on rising volume.',
    evidenceRefs: ['signal:NVDA:2026-06-11'],
    relatedEntityType: 'symbol',
    relatedEntityId: 'NVDA',
    relevanceScore: 85,
    dedupeKey: buildDedupeKey('signal_alert', 'NVDA', '2026-06-11'),
    idempotencyKey: buildIdempotencyKey('evt-1', 'telegram'),
    createdAt: '2026-06-11T14:00:00.000Z',
    ...overrides,
  };
}

function prefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    telegramEnabled: true,
    whatsappEnabled: true,
    quietHoursEnabled: false,
    ...overrides,
  };
}

// Local-time clocks. These are built in the RUNNER's zone and are only safe where the code under
// test also reads local hours (i.e. isWithinQuietHours called with NO timezone) - constructing and
// reading in the same zone cancels out, so they are deterministic anywhere.
// They are NOT safe for routeNotification: it evaluates the window in prefs.timezone (which defaults
// to Australia/Sydney), so a local clock inverts the window on a UTC runner. Zone-routed tests must
// use the ZONE-anchored instants below instead. (This mismatch made CI red for ~9h of every day.)
const DAYTIME = new Date(2026, 5, 11, 14, 0);
const LATE_NIGHT = new Date(2026, 5, 11, 23, 30);
const EARLY_MORNING = new Date(2026, 5, 12, 6, 30);

// Zone-anchored clocks for anything routed through prefs.timezone. Absolute UTC instants chosen to
// land on a known Sydney wall-clock. June = AEST (UTC+10), no DST ambiguity.
const ZONE = 'Australia/Sydney';
const SYD_DAYTIME = new Date('2026-06-11T04:00:00Z'); // 14:00 Sydney
const SYD_LATE_NIGHT = new Date('2026-06-11T13:30:00Z'); // 23:30 Sydney
const SYD_EARLY_MORNING = new Date('2026-06-11T20:30:00Z'); // 06:30 Sydney (12 June)

describe('routeNotification - relevance floor', () => {
  it('drops events below minRelevanceScore', () => {
    const decision = routeNotification(event({ relevanceScore: 10 }), prefs({ minRelevanceScore: 40 }), {
      now: DAYTIME,
    });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.belowRelevanceFloor });
  });

  it('delivers events exactly at the floor', () => {
    const decision = routeNotification(event({ relevanceScore: 40 }), prefs({ minRelevanceScore: 40 }), {
      now: DAYTIME,
    });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });
});

describe('routeNotification - mutes', () => {
  it('drops a muted symbol matched via relatedEntityType/relatedEntityId (case-insensitive)', () => {
    const decision = routeNotification(event(), prefs({ mutedSymbols: ['nvda'] }), { now: DAYTIME });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.mutedSymbol });
  });

  it('drops a muted symbol matched via dedupe key token when entity tagging is absent', () => {
    const untagged = event({ relatedEntityType: undefined, relatedEntityId: undefined });
    const decision = routeNotification(untagged, prefs({ mutedSymbols: ['NVDA'] }), { now: DAYTIME });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.mutedSymbol });
  });

  it('does not drop an unrelated symbol', () => {
    const decision = routeNotification(event(), prefs({ mutedSymbols: ['TSLA'] }), { now: DAYTIME });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });

  it('drops a muted theme matched via entity tagging', () => {
    const themed = event({
      type: 'theme_breakout',
      relatedEntityType: 'theme',
      relatedEntityId: 'ai-infrastructure',
      dedupeKey: buildDedupeKey('theme_breakout', 'ai-infrastructure', '2026-06-11'),
    });
    const decision = routeNotification(themed, prefs({ mutedThemes: ['AI-Infrastructure'] }), {
      now: DAYTIME,
    });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.mutedTheme });
  });
});

describe('routeNotification - dedupe suppression', () => {
  it('drops an event whose dedupe key was recently delivered', () => {
    const e = event();
    const decision = routeNotification(e, prefs(), {
      now: DAYTIME,
      recentDedupeKeys: [e.dedupeKey],
    });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.duplicate });
  });

  it('delivers when the recent window holds only other keys', () => {
    const decision = routeNotification(event(), prefs(), {
      now: DAYTIME,
      recentDedupeKeys: [buildDedupeKey('signal_alert', 'TSLA', '2026-06-11')],
    });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });
});

describe('routeNotification - quiet hours (overnight 22:00-07:00)', () => {
  const quietPrefs = prefs({ quietHoursEnabled: true, quietStart: '22:00', quietEnd: '07:00', timezone: ZONE });

  it('defers a non-critical event to digest late at night', () => {
    const decision = routeNotification(event(), quietPrefs, { now: SYD_LATE_NIGHT });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: true });
  });

  it('defers a non-critical event to digest in the early morning (window wraps midnight)', () => {
    const decision = routeNotification(event(), quietPrefs, { now: SYD_EARLY_MORNING });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: true });
  });

  it('delivers instantly outside the window', () => {
    const decision = routeNotification(event(), quietPrefs, { now: SYD_DAYTIME });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });
});

describe('routeNotification - safety-critical bypass', () => {
  // Zone-anchored: without an explicit timezone these passed for the WRONG reason on a UTC runner
  // (the window inverted, so "during quiet hours" was never actually quiet and the bypass was untested).
  const quietPrefs = prefs({ quietHoursEnabled: true, quietStart: '22:00', quietEnd: '07:00', timezone: ZONE });

  it('kill_switch_enabled delivers instantly during quiet hours', () => {
    const killSwitch = event({
      type: 'kill_switch_enabled',
      relatedEntityType: undefined,
      relatedEntityId: undefined,
      relevanceScore: 100,
      dedupeKey: buildDedupeKey('kill_switch_enabled', 'daily_loss', '2026-06-11'),
    });
    const decision = routeNotification(killSwitch, quietPrefs, { now: SYD_LATE_NIGHT });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });

  it('order_approval_required delivers instantly during quiet hours', () => {
    const approval = event({
      type: 'order_approval_required',
      relatedEntityType: 'order_intent',
      relatedEntityId: 'oi-9',
      relevanceScore: 100,
      dedupeKey: buildDedupeKey('order_approval_required', 'oi-9', '2026-06-11'),
    });
    const decision = routeNotification(approval, quietPrefs, { now: SYD_LATE_NIGHT });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });

  it('order_approval_required is immune to the orderApprovalAlerts chatter toggle', () => {
    const approval = event({
      type: 'order_approval_required',
      relatedEntityType: 'order_intent',
      relatedEntityId: 'oi-9',
      relevanceScore: 100,
      dedupeKey: buildDedupeKey('order_approval_required', 'oi-9', '2026-06-11'),
    });
    const decision = routeNotification(approval, prefs({ orderApprovalAlerts: false }), { now: DAYTIME });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });

  it('safety-critical events still require at least one enabled channel', () => {
    const killSwitch = event({
      type: 'kill_switch_enabled',
      relevanceScore: 100,
      dedupeKey: buildDedupeKey('kill_switch_enabled', 'global', '2026-06-11'),
    });
    const decision = routeNotification(
      killSwitch,
      prefs({ telegramEnabled: false, whatsappEnabled: false }),
      { now: DAYTIME },
    );
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.noChannels });
  });
});

describe('routeNotification - channels', () => {
  it('returns deliver:false with reason no channels when both channels are disabled', () => {
    const decision = routeNotification(event(), prefs({ telegramEnabled: false, whatsappEnabled: false }), {
      now: DAYTIME,
    });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.noChannels });
    if (!decision.deliver) {
      expect(decision.reason).toBe('no channels');
    }
  });

  it('returns only the enabled channel subset', () => {
    const decision = routeNotification(event(), prefs({ telegramEnabled: true, whatsappEnabled: false }), {
      now: DAYTIME,
    });
    expect(decision).toEqual({ deliver: true, channels: ['telegram'], deferredToDigest: false });
  });

  it('routes native push before chat channels when enabled', () => {
    const decision = routeNotification(event(), prefs({ pushEnabled: true }), {
      now: DAYTIME,
    });
    expect(decision).toEqual({ deliver: true, channels: ['push', 'telegram', 'whatsapp'], deferredToDigest: false });
  });
});

describe('routeNotification - movement alert toggles', () => {
  it('drops watchlist movement alerts when that preference is off', () => {
    const decision = routeNotification(
      event({ type: 'watchlist_price_move', dedupeKey: buildDedupeKey('watchlist_price_move', 'NVDA', 'up-5') }),
      prefs({ watchlistMovementAlerts: false }),
      { now: DAYTIME },
    );
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.watchlistMovementAlertsDisabled });
  });

  it('drops portfolio movement alerts when that preference is off', () => {
    const decision = routeNotification(
      event({ type: 'portfolio_price_move', dedupeKey: buildDedupeKey('portfolio_price_move', 'NVDA', 'down-5') }),
      prefs({ portfolioMovementAlerts: false }),
      { now: DAYTIME },
    );
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.portfolioMovementAlertsDisabled });
  });
});

describe('routeNotification - paper trade alerts toggle', () => {
  const paperEvent = event({
    type: 'paper_trade_opened',
    dedupeKey: buildDedupeKey('paper_trade_opened', 'NVDA', '2026-06-11'),
  });

  it('drops paper trade events when paperTradeAlerts is off', () => {
    const decision = routeNotification(paperEvent, prefs({ paperTradeAlerts: false }), { now: DAYTIME });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.paperTradeAlertsDisabled });
  });

  it('delivers paper trade events when paperTradeAlerts is on', () => {
    const decision = routeNotification(paperEvent, prefs({ paperTradeAlerts: true }), { now: DAYTIME });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });
});

describe('routeNotification - digest preference gates', () => {
  const digest = event({
    type: 'daily_digest',
    relatedEntityType: undefined,
    relatedEntityId: undefined,
    dedupeKey: buildDedupeKey('daily_digest', 'user-1', '2026-06-11'),
  });
  const weekly = event({
    type: 'weekly_report',
    relatedEntityType: undefined,
    relatedEntityId: undefined,
    dedupeKey: buildDedupeKey('weekly_report', 'user-1', '2026-06-11'),
  });

  it('drops a daily digest when dailyDigest is off', () => {
    const decision = routeNotification(digest, prefs({ dailyDigest: false }), { now: DAYTIME });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.dailyDigestDisabled });
  });

  it('drops a weekly report when weeklyDigest is off', () => {
    const decision = routeNotification(weekly, prefs({ weeklyDigest: false }), { now: DAYTIME });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.weeklyDigestDisabled });
  });

  it('delivers a daily digest without digest-deferral even during quiet hours', () => {
    const decision = routeNotification(
      digest,
      prefs({ dailyDigest: true, quietHoursEnabled: true, quietStart: '22:00', quietEnd: '07:00', timezone: ZONE }),
      { now: SYD_EARLY_MORNING },
    );
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });
});

describe('routeNotification - order chatter toggle', () => {
  it('drops order_intent_created when orderApprovalAlerts is off', () => {
    const intent = event({
      type: 'order_intent_created',
      dedupeKey: buildDedupeKey('order_intent_created', 'oi-1', '2026-06-11'),
    });
    const decision = routeNotification(intent, prefs({ orderApprovalAlerts: false }), { now: DAYTIME });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.orderApprovalAlertsDisabled });
  });
});

describe('key helpers - determinism', () => {
  it('buildDedupeKey is deterministic and lowercased', () => {
    expect(buildDedupeKey('signal_alert', 'NVDA', '2026-06-11')).toBe('signal_alert:nvda:2026-06-11');
    expect(buildDedupeKey('signal_alert', 'NVDA', '2026-06-11')).toBe(
      buildDedupeKey('signal_alert', 'nvda', '2026-06-11'),
    );
  });

  it('buildIdempotencyKey is deterministic per event and channel', () => {
    expect(buildIdempotencyKey('EVT-9', 'telegram')).toBe('evt-9:telegram');
    expect(buildIdempotencyKey('evt-9', 'whatsapp')).toBe('evt-9:whatsapp');
    expect(buildIdempotencyKey('evt-9', 'telegram')).toBe(buildIdempotencyKey('evt-9', 'telegram'));
    expect(buildIdempotencyKey('evt-9', 'telegram')).not.toBe(buildIdempotencyKey('evt-9', 'whatsapp'));
  });
});

describe('isWithinQuietHours', () => {
  it('handles overnight windows that wrap midnight', () => {
    expect(isWithinQuietHours(LATE_NIGHT, '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours(EARLY_MORNING, '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours(DAYTIME, '22:00', '07:00')).toBe(false);
  });

  it('handles same-day windows', () => {
    expect(isWithinQuietHours(DAYTIME, '13:00', '15:00')).toBe(true);
    expect(isWithinQuietHours(LATE_NIGHT, '13:00', '15:00')).toBe(false);
  });

  it('fails open on malformed or zero-length windows', () => {
    expect(isWithinQuietHours(LATE_NIGHT, 'garbage', '07:00')).toBe(false);
    expect(isWithinQuietHours(LATE_NIGHT, '22:00', '22:00')).toBe(false);
  });

  it('evaluates the window in the given timezone, not server UTC (the AU inversion bug)', () => {
    // 02:00 UTC == 12:00 noon in Sydney (AEST, UTC+10, no June DST). Window 22:00-07:00.
    const instant = new Date('2026-06-18T02:00:00Z');
    expect(isWithinQuietHours(instant, '22:00', '07:00', 'UTC')).toBe(true); // night in UTC -> quiet
    expect(isWithinQuietHours(instant, '22:00', '07:00', 'Australia/Sydney')).toBe(false); // midday in Sydney -> NOT quiet

    // 13:00 UTC == 23:00 in Sydney -> inside the overnight window there, daytime in UTC.
    const evening = new Date('2026-06-18T13:00:00Z');
    expect(isWithinQuietHours(evening, '22:00', '07:00', 'Australia/Sydney')).toBe(true);
    expect(isWithinQuietHours(evening, '22:00', '07:00', 'UTC')).toBe(false);
  });
});

describe('routeNotification - forceInstant', () => {
  // Zone-anchored so "during quiet hours" is genuinely quiet on every runner - otherwise this
  // proves nothing about forceInstant beating the window.
  const quietPrefs = prefs({ quietHoursEnabled: true, quietStart: '22:00', quietEnd: '07:00', timezone: ZONE });

  it('delivers instantly during quiet hours when forceInstant is true', () => {
    const decision = routeNotification(event(), quietPrefs, { now: SYD_LATE_NIGHT, forceInstant: true });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });

  it('delivers instantly even if instant alerts toggle is off when forceInstant is true', () => {
    const noInstantPrefs = prefs({ instantAlerts: false });
    const decision = routeNotification(event(), noInstantPrefs, { now: DAYTIME, forceInstant: true });
    expect(decision).toEqual({ deliver: true, channels: ['telegram', 'whatsapp'], deferredToDigest: false });
  });

  it('still drops if there are no enabled channels', () => {
    const noChannelsPrefs = prefs({ telegramEnabled: false, whatsappEnabled: false, pushEnabled: false });
    const decision = routeNotification(event(), noChannelsPrefs, { now: DAYTIME, forceInstant: true });
    expect(decision).toEqual({ deliver: false, reason: DROP_REASONS.noChannels });
  });
});
