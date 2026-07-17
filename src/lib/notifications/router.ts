/**
 * Deterministic notification router - pure decision logic, no I/O, no AI.  [NOTIF-01]
 *
 * `routeNotification` is the single gate every NotificationEvent passes before any
 * channel adapter (Push / Telegram / WhatsApp) is allowed to send. It is a pure function of
 * (event, preferences, clock, recent-dedupe window), so identical inputs always
 * produce the identical RouteDecision and the entire policy is unit-testable.
 * AI has no write path into this module - it may phrase a payload the router has
 * already approved, never decide whether one is delivered.
 *
 * Rule order (first match wins):
 *   1. relevance floor          -> drop
 *   2. muted symbol / theme     -> drop
 *   3. duplicate dedupe key     -> drop
 *   4. safety-critical types    -> deliver instantly (see comment at the rule)
 *   5. paper-trade toggle       -> drop when disabled
 *   6. order chatter toggle     -> drop when disabled (non-critical order events)
 *   7. digest preference gates  -> drop when the matching digest pref is off
 *   8. no enabled channels      -> drop ('no channels')
 *   9. quiet hours / instant alerts off -> deliver deferred to digest
 *  10. deliver instantly
 */
import type {
  ChannelType,
  NotificationEvent,
  NotificationPreferences,
  NotificationType,
  RouteDecision,
} from './types';

export interface RouteOptions {
  /** Routing clock - injectable for deterministic tests. Defaults to the wall clock. */
  now?: Date;
  /** Dedupe keys already delivered inside the collapse window (typically same-day). */
  recentDedupeKeys?: string[];
  /** Bypass quiet hours and instant-alerts deferral logic. Used for test notifications. */
  forceInstant?: boolean;
}

/** Stable machine-readable drop reasons so callers and audits never string-match prose. */
export const DROP_REASONS = {
  belowRelevanceFloor: 'below relevance floor',
  mutedSymbol: 'muted symbol',
  mutedTheme: 'muted theme',
  duplicate: 'duplicate',
  paperTradeAlertsDisabled: 'paper trade alerts disabled',
  orderApprovalAlertsDisabled: 'order approval alerts disabled',
  watchlistMovementAlertsDisabled: 'watchlist movement alerts disabled',
  portfolioMovementAlertsDisabled: 'portfolio movement alerts disabled',
  themeAlertsDisabled: 'theme alerts disabled',
  macroAlertsDisabled: 'macro alerts disabled',
  dailyDigestDisabled: 'daily digest disabled',
  weeklyDigestDisabled: 'weekly digest disabled',
  noChannels: 'no channels',
} as const;

/**
 * Safety-critical control events. These ALWAYS deliver instantly:
 * - `kill_switch_enabled` means a deterministic guard halted (future) trading
 *   activity. The owner must learn this immediately, never from tomorrow's digest.
 * - `order_approval_required` means a deterministic order intent is parked waiting
 *   on a human decision. Deferring it would silently stall or expire the approval
 *   workflow, which is strictly worse than an unwanted late-night ping.
 * Quiet hours, the instant-alerts toggle, digest deferral, and even the
 * orderApprovalAlerts chatter toggle do NOT apply to these two types. The only
 * thing that can stop them is having no enabled channel at all.
 */
const SAFETY_CRITICAL_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'kill_switch_enabled',
  'order_approval_required',
  'paper_approval_required',
  'risk_blocked',
]);

const PAPER_TRADE_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'paper_trade_opened',
  'paper_trade_closed',
  'paper_trade_stop_hit',
  'paper_fill',
  'paper_position_move',
]);

/** Non-critical order lifecycle chatter, gated by prefs.orderApprovalAlerts. */
const ORDER_CHATTER_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'order_intent_created',
  'order_rejected',
]);

const WATCHLIST_MOVEMENT_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'watchlist_price_move',
]);

const PORTFOLIO_MOVEMENT_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'portfolio_price_move',
]);

const THEME_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>(['theme_breakout']);

const MACRO_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'capital_event',
  'investor_move',
  // RBA/FOMC decision alerts and morning companions (v0.45.0) - the macroAlerts
  // preference is the single opt-out for the whole macro pillar.
  'macro_event',
]);

/**
 * Scheduled periodic reports beyond the daily digest: the Friday weekly report and the
 * month/quarter/year reviews. One preference (weeklyDigest) gates all of them - they share
 * a cadence-report nature and a separate toggle per cadence would need a schema change for
 * near-zero user value. Like the daily digest they are never deferred-to-digest: the
 * scheduler that emits them owns the send time, and holding a monthly review overnight
 * to re-release it as a stale ping the next morning helps nobody.
 */
const PERIODIC_REPORT_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'weekly_report',
  'monthly_review',
  'quarterly_review',
  'yearly_review',
]);

/** relatedEntityType values that identify a symbol-scoped event. */
const SYMBOL_ENTITY_TYPES: ReadonlySet<string> = new Set(['symbol', 'ticker', 'stock']);

/** relatedEntityType values that identify a theme-scoped event. */
const THEME_ENTITY_TYPES: ReadonlySet<string> = new Set(['theme']);

/** Same-content collapse key, e.g. `signal_alert:nvda:2026-06-11`. Deterministic, lowercase. */
export function buildDedupeKey(type: NotificationType, symbolOrEntity: string, isoDay: string): string {
  return `${type}:${symbolOrEntity}:${isoDay}`.toLowerCase();
}

/** Exactly-once delivery key per channel attempt, e.g. `evt-42:telegram`. Deterministic, lowercase. */
export function buildIdempotencyKey(eventId: string, channel: ChannelType): string {
  return `${eventId}:${channel}`.toLowerCase();
}

/** Parse "HH:MM" (24h) into minutes-since-midnight. Returns null on malformed input. */
function parseTimeToMinutes(value: string): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Minutes-since-midnight of `now` evaluated in the given IANA timezone. The quiet window
 * is stored as wall-clock "HH:MM" in the user's zone, so this MUST be computed in that zone -
 * the server runs in UTC and `now.getHours()` would otherwise invert the window for any non-UTC
 * user. Falls back to server-local time on a missing/invalid zone (never throws).
 */
function minutesSinceMidnightInZone(now: Date, timeZone?: string): number {
  if (!timeZone) return now.getHours() * 60 + now.getMinutes();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
  } catch {
    return now.getHours() * 60 + now.getMinutes();
  }
}

/**
 * True when `now` falls inside the quiet window, evaluated in the user's timezone. Overnight
 * windows such as 22:00-07:00 wrap midnight: quiet when at-or-after start OR before end.
 * Malformed or zero-length windows fail OPEN (no quiet hours) - silently deferring
 * every notification forever because of a bad preference string would be worse
 * than delivering during a window the user failed to configure.
 */
export function isWithinQuietHours(now: Date, quietStart: string, quietEnd: string, timeZone?: string): boolean {
  const start = parseTimeToMinutes(quietStart);
  const end = parseTimeToMinutes(quietEnd);
  if (start === null || end === null || start === end) return false;
  const minutesNow = minutesSinceMidnightInZone(now, timeZone);
  if (start < end) return minutesNow >= start && minutesNow < end;
  return minutesNow >= start || minutesNow < end;
}

/** Enabled delivery channels in a stable order (native push first). */
function enabledChannels(prefs: NotificationPreferences): ChannelType[] {
  const channels: ChannelType[] = [];
  if (prefs.pushEnabled) channels.push('push');
  if (prefs.telegramEnabled) channels.push('telegram');
  if (prefs.whatsappEnabled) channels.push('whatsapp');
  if (prefs.slackEnabled) channels.push('slack');
  return channels;
}

/** Split a dedupe key into lowercase ':' tokens, e.g. `signal_alert:nvda:2026-06-11`. */
function dedupeKeyTokens(dedupeKey: string): string[] {
  return dedupeKey
    .toLowerCase()
    .split(':')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/**
 * Heuristic mute match, case-insensitive:
 * 1. the event is explicitly entity-tagged (relatedEntityType/relatedEntityId) with
 *    a matching entity kind and a muted id, or
 * 2. the dedupe key embeds the muted symbol/theme as a ':' token (`type:entity:day`).
 */
function matchesMutedList(
  event: NotificationEvent,
  muted: string[],
  entityTypes: ReadonlySet<string>,
): boolean {
  if (muted.length === 0) return false;
  const mutedLower = muted.map((value) => value.toLowerCase());
  const entityType = event.relatedEntityType?.toLowerCase() ?? '';
  const entityId = event.relatedEntityId?.toLowerCase() ?? '';
  if (entityId.length > 0 && entityTypes.has(entityType) && mutedLower.includes(entityId)) {
    return true;
  }
  const tokens = dedupeKeyTokens(event.dedupeKey);
  return mutedLower.some((value) => tokens.includes(value));
}

/**
 * Decide whether, where, and how a notification event is delivered.
 * Pure and side-effect free - persistence and sending live behind adapters.
 *
 * Note on rule order vs safety-critical events: relevance, mutes, and dedupe run
 * first by contract. Deterministic emitters stamp safety-critical events with
 * relevanceScore 100 and unique day-scoped dedupe keys (and kill-switch events are
 * not symbol-scoped), so those gates act as exact-duplicate protection for them,
 * not as a silencing path.
 */
export function routeNotification(
  event: NotificationEvent,
  prefs: NotificationPreferences,
  opts: RouteOptions = {},
): RouteDecision {
  const now = opts.now ?? new Date();
  const recentDedupeKeys = opts.recentDedupeKeys ?? [];

  // 1. Relevance floor - events below the user's bar are dropped outright.
  if (event.relevanceScore < prefs.minRelevanceScore) {
    return { deliver: false, reason: DROP_REASONS.belowRelevanceFloor };
  }

  // 2. Mutes - symbol first, then theme.
  if (matchesMutedList(event, prefs.mutedSymbols, SYMBOL_ENTITY_TYPES)) {
    return { deliver: false, reason: DROP_REASONS.mutedSymbol };
  }
  if (matchesMutedList(event, prefs.mutedThemes, THEME_ENTITY_TYPES)) {
    return { deliver: false, reason: DROP_REASONS.mutedTheme };
  }

  // 3. Dedupe - same-content collapse across the recent window.
  if (recentDedupeKeys.includes(event.dedupeKey)) {
    return { deliver: false, reason: DROP_REASONS.duplicate };
  }

  const channels = enabledChannels(prefs);

  // 4. Safety-critical override - see SAFETY_CRITICAL_TYPES for the full rationale.
  // Always instant, never digest-deferred, immune to quiet hours and toggles.
  if (SAFETY_CRITICAL_TYPES.has(event.type)) {
    if (channels.length === 0) {
      return { deliver: false, reason: DROP_REASONS.noChannels };
    }
    return { deliver: true, channels, deferredToDigest: false };
  }

  // 5. Paper-trade events respect the paperTradeAlerts toggle.
  if (PAPER_TRADE_TYPES.has(event.type) && !prefs.paperTradeAlerts) {
    return { deliver: false, reason: DROP_REASONS.paperTradeAlertsDisabled };
  }

  if (WATCHLIST_MOVEMENT_TYPES.has(event.type) && !prefs.watchlistMovementAlerts) {
    return { deliver: false, reason: DROP_REASONS.watchlistMovementAlertsDisabled };
  }

  if (PORTFOLIO_MOVEMENT_TYPES.has(event.type) && !prefs.portfolioMovementAlerts) {
    return { deliver: false, reason: DROP_REASONS.portfolioMovementAlertsDisabled };
  }

  if (THEME_TYPES.has(event.type) && !prefs.themeAlerts) {
    return { deliver: false, reason: DROP_REASONS.themeAlertsDisabled };
  }

  if (MACRO_TYPES.has(event.type) && !prefs.macroAlerts) {
    return { deliver: false, reason: DROP_REASONS.macroAlertsDisabled };
  }

  // 6. Non-critical order lifecycle chatter (intent created / rejected) respects
  // orderApprovalAlerts. order_approval_required itself never reaches this rule -
  // an approval request must not be silenced by its own chatter toggle.
  if (ORDER_CHATTER_TYPES.has(event.type) && !prefs.orderApprovalAlerts) {
    return { deliver: false, reason: DROP_REASONS.orderApprovalAlertsDisabled };
  }

  // 7. Digest types only route when the matching digest pref is on. They are never
  // deferred-to-digest themselves (they ARE the digest); the digest scheduler is
  // responsible for choosing a send time outside quiet hours.
  if (event.type === 'daily_digest') {
    if (!prefs.dailyDigest) {
      return { deliver: false, reason: DROP_REASONS.dailyDigestDisabled };
    }
    if (channels.length === 0) {
      return { deliver: false, reason: DROP_REASONS.noChannels };
    }
    return { deliver: true, channels, deferredToDigest: false };
  }
  if (PERIODIC_REPORT_TYPES.has(event.type)) {
    if (!prefs.weeklyDigest) {
      return { deliver: false, reason: DROP_REASONS.weeklyDigestDisabled };
    }
    if (channels.length === 0) {
      return { deliver: false, reason: DROP_REASONS.noChannels };
    }
    return { deliver: true, channels, deferredToDigest: false };
  }

  // 8. Channel availability - with both Telegram and WhatsApp disabled there is
  // nowhere to send, deferred or otherwise.
  if (channels.length === 0) {
    return { deliver: false, reason: DROP_REASONS.noChannels };
  }

  if (opts.forceInstant) {
    return { deliver: true, channels, deferredToDigest: false };
  }

  // 9. Quiet hours - non-critical events inside the window (including overnight
  // windows like 22:00-07:00) defer to a held delayed-instant send instead of pinging.
  // Evaluated in the user's timezone, not server UTC.
  if (prefs.quietHoursEnabled && isWithinQuietHours(now, prefs.quietStart, prefs.quietEnd, prefs.timezone)) {
    return { deliver: true, channels, deferredToDigest: true };
  }

  // 10. Instant alerts switched off - same deferral semantics as quiet hours.
  if (!prefs.instantAlerts) {
    return { deliver: true, channels, deferredToDigest: true };
  }

  return { deliver: true, channels, deferredToDigest: false };
}
