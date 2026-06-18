import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@/lib/notifications/types';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { sendWhatsAppMessage } from '@/lib/notifications/whatsapp';

/**
 * Notification-channel write API. Saves where a user wants alerts delivered (Telegram
 * chat id or WhatsApp number) into notification_channels, scoped to the signed-in user
 * via RLS so the destination is only ever visible to that user. The Telegram bot token /
 * WhatsApp Business credentials live server-side in the worker, never here.
 */

type ChannelType = 'telegram' | 'whatsapp';

interface SaveChannelRequest {
  channelType: ChannelType;
  destination: string;
  label?: string;
}

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

interface PreferencePatchBody {
  preferences?: Partial<NotificationPreferences>;
}

const demoResponse = () =>
  NextResponse.json(
    { ok: false, demo: true, error: 'Supabase not configured - running in demo mode.' },
    { status: 200 },
  );

const unauthenticated = () =>
  NextResponse.json({ ok: false, error: 'Sign in to set up notifications.' }, { status: 401 });

interface ChannelVerificationResult {
  /** Real outcome of the first send - the source of truth for whether the channel works. */
  status: 'sent' | 'demo_logged' | 'failed';
  /** True only when the destination was actually reached; gates dispatch + the enabled flag. */
  verified: boolean;
  /** UI-facing line explaining what happened, in plain language. */
  message: string;
  /** Provider error (redacted by the adapter) when the send failed. */
  error?: string;
}

/**
 * Attempt a real first send to a freshly-saved chat destination and report the truth. This is the
 * verification probe behind Fix 1: a raw chat id / phone number is only proven once a send to it
 * actually lands. Never throws - the adapters return a status instead of raising. A 'demo_logged'
 * result means no provider is configured server-side, so the destination genuinely cannot be
 * verified yet (not a silent success). This probe is chat-only; it never touches web push.
 */
async function verifyChatChannel(channelType: ChannelType, destination: string): Promise<ChannelVerificationResult> {
  const probeKey = `verify:${channelType}:${destination}:${randomUUID()}`;
  const probeText =
    'Lyra is confirming this channel. You are now set up to receive Lyra alerts here. Research, not advice.';

  const result =
    channelType === 'telegram'
      ? await sendTelegramMessage(destination, probeText, probeKey)
      : await sendWhatsAppMessage(destination, probeText, probeKey);

  if (result.status === 'sent') {
    return { status: 'sent', verified: true, message: 'Channel verified - we reached this chat. Alerts are on.' };
  }
  if (result.status === 'demo_logged') {
    return {
      status: 'demo_logged',
      verified: false,
      message:
        channelType === 'telegram'
          ? 'Saved, but not verified yet - the Telegram bot is not configured in this environment, so we could not confirm delivery. Open the bot and send /start, then save again.'
          : 'Saved, but not verified yet - WhatsApp is not configured in this environment, so we could not confirm delivery.',
    };
  }
  return {
    status: 'failed',
    verified: false,
    message:
      channelType === 'telegram'
        ? 'We could not reach this chat yet - open the bot and send /start, then save again.'
        : 'We could not reach this number yet - check it and try again, and make sure you have messaged the business number first.',
    error: result.errorMessage,
  };
}

function hhmm(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : fallback;
}

function coercePrefs(
  row: PreferenceRow | null | undefined,
  channels: Array<{ channel_type: string; is_verified?: boolean | null }>,
  activePushCount: number,
): NotificationPreferences {
  // Only VERIFIED chat channels count as "on" - an unverified row exists but does not deliver
  // (dispatch filters on is_verified), so the toggle must not claim it is active. Null is_verified
  // (legacy rows) is treated as verified so pre-existing working channels are not regressed.
  const hasTelegram = channels.some((channel) => channel.channel_type === 'telegram' && channel.is_verified !== false);
  const hasWhatsApp = channels.some((channel) => channel.channel_type === 'whatsapp' && channel.is_verified !== false);
  const prefs = row || {};

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    instantAlerts: prefs.alerts_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.instantAlerts,
    dailyDigest: prefs.digest_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.dailyDigest,
    weeklyDigest: prefs.weekly_digest_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.weeklyDigest,
    pushEnabled: Boolean((prefs.push_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled) && activePushCount > 0),
    telegramEnabled: Boolean((prefs.telegram_enabled ?? false) || hasTelegram),
    whatsappEnabled: Boolean((prefs.whatsapp_enabled ?? false) || hasWhatsApp),
    quietHoursEnabled: prefs.quiet_hours_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnabled,
    quietStart: hhmm(prefs.quiet_start, DEFAULT_NOTIFICATION_PREFERENCES.quietStart),
    quietEnd: hhmm(prefs.quiet_end, DEFAULT_NOTIFICATION_PREFERENCES.quietEnd),
    minRelevanceScore: prefs.min_signal_score ?? DEFAULT_NOTIFICATION_PREFERENCES.minRelevanceScore,
    paperTradeAlerts: prefs.paper_bot_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.paperTradeAlerts,
    orderApprovalAlerts: prefs.order_approval_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.orderApprovalAlerts,
    watchlistMovementAlerts: prefs.watchlist_movement_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.watchlistMovementAlerts,
    portfolioMovementAlerts: prefs.portfolio_movement_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.portfolioMovementAlerts,
    macroAlerts: prefs.macro_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.macroAlerts,
    themeAlerts: prefs.theme_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.themeAlerts,
  };
}

function hasOwn<T extends object>(object: T, key: keyof NotificationPreferences): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const [{ data: prefRow }, { data: channels }, { count: activePushCount }] = await Promise.all([
      supabase.from('user_alert_preferences').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('notification_channels')
        .select('id, channel_type, destination, is_active, is_verified, channel_label')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true),
    ]);

    return NextResponse.json({
      ok: true,
      preferences: coercePrefs(prefRow as PreferenceRow | null, channels || [], activePushCount || 0),
      channels: channels || [],
      push: {
        activeSubscriptions: activePushCount || 0,
        vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
        configured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as PreferencePatchBody | Partial<NotificationPreferences>;
    const preferences = 'preferences' in body && body.preferences ? body.preferences : (body as Partial<NotificationPreferences>);
    const patch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };

    if (hasOwn(preferences, 'instantAlerts')) patch.alerts_enabled = Boolean(preferences.instantAlerts);
    if (hasOwn(preferences, 'dailyDigest')) patch.digest_enabled = Boolean(preferences.dailyDigest);
    if (hasOwn(preferences, 'weeklyDigest')) patch.weekly_digest_enabled = Boolean(preferences.weeklyDigest);
    if (hasOwn(preferences, 'pushEnabled')) patch.push_enabled = Boolean(preferences.pushEnabled);
    if (hasOwn(preferences, 'telegramEnabled')) patch.telegram_enabled = Boolean(preferences.telegramEnabled);
    if (hasOwn(preferences, 'whatsappEnabled')) patch.whatsapp_enabled = Boolean(preferences.whatsappEnabled);
    if (hasOwn(preferences, 'quietHoursEnabled')) patch.quiet_hours_enabled = Boolean(preferences.quietHoursEnabled);
    if (hasOwn(preferences, 'quietStart')) patch.quiet_start = preferences.quietStart || DEFAULT_NOTIFICATION_PREFERENCES.quietStart;
    if (hasOwn(preferences, 'quietEnd')) patch.quiet_end = preferences.quietEnd || DEFAULT_NOTIFICATION_PREFERENCES.quietEnd;
    if (hasOwn(preferences, 'minRelevanceScore')) {
      patch.min_signal_score = Math.min(Math.max(Number(preferences.minRelevanceScore ?? 75), 0), 100);
    }
    if (hasOwn(preferences, 'paperTradeAlerts')) patch.paper_bot_alerts = Boolean(preferences.paperTradeAlerts);
    if (hasOwn(preferences, 'orderApprovalAlerts')) patch.order_approval_alerts = Boolean(preferences.orderApprovalAlerts);
    if (hasOwn(preferences, 'watchlistMovementAlerts')) patch.watchlist_movement_alerts = Boolean(preferences.watchlistMovementAlerts);
    if (hasOwn(preferences, 'portfolioMovementAlerts')) patch.portfolio_movement_alerts = Boolean(preferences.portfolioMovementAlerts);
    if (hasOwn(preferences, 'macroAlerts')) patch.macro_alerts = Boolean(preferences.macroAlerts);
    if (hasOwn(preferences, 'themeAlerts')) patch.theme_alerts = Boolean(preferences.themeAlerts);

    const { error } = await supabase.from('user_alert_preferences').upsert(patch, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ ok: false, error: error.message || 'Failed to save preferences' }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as SaveChannelRequest;
    const channelType = body.channelType;
    if (channelType !== 'telegram' && channelType !== 'whatsapp') {
      return NextResponse.json({ ok: false, error: 'channelType must be telegram or whatsapp' }, { status: 400 });
    }

    const destination = (body.destination || '').trim();
    if (!destination) {
      return NextResponse.json({ ok: false, error: 'A destination is required' }, { status: 400 });
    }
    if (channelType === 'whatsapp') {
      const cleaned = destination.replace(/[^\d+]/g, '');
      if (!/^\+?\d{7,15}$/.test(cleaned)) {
        return NextResponse.json({ ok: false, error: 'Enter a valid phone number in international format, e.g. +61400000000' }, { status: 400 });
      }
    }

    // One active channel per type: deactivate existing, then upsert the chosen one. The row is saved
    // UNVERIFIED (is_verified=false): a raw chat id / phone number is not proof we can actually reach
    // that chat, so it must not deliver until a real send confirms it. dispatch only sends to verified
    // chat channels (loadActiveChannels filters is_verified), so an unconfirmed destination can no
    // longer silently black-hole alerts while the UI claims "saved".
    await supabase.from('notification_channels').update({ is_active: false }).eq('user_id', user.id).eq('channel_type', channelType);

    const { data, error } = await supabase
      .from('notification_channels')
      .upsert(
        {
          user_id: user.id,
          channel_type: channelType,
          destination,
          channel_label: body.label ?? null,
          is_active: true,
          is_verified: false,
          verified_at: null,
        },
        { onConflict: 'user_id,channel_type,destination' },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to save channel' }, { status: 400 });
    }

    // Attempt a real first send to confirm the destination actually works, and report the truth.
    // - 'sent'        => destination confirmed; mark the channel verified and enable the preference.
    // - 'demo_logged' => no provider configured server-side; we genuinely cannot verify, so the
    //                    channel stays unverified and the UI is told so (not a false "saved").
    // - 'failed'      => the provider rejected the destination (e.g. wrong chat id, bad number);
    //                    stays unverified and the real error is surfaced.
    const verification = await verifyChatChannel(channelType, destination);

    if (verification.status === 'sent') {
      await supabase
        .from('notification_channels')
        .update({ is_verified: true, verified_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('channel_type', channelType)
        .eq('destination', destination);

      await supabase.from('user_alert_preferences').upsert(
        {
          user_id: user.id,
          [`${channelType}_enabled`]: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    }

    return NextResponse.json({ ok: true, data, verification });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as { channelType: ChannelType };
    if (body.channelType !== 'telegram' && body.channelType !== 'whatsapp') {
      return NextResponse.json({ ok: false, error: 'channelType must be telegram or whatsapp' }, { status: 400 });
    }

    const { error } = await supabase
      .from('notification_channels')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('channel_type', body.channelType);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to remove channel' }, { status: 400 });
    }

    await supabase.from('user_alert_preferences').upsert(
      {
        user_id: user.id,
        [`${body.channelType}_enabled`]: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
