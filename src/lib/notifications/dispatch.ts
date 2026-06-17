import { randomUUID } from 'node:crypto';
import { sendWebPush, type StoredPushSubscription } from '@/lib/push/server';
import { buildIdempotencyKey, routeNotification } from './router';
import { renderNotificationText } from './templates';
import { DEFAULT_NOTIFICATION_PREFERENCES, type ChannelType, type NotificationEvent, type NotificationPreferences, type NotificationType } from './types';
import { sendTelegramMessage } from './telegram';
import { sendWhatsAppMessage } from './whatsapp';

type SupabaseLike = {
  from: (table: string) => any;
};

interface PreferenceRow {
  alerts_enabled?: boolean | null;
  digest_enabled?: boolean | null;
  weekly_digest_enabled?: boolean | null;
  push_enabled?: boolean | null;
  telegram_enabled?: boolean | null;
  whatsapp_enabled?: boolean | null;
  quiet_hours_enabled?: boolean | null;
  quiet_start?: string | null;
  quiet_end?: string | null;
  min_signal_score?: number | null;
  paper_bot_alerts?: boolean | null;
  order_approval_alerts?: boolean | null;
  watchlist_movement_alerts?: boolean | null;
  portfolio_movement_alerts?: boolean | null;
  macro_alerts?: boolean | null;
  theme_alerts?: boolean | null;
}

interface ChannelRow {
  id: string;
  channel_type: ChannelType;
  destination: string | null;
  is_active: boolean | null;
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
  url?: string;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
  idempotencyKey?: string;
  now?: Date;
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
    .select('id, channel_type, destination, is_active')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data || []).filter((row: ChannelRow) => row.destination) as ChannelRow[];
}

async function loadPreferences(supabase: SupabaseLike, userId: string): Promise<{ prefs: NotificationPreferences; channels: ChannelRow[] }> {
  const [{ data: row }, channels] = await Promise.all([
    supabase.from('user_alert_preferences').select('*').eq('user_id', userId).maybeSingle(),
    loadActiveChannels(supabase, userId),
  ]);

  const prefsRow = (row || {}) as PreferenceRow;
  const hasTelegram = channels.some((channel) => channel.channel_type === 'telegram');
  const hasWhatsApp = channels.some((channel) => channel.channel_type === 'whatsapp');

  return {
    channels,
    prefs: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      instantAlerts: prefsRow.alerts_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.instantAlerts,
      dailyDigest: prefsRow.digest_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.dailyDigest,
      weeklyDigest: prefsRow.weekly_digest_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.weeklyDigest,
      pushEnabled: prefsRow.push_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled,
      telegramEnabled: (prefsRow.telegram_enabled ?? false) || hasTelegram,
      whatsappEnabled: (prefsRow.whatsapp_enabled ?? false) || hasWhatsApp,
      quietHoursEnabled: prefsRow.quiet_hours_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnabled,
      quietStart: hhmm(prefsRow.quiet_start, DEFAULT_NOTIFICATION_PREFERENCES.quietStart),
      quietEnd: hhmm(prefsRow.quiet_end, DEFAULT_NOTIFICATION_PREFERENCES.quietEnd),
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
      body: event.body,
      url: event.url,
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

    if (result.status === 'sent' || result.status === 'demo_logged') delivered.push('push');
    if (result.status === 'failed') errors.push(result.errorMessage || 'push failed');
  }

  return { delivered: Array.from(new Set(delivered)), suppressed: Array.from(new Set(suppressed)), errors };
}

async function deliverChat(
  supabase: SupabaseLike,
  event: NotificationEvent,
  channels: ChannelRow[],
  channelType: Extract<ChannelType, 'telegram' | 'whatsapp'>,
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

  const text = renderNotificationText(event);
  const delivered: string[] = [];
  const errors: string[] = [];

  for (const destination of destinations) {
    const idempotencyKey = `${buildIdempotencyKey(event.id, channelType)}:${destination.id}`;
    const result =
      channelType === 'telegram'
        ? await sendTelegramMessage(destination.destination!, text, idempotencyKey, {
            eventId: event.id,
            userId: event.userId,
          })
        : await sendWhatsAppMessage(destination.destination!, text, idempotencyKey);

    await insertDelivery(supabase, {
      eventId: event.id,
      userId: event.userId,
      channel: channelType,
      destination: destination.destination,
      status: result.status,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
      idempotencyKey,
    });

    if (result.status === 'sent' || result.status === 'demo_logged') delivered.push(channelType);
    if (result.status === 'failed') errors.push(result.errorMessage || `${channelType} failed`);
  }

  return { delivered: Array.from(new Set(delivered)), suppressed: [], errors };
}

export async function dispatchNotificationEvent(
  supabase: SupabaseLike,
  input: DispatchNotificationInput,
): Promise<DispatchNotificationResult> {
  const now = input.now ?? new Date();
  const errors: string[] = [];
  const deliveredChannels: string[] = [];
  const suppressedChannels: string[] = [];

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
      title: input.title,
      body: input.body,
      trigger_reason: input.triggerReason ?? input.body,
      evidence_refs: input.evidenceRefs ?? [],
      symbol: input.symbol ?? null,
      theme: input.theme ?? null,
      related_entity_type: input.relatedEntityType ?? (input.symbol ? 'symbol' : input.theme ? 'theme' : null),
      related_entity_id: input.relatedEntityId ?? input.symbol ?? input.theme ?? null,
      relevance_score: input.relevanceScore ?? 100,
      url: eventUrl(input),
      payload: input.payload ?? {},
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
    title: input.title,
    body: input.body,
    evidenceRefs: input.evidenceRefs ?? [],
    relatedEntityType: inserted.related_entity_type ?? undefined,
    relatedEntityId: inserted.related_entity_id ?? undefined,
    relevanceScore: Number(input.relevanceScore ?? 100),
    dedupeKey: input.dedupeKey ?? inserted.id,
    idempotencyKey: input.idempotencyKey ?? `${inserted.id}:event`,
    url: inserted.url ?? eventUrl(input),
    createdAt: inserted.created_at ?? now.toISOString(),
  };

  const { prefs, channels } = await loadPreferences(supabase, input.userId);
  const decision = routeNotification(event, prefs, { now });
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
    await insertDelivery(supabase, {
      eventId: event.id,
      userId: event.userId,
      channel: 'digest',
      status: 'queued',
      errorMessage: 'deferred by quiet hours or instant-alert setting',
      idempotencyKey: `${event.id}:digest`,
    });
    return {
      ok: true,
      eventId: event.id,
      deliveredChannels: ['digest'],
      suppressedChannels,
      errors,
    };
  }

  for (const channel of decision.channels) {
    const result =
      channel === 'push'
        ? await deliverPush(supabase, event, input)
        : await deliverChat(supabase, event, channels, channel);
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
