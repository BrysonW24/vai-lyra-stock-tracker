import { randomUUID } from 'node:crypto';
import { sendWebPush, type StoredPushSubscription } from '@/lib/push/server';
import { buildIdempotencyKey, routeNotification } from './router';
import { renderNotificationText, renderNotificationPushBody } from './templates';
import { buildTelegramTextForEvent } from './telegram-templates';
import { DEFAULT_NOTIFICATION_PREFERENCES, type ChannelType, type NotificationEvent, type NotificationPreferences, type NotificationType } from './types';
import { sendTelegramMessage } from './telegram';
import { sendWhatsAppMessage } from './whatsapp';
import { sendSlackMessage } from './slack';
import { buildSlackTextForEvent } from './slack-templates';
import { isVoiceId } from './types';
import { buildWhatsAppMessageForEvent } from './whatsapp-templates';

type SupabaseLike = {
  // Only `.from()` is required of the injected client; the builder chain stays `any` on
  // purpose so unit tests can hand in a tiny fake without recreating supabase-js generics.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

interface PreferenceRow {
  alerts_enabled?: boolean | null;
  digest_enabled?: boolean | null;
  weekly_digest_enabled?: boolean | null;
  push_enabled?: boolean | null;
  telegram_enabled?: boolean | null;
  whatsapp_enabled?: boolean | null;
  slack_enabled?: boolean | null;
  voice_preset?: string | null;
  quiet_hours_enabled?: boolean | null;
  quiet_start?: string | null;
  quiet_end?: string | null;
  timezone?: string | null;
  min_signal_score?: number | null;
  paper_bot_alerts?: boolean | null;
  order_approval_alerts?: boolean | null;
  watchlist_movement_alerts?: boolean | null;
  portfolio_movement_alerts?: boolean | null;
  macro_alerts?: boolean | null;
  theme_alerts?: boolean | null;
  mute_all?: boolean | null;
  muted_until?: string | null;
  muted_symbols?: string[] | null;
  muted_themes?: string[] | null;
}

interface ChannelRow {
  id: string;
  channel_type: ChannelType;
  destination: string | null;
  is_active: boolean | null;
  is_verified?: boolean | null;
}

interface PushSubscriptionRow extends StoredPushSubscription {
  id: string;
  user_id: string;
}

export interface DispatchNotificationInput {
  userId: string;
  type: NotificationType;
  severity?: NotificationEvent['severity'];
  title: string;
  body: string;
  triggerReason?: string;
  evidenceRefs?: string[];
  symbol?: string;
  theme?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relevanceScore?: number;
  /**
   * Engine-measured performance percent for outcome-reporting types (reviews, closed
   * trades). Persisted inside the event payload as `performance_pct` so held-event
   * release and retry re-renders keep the badge - there is no dedicated column.
   */
  performancePct?: number;
  url?: string;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
  idempotencyKey?: string;
  now?: Date;
  forceInstant?: boolean;
}

export interface DispatchNotificationResult {
  ok: boolean;
  deduped?: boolean;
  eventId?: string;
  deliveredChannels: string[];
  suppressedChannels: string[];
  routeReason?: string;
  errors: string[];
}

function hhmm(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : fallback;
}

async function loadActiveChannels(supabase: SupabaseLike, userId: string): Promise<ChannelRow[]> {
  const { data } = await supabase
    .from('notification_channels')
    .select('id, channel_type, destination, is_active, is_verified')
    .eq('user_id', userId)
    .eq('is_active', true);
  // Chat channels (telegram/whatsapp) only ever deliver once verified - an unverified row
  // means we have not yet confirmed we can actually reach that chat id / number, so sending
  // to it would silently black-hole. A null is_verified (legacy rows from before the column
  // existed) is treated as verified so existing working channels are not regressed. This gate
  // is chat-only; web push lives in push_subscriptions and is never loaded here.
  return (data || []).filter(
    (row: ChannelRow) => row.destination && row.is_verified !== false,
  ) as ChannelRow[];
}

async function loadPreferences(
  supabase: SupabaseLike,
  userId: string,
  now: Date = new Date(),
): Promise<{ prefs: NotificationPreferences; channels: ChannelRow[]; displayName?: string }> {
  const [{ data: row }, channels, { data: profileRow }] = await Promise.all([
    supabase.from('user_alert_preferences').select('*').eq('user_id', userId).maybeSingle(),
    loadActiveChannels(supabase, userId),
    // First name feeds voice templates ({name}); absence degrades gracefully in fillVoiceTemplate.
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
  ]);

  const prefsRow = (row || {}) as PreferenceRow;
  const displayName = ((profileRow as { display_name?: string | null } | null)?.display_name || '').split(/\s+/)[0] || undefined;
  const hasTelegram = channels.some((channel) => channel.channel_type === 'telegram');
  const hasWhatsApp = channels.some((channel) => channel.channel_type === 'whatsapp');
  const hasSlack = channels.some((channel) => channel.channel_type === 'slack');
  // Timed snooze: active while now < muted_until. An unparseable timestamp fails OPEN (no mute) -
  // silently muting every alert forever on a bad value would be worse than delivering.
  const mutedUntil = prefsRow.muted_until ? new Date(prefsRow.muted_until) : null;
  const snoozed = mutedUntil !== null && Number.isFinite(mutedUntil.getTime()) && now < mutedUntil;

  return {
    channels,
    displayName,
    prefs: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      muteAll: Boolean(prefsRow.mute_all) || snoozed,
      mutedSymbols: prefsRow.muted_symbols ?? DEFAULT_NOTIFICATION_PREFERENCES.mutedSymbols,
      mutedThemes: prefsRow.muted_themes ?? DEFAULT_NOTIFICATION_PREFERENCES.mutedThemes,
      instantAlerts: prefsRow.alerts_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.instantAlerts,
      dailyDigest: prefsRow.digest_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.dailyDigest,
      weeklyDigest: prefsRow.weekly_digest_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.weeklyDigest,
      pushEnabled: prefsRow.push_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled,
      telegramEnabled: (prefsRow.telegram_enabled ?? false) || hasTelegram,
      whatsappEnabled: (prefsRow.whatsapp_enabled ?? false) || hasWhatsApp,
      slackEnabled: (prefsRow.slack_enabled ?? false) || hasSlack,
      voice: isVoiceId(prefsRow.voice_preset) ? prefsRow.voice_preset : DEFAULT_NOTIFICATION_PREFERENCES.voice,
      quietHoursEnabled: prefsRow.quiet_hours_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnabled,
      quietStart: hhmm(prefsRow.quiet_start, DEFAULT_NOTIFICATION_PREFERENCES.quietStart),
      quietEnd: hhmm(prefsRow.quiet_end, DEFAULT_NOTIFICATION_PREFERENCES.quietEnd),
      timezone: prefsRow.timezone || DEFAULT_NOTIFICATION_PREFERENCES.timezone,
      minRelevanceScore: prefsRow.min_signal_score ?? DEFAULT_NOTIFICATION_PREFERENCES.minRelevanceScore,
      paperTradeAlerts: prefsRow.paper_bot_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.paperTradeAlerts,
      orderApprovalAlerts: prefsRow.order_approval_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.orderApprovalAlerts,
      watchlistMovementAlerts:
        prefsRow.watchlist_movement_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.watchlistMovementAlerts,
      portfolioMovementAlerts:
        prefsRow.portfolio_movement_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.portfolioMovementAlerts,
      macroAlerts: prefsRow.macro_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.macroAlerts,
      themeAlerts: prefsRow.theme_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.themeAlerts,
    },
  };
}

async function insertDelivery(
  supabase: SupabaseLike,
  params: {
    eventId: string;
    userId: string;
    channel: string;
    destination?: string | null;
    status: string;
    providerMessageId?: string;
    errorMessage?: string;
    idempotencyKey?: string;
  },
): Promise<void> {
  await supabase.from('notification_deliveries').insert({
    event_id: params.eventId,
    user_id: params.userId,
    channel: params.channel,
    destination: params.destination ?? null,
    status: params.status,
    provider_message_id: params.providerMessageId ?? null,
    error_message: params.errorMessage ?? null,
    idempotency_key: params.idempotencyKey ?? null,
    delivered_at: params.status === 'sent' ? new Date().toISOString() : null,
  });
}

async function loadPushSubscriptions(supabase: SupabaseLike, userId: string): Promise<PushSubscriptionRow[]> {
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data || []) as PushSubscriptionRow[];
}

function eventUrl(input: DispatchNotificationInput): string {
  if (input.url) return input.url;
  if (input.symbol) return `/tickers/${encodeURIComponent(input.symbol.toUpperCase())}`;
  if (input.type.startsWith('paper_') || input.type === 'risk_blocked') return '/paper-bot';
  if (input.type.startsWith('portfolio_')) return '/portfolio';
  if (input.type.startsWith('watchlist_')) return '/watchlist';
  return '/';
}

/**
 * Tag an alert's deep link so OPENING it becomes a recorded engagement (nid + ch ->
 * /api/notifications/engaged via the client beacon). This is the first behavioral
 * validation the alert layer has ever had - relevance scores were previously never
 * checked against what users actually act on. Internal links only: an external URL is
 * left untouched (a foreign site would just drop unknown params anyway, and the beacon
 * only runs inside Lyra). Applied at DELIVERY time, so held-release re-renders and
 * sweep retries tag identically.
 */
export function tagEngagementUrl(url: string | undefined, eventId: string, channel: string): string | undefined {
  if (!url) return url;
  const isInternal = url.startsWith('/') && !url.startsWith('//');
  if (!isInternal) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}nid=${encodeURIComponent(eventId)}&ch=${encodeURIComponent(channel)}`;
}

async function deliverPush(
  supabase: SupabaseLike,
  event: NotificationEvent,
  input: DispatchNotificationInput,
): Promise<{ delivered: string[]; suppressed: string[]; errors: string[] }> {
  const subscriptions = await loadPushSubscriptions(supabase, event.userId);
  if (subscriptions.length === 0) {
    await insertDelivery(supabase, {
      eventId: event.id,
      userId: event.userId,
      channel: 'push',
      status: 'suppressed',
      errorMessage: 'no active push subscription',
      idempotencyKey: `${event.id}:push:none`,
    });
    return { delivered: [], suppressed: ['push'], errors: [] };
  }

  const delivered: string[] = [];
  const suppressed: string[] = [];
  const errors: string[] = [];

  for (const subscription of subscriptions) {
    const idempotencyKey = `${event.id}:push:${subscription.id}`;
    const result = await sendWebPush(subscription, {
      title: event.title,
      // Push carries the same substance as chat (data line + Why + disclaimer), not a bare title.
      body: renderNotificationPushBody(event),
      url: tagEngagementUrl(event.url, event.id, 'push'),
      tag: event.dedupeKey,
      dedupeKey: event.dedupeKey,
      data: { eventId: event.id, type: event.type, symbol: input.symbol, theme: input.theme },
    });

    await insertDelivery(supabase, {
      eventId: event.id,
      userId: event.userId,
      channel: 'push',
      destination: subscription.endpoint,
      status: result.status,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
      idempotencyKey,
    });

    if (result.expired) {
      await supabase
        .from('push_subscriptions')
        .update({
          is_active: false,
          disabled_at: new Date().toISOString(),
          disabled_reason: result.errorMessage || 'expired push subscription',
          failure_count: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id)
        .eq('user_id', event.userId);
    } else if (result.status === 'sent') {
      await supabase
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', subscription.id)
        .eq('user_id', event.userId);
    }

    // demo_logged = nothing actually sent (no real key/subscription). It must NOT count as
    // delivered or the UI shows a false green "sent" and the audit is poisoned.
    if (result.status === 'sent') delivered.push('push');
    else if (result.status === 'demo_logged') suppressed.push('push');
    if (result.status === 'failed') errors.push(result.errorMessage || 'push failed');
  }

  return { delivered: Array.from(new Set(delivered)), suppressed: Array.from(new Set(suppressed)), errors };
}

async function deliverChat(
  supabase: SupabaseLike,
  event: NotificationEvent,
  channels: ChannelRow[],
  channelType: Extract<ChannelType, 'telegram' | 'whatsapp' | 'slack'>,
  voiceOpts: { voice: NotificationPreferences['voice']; name?: string } = { voice: 'analyst' },
  // Distinguishes a sweep retry from the original attempt so the adapters' in-memory
  // idempotency dedupe does not swallow it and the delivery log shows attempt lineage.
  idempotencySuffix = '',
): Promise<{ delivered: string[]; suppressed: string[]; errors: string[] }> {
  const destinations = channels.filter((channel) => channel.channel_type === channelType && channel.destination);
  if (destinations.length === 0) {
    await insertDelivery(supabase, {
      eventId: event.id,
      userId: event.userId,
      channel: channelType,
      status: 'suppressed',
      errorMessage: `no active ${channelType} destination`,
      idempotencyKey: `${event.id}:${channelType}:none`,
    });
    return { delivered: [], suppressed: [channelType], errors: [] };
  }

  // Channel-tagged copy so this delivery's deep link records WHICH channel earned the
  // engagement - the renderers below only ever see the tagged event.
  const taggedEvent: NotificationEvent = { ...event, url: tagEngagementUrl(event.url, event.id, channelType) };
  const text = renderNotificationText(taggedEvent);
  // WhatsApp business-initiated sends (every scanner/alert send is one - we are messaging the
  // user, not replying inside their 24h customer-service window) MUST use a pre-approved Meta
  // template, not freeform text, or Meta rejects them. Map the event's structured fields into a
  // typed WhatsAppTemplateMessage via the existing builders. Freeform text is reserved for genuine
  // in-window webhook replies, which do not flow through this dispatch path. Telegram keeps text.
  const whatsAppMessage = channelType === 'whatsapp' ? buildWhatsAppMessageForEvent(taggedEvent) : null;
  const delivered: string[] = [];
  const suppressed: string[] = [];
  const errors: string[] = [];

  for (const destination of destinations) {
    const idempotencyKey = `${buildIdempotencyKey(event.id, channelType)}:${destination.id}${idempotencySuffix}`;
    const result =
      channelType === 'telegram'
        ? await sendTelegramMessage(
            destination.destination!,
            buildTelegramTextForEvent(taggedEvent, { voice: voiceOpts.voice, name: voiceOpts.name }),
            idempotencyKey,
            { eventId: event.id, userId: event.userId, parseMode: 'HTML' },
          )
        : channelType === 'slack'
          ? await sendSlackMessage(
              destination.destination!,
              buildSlackTextForEvent(taggedEvent, { voice: voiceOpts.voice, name: voiceOpts.name }),
              idempotencyKey,
              { eventId: event.id, userId: event.userId },
            )
          : await sendWhatsAppMessage(destination.destination!, whatsAppMessage ?? text, idempotencyKey);

    await insertDelivery(supabase, {
      eventId: event.id,
      userId: event.userId,
      channel: channelType,
      // A Slack destination is the user's webhook URL - the secret itself - so the delivery
      // log only ever stores the adapter's redacted form. Other channels store the raw id.
      destination: channelType === 'slack' ? result.destination : destination.destination,
      status: result.status,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
      idempotencyKey,
    });

    // demo_logged = nothing actually sent; do not report it as delivered (false green / bad audit).
    if (result.status === 'sent') delivered.push(channelType);
    else if (result.status === 'demo_logged') suppressed.push(channelType);
    if (result.status === 'failed') errors.push(result.errorMessage || `${channelType} failed`);
  }

  return { delivered: Array.from(new Set(delivered)), suppressed: Array.from(new Set(suppressed)), errors };
}

interface StoredEventRow {
  id: string;
  type: NotificationType;
  severity?: NotificationEvent['severity'] | null;
  user_id: string;
  title: string;
  body: string;
  trigger_reason?: string | null;
  evidence_refs?: string[] | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  relevance_score?: number | null;
  dedupe_key?: string | null;
  idempotency_key?: string | null;
  url?: string | null;
  created_at?: string | null;
  symbol?: string | null;
  theme?: string | null;
  payload?: Record<string, unknown> | null;
}

/** performance_pct out of a stored payload - only a real finite number survives. */
function performancePctFromPayload(payload: Record<string, unknown> | null | undefined): number | undefined {
  const value = payload?.performance_pct;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Reconstruct a NotificationEvent from a stored notification_events row (for held-event release). */
function eventFromRow(row: StoredEventRow): NotificationEvent {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity ?? 'medium',
    userId: row.user_id,
    triggerReason: row.trigger_reason ?? row.body,
    title: row.title,
    body: row.body,
    evidenceRefs: row.evidence_refs ?? [],
    relatedEntityType: row.related_entity_type ?? undefined,
    relatedEntityId: row.related_entity_id ?? undefined,
    relevanceScore: Number(row.relevance_score ?? 100),
    performancePct: performancePctFromPayload(row.payload),
    dedupeKey: row.dedupe_key ?? row.id,
    idempotencyKey: row.idempotency_key ?? `${row.id}:event`,
    url: row.url ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

/**
 * Drain events that were HELD by quiet hours / instant-off, once the window has ended. Called at
 * the top of each dispatch (hourly cron tick): every held event is re-routed against the current
 * clock; if it is now deliverable (quiet window passed) it is sent to the live channels and the
 * held row is marked released. This is the drainer the old "queued for digest" path lacked -
 * nothing is lost, it just delivers late instead of never.
 */
export async function releaseHeldEvents(supabase: SupabaseLike, userId: string, now: Date): Promise<number> {
  const { data: heldRows } = await supabase
    .from('notification_deliveries')
    .select('event_id')
    .eq('user_id', userId)
    .eq('channel', 'held')
    .eq('status', 'held');
  const eventIds = Array.from(
    new Set(((heldRows as { event_id: string }[] | null) || []).map((r) => r.event_id)),
  ).filter(Boolean);
  if (eventIds.length === 0) return 0;

  const { prefs, channels, displayName } = await loadPreferences(supabase, userId, now);
  let released = 0;
  for (const eventId of eventIds) {
    const { data: row } = await supabase.from('notification_events').select('*').eq('id', eventId).maybeSingle();
    if (!row) {
      await supabase.from('notification_deliveries').update({ status: 'orphaned' }).eq('event_id', eventId).eq('channel', 'held');
      continue;
    }
    const storedRow = row as StoredEventRow;
    const event = eventFromRow(storedRow);
    const decision = routeNotification(event, prefs, { now });
    if (!decision.deliver || decision.deferredToDigest) continue; // still inside quiet hours - keep holding
    // CLAIM before sending. Release runs from two overlapping schedulers (the top of every
    // dispatchNotificationEvent for this user AND the nightly/on-demand sweep), and the old
    // read -> send -> mark pattern let both runners pass the held check before either marked,
    // double-sending the alert. The atomic UPDATE ... WHERE status='held' serialises on the row:
    // exactly one runner sees its row come back and owns the delivery; the loser sees zero rows.
    const { data: claimed } = await supabase
      .from('notification_deliveries')
      .update({ status: 'releasing', attempted_at: now.toISOString() })
      .eq('event_id', eventId)
      .eq('channel', 'held')
      .eq('status', 'held')
      .select('id');
    if (!claimed || (claimed as { id: string }[]).length === 0) continue; // another runner owns it
    const releaseInput: DispatchNotificationInput = {
      userId,
      type: event.type,
      title: event.title,
      body: event.body,
      symbol: storedRow.symbol ?? undefined,
      theme: storedRow.theme ?? undefined,
    };
    for (const channel of decision.channels) {
      if (channel === 'push') await deliverPush(supabase, event, releaseInput);
      else await deliverChat(supabase, event, channels, channel, { voice: prefs.voice, name: displayName });
    }
    await supabase.from('notification_deliveries').update({ status: 'released' }).eq('event_id', eventId).eq('channel', 'held');
    released += 1;
  }
  return released;
}

const RETRYABLE_CHAT_CHANNELS = ['telegram', 'whatsapp', 'slack'] as const;
const RETRY_SUFFIX = ':retry1';
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SweepResult {
  usersSwept: number;
  released: number;
  retried: number;
  errors: string[];
}

/**
 * Scheduled maintenance pass over the delivery log - the drainer that makes deferral and
 * failure recoverable instead of terminal. Called by the nightly workflow (and on demand
 * via POST /api/notifications/dispatch {sweep:true} with the dispatch secret). Two jobs:
 *
 * 1. Release held events for EVERY user with a held row. releaseHeldEvents previously ran
 *    only when a NEW event arrived for that user, so a quiet night stranded holds forever.
 * 2. Retry recently failed chat deliveries exactly once. A 'failed' row used to be
 *    terminal; one bounded retry recovers transient provider errors without ever looping.
 */
export async function sweepNotifications(supabase: SupabaseLike, now: Date = new Date()): Promise<SweepResult> {
  const errors: string[] = [];

  // 0. Crash recovery: a runner that died between claiming a held row ('releasing', stamped via
  // attempted_at) and delivering would strand that event forever. Any claim older than the stale
  // window goes back to 'held' so this sweep re-releases it - late delivery over silent loss.
  const staleClaimBefore = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  try {
    await supabase
      .from('notification_deliveries')
      .update({ status: 'held' })
      .eq('channel', 'held')
      .eq('status', 'releasing')
      .lt('attempted_at', staleClaimBefore);
  } catch {
    /* recovery is best-effort - never blocks the sweep */
  }

  // 1. Held-event release across all users.
  const { data: heldRows } = await supabase
    .from('notification_deliveries')
    .select('user_id')
    .eq('channel', 'held')
    .eq('status', 'held');
  const heldUsers = Array.from(
    new Set(((heldRows as { user_id: string }[] | null) || []).map((row) => row.user_id)),
  ).filter(Boolean);
  let released = 0;
  for (const userId of heldUsers) {
    try {
      released += await releaseHeldEvents(supabase, userId, now);
    } catch (error) {
      errors.push(`release failed for ${userId}: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  // 2. Retry-once for failed chat deliveries inside the retry window.
  const since = new Date(now.getTime() - RETRY_WINDOW_MS).toISOString();
  const { data: failedRows } = await supabase
    .from('notification_deliveries')
    .select('event_id, user_id, channel, idempotency_key')
    .eq('status', 'failed')
    .in('channel', [...RETRYABLE_CHAT_CHANNELS])
    .gte('created_at', since);
  type FailedRow = { event_id: string; user_id: string; channel: string; idempotency_key: string | null };
  const failures = ((failedRows as FailedRow[] | null) || []).filter(
    // A failed row whose key carries the retry suffix IS the retry - never retry a retry.
    (row) => row.event_id && !(row.idempotency_key || '').endsWith(RETRY_SUFFIX),
  );
  const candidates = new Map<string, FailedRow>();
  for (const row of failures) candidates.set(`${row.event_id}:${row.channel}`, row);

  let retried = 0;
  if (candidates.size > 0) {
    const eventIds = Array.from(new Set(Array.from(candidates.values()).map((row) => row.event_id)));
    const { data: historyRows } = await supabase
      .from('notification_deliveries')
      .select('event_id, channel, status, idempotency_key')
      .in('event_id', eventIds);
    type HistoryRow = { event_id: string; channel: string; status: string; idempotency_key: string | null };
    const history = (historyRows as HistoryRow[] | null) || [];

    for (const candidate of candidates.values()) {
      const attempts = history.filter(
        (row) => row.event_id === candidate.event_id && row.channel === candidate.channel,
      );
      const alreadyDelivered = attempts.some((row) => row.status === 'sent');
      const alreadyRetried = attempts.some((row) => (row.idempotency_key || '').endsWith(RETRY_SUFFIX));
      if (alreadyDelivered || alreadyRetried) continue;

      try {
        const { data: eventRow } = await supabase
          .from('notification_events')
          .select('*')
          .eq('id', candidate.event_id)
          .maybeSingle();
        if (!eventRow) continue;
        const event = eventFromRow(eventRow as StoredEventRow);
        const { prefs, channels, displayName } = await loadPreferences(supabase, candidate.user_id, now);
        const decision = routeNotification(event, prefs, { now });
        // Prefs may have changed since the failure; a retry must still obey the router.
        // Deferred means inside quiet hours right now - leave it for a later sweep.
        if (!decision.deliver || decision.deferredToDigest) continue;
        const channelType = candidate.channel as Extract<ChannelType, 'telegram' | 'whatsapp' | 'slack'>;
        if (!decision.channels.includes(channelType)) continue;
        // CLAIM before sending. Two overlapping sweeps both pass the alreadyRetried check above
        // (each read history before either wrote), so the old code sent the retry twice. The claim
        // is an INSERT whose idempotency_key is unique per event+channel retry; under the DB's
        // uq_notification_deliveries_idem index the second runner's identical insert fails 23505
        // and skips. The key ends with RETRY_SUFFIX so future sweeps' alreadyRetried guard sees it.
        const claimKey = `${candidate.event_id}:${candidate.channel}:claim${RETRY_SUFFIX}`;
        const { error: claimError } = await supabase.from('notification_deliveries').insert({
          event_id: candidate.event_id,
          user_id: candidate.user_id,
          channel: candidate.channel,
          status: 'retrying',
          idempotency_key: claimKey,
          error_message: 'retry claim - the sweep that wrote this row owns the retry attempt',
        });
        if (claimError) continue; // 23505 = another sweep owns this retry; any other error: do not send unclaimed
        const result = await deliverChat(
          supabase,
          event,
          channels,
          channelType,
          { voice: prefs.voice, name: displayName },
          RETRY_SUFFIX,
        );
        if (result.delivered.length > 0) retried += 1;
        errors.push(...result.errors);
      } catch (error) {
        errors.push(
          `retry failed for ${candidate.event_id}:${candidate.channel}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }
  }

  return { usersSwept: heldUsers.length, released, retried, errors };
}

export async function dispatchNotificationEvent(
  supabase: SupabaseLike,
  input: DispatchNotificationInput,
): Promise<DispatchNotificationResult> {
  const now = input.now ?? new Date();
  const errors: string[] = [];

  // Drain any events held by an earlier quiet window before processing the new one. Best-effort:
  // a release failure must never block the incoming alert. Skipped for forced/test sends.
  if (!input.forceInstant) {
    try {
      await releaseHeldEvents(supabase, input.userId, now);
    } catch {
      /* release is best-effort - never block the live dispatch */
    }
  }
  const deliveredChannels: string[] = [];
  const suppressedChannels: string[] = [];

  let emoji = '';
  if (input.type.startsWith('portfolio_') || input.type === 'portfolio_news' || input.type === 'portfolio_risk' || input.type === 'portfolio_price_move') {
    emoji = '💼 ';
  } else if (input.type.startsWith('watchlist_') || input.type === 'watchlist_price_move' || input.type === 'signal_alert') {
    emoji = '⭐ ';
  } else if (input.type.startsWith('paper_') || input.type.startsWith('order_') || input.type === 'risk_blocked') {
    emoji = '🤖 ';
  }
  const embellishedTitle = emoji ? `${emoji}${input.title}` : input.title;

  if (input.dedupeKey) {
    const { data: existing } = await supabase
      .from('notification_events')
      .select('id')
      .eq('user_id', input.userId)
      .eq('dedupe_key', input.dedupeKey)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return {
        ok: true,
        deduped: true,
        eventId: existing.id,
        deliveredChannels,
        suppressedChannels,
        errors,
      };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('notification_events')
    .insert({
      user_id: input.userId,
      type: input.type,
      severity: input.severity ?? 'medium',
      title: embellishedTitle,
      body: input.body,
      trigger_reason: input.triggerReason ?? input.body,
      evidence_refs: input.evidenceRefs ?? [],
      symbol: input.symbol ?? null,
      theme: input.theme ?? null,
      related_entity_type: input.relatedEntityType ?? (input.symbol ? 'symbol' : input.theme ? 'theme' : null),
      related_entity_id: input.relatedEntityId ?? input.symbol ?? input.theme ?? null,
      relevance_score: input.relevanceScore ?? 100,
      url: eventUrl(input),
      payload: {
        ...(input.payload ?? {}),
        // Stored in the payload jsonb (no dedicated column) so held-release and
        // retry re-renders can rebuild event.performancePct via eventFromRow.
        ...(typeof input.performancePct === 'number' && Number.isFinite(input.performancePct)
          ? { performance_pct: input.performancePct }
          : {}),
      },
      dedupe_key: input.dedupeKey ?? null,
      idempotency_key: input.idempotencyKey ?? randomUUID(),
    })
    .select('*')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return { ok: true, deduped: true, deliveredChannels, suppressedChannels, errors };
    }
    return { ok: false, deliveredChannels, suppressedChannels, errors: [insertError.message || 'event insert failed'] };
  }

  const event: NotificationEvent = {
    id: inserted.id,
    type: input.type,
    severity: input.severity,
    userId: input.userId,
    triggerReason: input.triggerReason ?? input.body,
    title: inserted.title,
    body: input.body,
    evidenceRefs: input.evidenceRefs ?? [],
    relatedEntityType: inserted.related_entity_type ?? undefined,
    relatedEntityId: inserted.related_entity_id ?? undefined,
    relevanceScore: Number(input.relevanceScore ?? 100),
    performancePct:
      typeof input.performancePct === 'number' && Number.isFinite(input.performancePct)
        ? input.performancePct
        : undefined,
    dedupeKey: input.dedupeKey ?? inserted.id,
    idempotencyKey: input.idempotencyKey ?? `${inserted.id}:event`,
    url: inserted.url ?? eventUrl(input),
    createdAt: inserted.created_at ?? now.toISOString(),
  };

  const { prefs, channels, displayName } = await loadPreferences(supabase, input.userId, now);
  const decision = routeNotification(event, prefs, { now, forceInstant: input.forceInstant });
  if (!decision.deliver) {
    await insertDelivery(supabase, {
      eventId: event.id,
      userId: event.userId,
      channel: 'router',
      status: 'suppressed',
      errorMessage: decision.reason,
      idempotencyKey: `${event.id}:router`,
    });
    return {
      ok: true,
      eventId: event.id,
      deliveredChannels,
      suppressedChannels: ['router'],
      routeReason: decision.reason,
      errors,
    };
  }

  if (decision.deferredToDigest) {
    // HELD, not black-holed. Quiet-hours / instant-off deferral parks the event as 'held'; the
    // next hourly dispatch (releaseHeldEvents) re-routes and delivers it once the window ends.
    // The old 'digest'/'queued' row had no drainer, so deferred alerts were lost forever.
    await insertDelivery(supabase, {
      eventId: event.id,
      userId: event.userId,
      channel: 'held',
      status: 'held',
      errorMessage: 'held by quiet hours / instant-alerts off - releases after the window ends',
      idempotencyKey: `${event.id}:held`,
    });
    return {
      ok: true,
      eventId: event.id,
      deliveredChannels: ['held'],
      suppressedChannels,
      errors,
    };
  }

  for (const channel of decision.channels) {
    const result =
      channel === 'push'
        ? await deliverPush(supabase, event, input)
        : await deliverChat(supabase, event, channels, channel, { voice: prefs.voice, name: displayName });
    deliveredChannels.push(...result.delivered);
    suppressedChannels.push(...result.suppressed);
    errors.push(...result.errors);
  }

  return {
    ok: errors.length === 0,
    eventId: event.id,
    deliveredChannels: Array.from(new Set(deliveredChannels)),
    suppressedChannels: Array.from(new Set(suppressedChannels)),
    errors,
  };
}
