'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, Check, ExternalLink, Save, Smartphone, X } from 'lucide-react';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@/lib/notifications/types';
import {
  getExistingPushSubscription,
  getPushSupportStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupportStatus,
} from '@/lib/push/client';
import { loadNotifications, saveNotifications, loadProfile } from '@/lib/account';
import { saveNotificationPreferences } from '@/lib/notifications/preferences';
import { buildSlackTextForEvent } from '@/lib/notifications/slack-templates';
import { VOICE_PRESETS } from '@/lib/notifications/voice';
import type { NotificationEvent, VoiceId } from '@/lib/notifications/types';
import { Toggle } from '@/components/Toggle';
import { useIsNativeShell } from '@/lib/native/platform';
import { SlackLogo } from '@/components/SlackLogo';
import { TelegramLogo } from '@/components/TelegramLogo';
import { WhatsAppLogo } from '@/components/WhatsAppLogo';

type Channel = 'telegram' | 'whatsapp' | 'slack';

const CHANNEL_NAME: Record<Channel, string> = { telegram: 'Telegram', whatsapp: 'WhatsApp', slack: 'Slack' };
const CHANNEL_EMPTY_ERROR: Record<Channel, string> = {
  telegram: 'Enter your Telegram chat ID.',
  whatsapp: 'Enter your WhatsApp number.',
  slack: 'Paste your Slack incoming-webhook URL.',
};

interface NotificationApiState {
  ok?: boolean;
  preferences?: NotificationPreferences;
  channels?: Array<{ channel_type: Channel; destination: string | null; is_active?: boolean; is_verified?: boolean | null }>;
  push?: {
    activeSubscriptions: number;
    vapidPublicKey: string;
    configured: boolean;
  };
  error?: string;
  demo?: boolean;
}

interface ChannelVerification {
  status: 'sent' | 'demo_logged' | 'failed';
  verified: boolean;
  message: string;
  error?: string;
}

interface SaveChannelResponse {
  ok?: boolean;
  error?: string;
  verification?: ChannelVerification;
}

const inputClass =
  'w-full rounded border border-line-strong bg-panel px-2.5 py-1.5 font-mono text-[13px] text-ink-title outline-none transition focus:border-line-hair focus:ring-1 focus:ring-blue-focus/40';

const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded border border-line-strong bg-panel px-3 py-1.5 font-mono text-[11px] text-ink-title transition hover:border-line-hair disabled:opacity-40';

const successButton =
  'inline-flex items-center justify-center gap-1.5 rounded border border-positive/40 bg-positive-tint px-3 py-1.5 font-mono text-[11px] text-positive transition hover:bg-positive/15 disabled:opacity-40';

const dangerButton =
  'inline-flex items-center justify-center gap-1.5 rounded border border-negative/40 bg-negative/10 px-3 py-1.5 font-mono text-[11px] text-negative transition hover:bg-negative/15 disabled:opacity-40';

type PillTone = 'on' | 'off' | 'warn';

function StatusPill({ on, label, tone }: { on: boolean; label: string; tone?: PillTone }) {
  // `tone` wins when set; otherwise derive the classic on/off from the boolean. `warn` (amber) is
  // for "a subscription exists on the account but NOT on this device" - a green tick there reads as
  // "already done" and hides the one tap that matters.
  const resolved: PillTone = tone ?? (on ? 'on' : 'off');
  const cls =
    resolved === 'on'
      ? 'border-positive/40 bg-positive-tint text-positive'
      : resolved === 'warn'
        ? 'border-accent-border bg-accent-tint text-accent'
        : 'border-line-strong bg-panel text-ink-3';
  const icon = resolved === 'on' ? <Check size={11} /> : resolved === 'warn' ? <AlertTriangle size={11} /> : <X size={11} />;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] ${cls}`}>
      {icon} {label}
    </span>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/** Shape of the /api/push/test response this panel renders. */
interface NotificationTestResult {
  ok?: boolean;
  eventId?: string;
  deliveredChannels?: string[];
  suppressedChannels?: string[];
  errors?: string[];
  routeReason?: string;
}

/** Deterministic sample event the voice wizard previews - engine-shaped, never sent. */
const VOICE_PREVIEW_EVENT: NotificationEvent = {
  id: 'preview',
  type: 'signal_alert',
  userId: 'preview',
  triggerReason: 'score crossed 80 with volume 2.4x average',
  title: 'NVDA oversold-recovery signal',
  body: 'NVDA entered the reset band on rising volume.',
  evidenceRefs: ['signal:NVDA', 'ohlcv:NVDA:1h'],
  relatedEntityType: 'symbol',
  relatedEntityId: 'NVDA',
  relevanceScore: 85,
  dedupeKey: 'preview',
  idempotencyKey: 'preview',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Shortcode -> emoji, preview only - the wire format keeps shortcodes for Slack. */
const PREVIEW_EMOJI: Record<string, string> = {
  ':dart:': '🎯',
  ':point_right:': '👉',
  ':red_circle:': '🔴',
  ':rotating_light:': '🚨',
};

function previewVoiceText(voice: VoiceId, name?: string): string {
  let text = buildSlackTextForEvent(VOICE_PREVIEW_EVENT, { voice, name });
  for (const [code, emoji] of Object.entries(PREVIEW_EMOJI)) text = text.split(code).join(emoji);
  return text.replace(/[*_>`]/g, '').replace(/<([^|>]+)\|([^>]+)>/g, '$2');
}

function channelDestination(channels: NotificationApiState['channels'], channel: Channel): string {
  return channels?.find((item) => item.channel_type === channel && item.destination)?.destination || '';
}

/** A saved chat channel counts as verified unless the row explicitly says is_verified === false. */
function channelVerified(channels: NotificationApiState['channels'], channel: Channel): boolean {
  const row = channels?.find((item) => item.channel_type === channel && item.destination);
  return Boolean(row && row.is_verified !== false);
}

export function PushNotificationSetup() {
  const nativeShell = useIsNativeShell();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [support, setSupport] = useState<PushSupportStatus>({ supported: false, permission: 'unsupported', standalone: false });
  const [activePushCount, setActivePushCount] = useState(0);
  const [vapidPublicKey, setVapidPublicKey] = useState('');
  const [pushConfigured, setPushConfigured] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<NotificationTestResult | null>(null);
  const [telegramVerified, setTelegramVerified] = useState(false);
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [slackVerified, setSlackVerified] = useState(false);
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [channelNotice, setChannelNotice] = useState<{ channel: Channel; verified: boolean; message: string } | null>(null);

  const pushEnabled = prefs.pushEnabled && activePushCount > 0;
  // Device-aware push state: the badge must reflect THIS device, not just that some subscription
  // exists on the account. Green only when this device has actually granted permission; amber when
  // a subscription exists elsewhere but this device has not been enabled yet.
  const pushOnThisDevice = support.permission === 'granted' && activePushCount > 0;
  const pushTone: PillTone = pushOnThisDevice
    ? 'on'
    : support.permission === 'denied' || activePushCount > 0
      ? 'warn'
      : 'off';
  const pushPillLabel = pushOnThisDevice
    ? 'Push on'
    : support.permission === 'denied'
      ? 'Push blocked here'
      : activePushCount > 0
        ? 'Not on this device'
        : 'Push off';
  const permissionLabel = useMemo(() => {
    if (!support.supported) return 'Unsupported';
    if (support.permission === 'granted') return 'Allowed';
    if (support.permission === 'denied') return 'Blocked';
    return 'Not asked';
  }, [support]);

  async function loadState() {
    setSupport(getPushSupportStatus());
    const localChannels = loadNotifications();
    setTelegramChatId(localChannels.telegramChatId || '');
    setWhatsappPhone(localChannels.whatsappPhone || '');
    setSlackWebhook(localChannels.slackWebhook || '');
    setFirstName(loadProfile().displayName.trim().split(/\s+/)[0] || undefined);

    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      const data = (await response.json()) as NotificationApiState;
      if (!response.ok || data.ok === false) {
        if (!data.demo) setError(data.error || 'Could not load notification settings.');
        return;
      }
      setSettingsLoaded(true);
      if (data.preferences) {
        setPrefs(data.preferences);
        saveNotificationPreferences(data.preferences);
      }
      setActivePushCount(data.push?.activeSubscriptions || 0);
      setVapidPublicKey(data.push?.vapidPublicKey || '');
      setPushConfigured(Boolean(data.push?.configured));
      setTelegramChatId(channelDestination(data.channels, 'telegram') || localChannels.telegramChatId || '');
      setWhatsappPhone(channelDestination(data.channels, 'whatsapp') || localChannels.whatsappPhone || '');
      setSlackWebhook(channelDestination(data.channels, 'slack') || localChannels.slackWebhook || '');
      setTelegramVerified(channelVerified(data.channels, 'telegram'));
      setWhatsappVerified(channelVerified(data.channels, 'whatsapp'));
      setSlackVerified(channelVerified(data.channels, 'slack'));
    } catch {
      setError('Could not reach notification settings.');
    }
  }

  useEffect(() => {
    void loadState();
  }, []);

  function updatePrefs(patch: Partial<NotificationPreferences>) {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      saveNotificationPreferences(next);
      return next;
    });
  }

  async function savePrefs(nextPrefs = prefs) {
    setBusy('prefs');
    setError(null);
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: nextPrefs }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || 'Could not save alert preferences.');
      setNotice('Preferences saved.');
      setTimeout(() => setNotice(null), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save alert preferences.');
    } finally {
      setBusy(null);
    }
  }

  async function enablePush() {
    setBusy('push-enable');
    setError(null);
    try {
      const subscription = await subscribeToPush(vapidPublicKey);
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          platform: support.standalone ? 'pwa' : 'browser',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || 'Could not save push subscription.');
      const next = { ...prefs, pushEnabled: true };
      updatePrefs({ pushEnabled: true });
      await savePrefs(next);
      await loadState();
      setNotice('Push notifications enabled.');
      setTimeout(() => setNotice(null), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable push notifications.');
    } finally {
      setBusy(null);
      setSupport(getPushSupportStatus());
    }
  }

  async function disablePush() {
    setBusy('push-disable');
    setError(null);
    try {
      const existing = await getExistingPushSubscription();
      await unsubscribeFromPush();
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: existing?.endpoint }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || 'Could not disable push subscription.');
      const next = { ...prefs, pushEnabled: false };
      updatePrefs({ pushEnabled: false });
      await savePrefs(next);
      await loadState();
      setNotice('Push notifications disabled.');
      setTimeout(() => setNotice(null), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable push notifications.');
    } finally {
      setBusy(null);
      setSupport(getPushSupportStatus());
    }
  }

  async function sendTest() {
    setBusy('test');
    setError(null);
    setTestResult(null);
    setNotice(null);
    try {
      const response = await fetch('/api/push/test', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.errors?.[0] || data.error || 'Could not send test notification.');
      setTestResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send test notification.');
    } finally {
      setBusy(null);
    }
  }

  async function saveChannel(channel: Channel) {
    const destinations: Record<Channel, string> = {
      telegram: telegramChatId.trim(),
      whatsapp: whatsappPhone.trim(),
      slack: slackWebhook.trim(),
    };
    const destination = destinations[channel];
    if (!destination) {
      setError(CHANNEL_EMPTY_ERROR[channel]);
      return;
    }
    setBusy(channel);
    setError(null);
    setChannelNotice(null);

    const current = loadNotifications();
    saveNotifications({
      ...current,
      telegramChatId: channel === 'telegram' ? destination : current.telegramChatId,
      whatsappPhone: channel === 'whatsapp' ? destination : current.whatsappPhone,
      slackWebhook: channel === 'slack' ? destination : current.slackWebhook,
    });

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelType: channel, destination }),
      });
      const data = (await response.json().catch(() => ({}))) as SaveChannelResponse;
      if (!response.ok || data.ok === false) throw new Error(data.error || `Could not save ${channel}.`);

      // The destination is only "on" once the first send actually reached it. Surface the real
      // outcome instead of an unconditional "saved" - a wrong chat id / number stays unverified
      // and will not silently black-hole alerts.
      const verification = data.verification;
      const verified = verification?.verified ?? false;
      if (verified) {
        updatePrefs(
          channel === 'telegram' ? { telegramEnabled: true } : channel === 'slack' ? { slackEnabled: true } : { whatsappEnabled: true },
        );
      }
      await loadState();
      setChannelNotice({
        channel,
        verified,
        message:
          verification?.message ??
          (verified ? `${CHANNEL_NAME[channel]} verified.` : `${CHANNEL_NAME[channel]} saved but not verified yet.`),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${channel}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <StatusPill on={pushTone === 'on'} tone={pushTone} label={pushPillLabel} />
        <StatusPill
          on={prefs.telegramEnabled && telegramVerified}
          label={telegramChatId && !telegramVerified ? 'Telegram unverified' : `Telegram ${prefs.telegramEnabled && telegramVerified ? 'on' : 'off'}`}
        />
        <StatusPill
          on={prefs.whatsappEnabled && whatsappVerified}
          label={whatsappPhone && !whatsappVerified ? 'WhatsApp unverified' : `WhatsApp ${prefs.whatsappEnabled && whatsappVerified ? 'on' : 'off'}`}
        />
        <StatusPill
          on={prefs.slackEnabled && slackVerified}
          label={slackWebhook && !slackVerified ? 'Slack unverified' : `Slack ${prefs.slackEnabled && slackVerified ? 'on' : 'off'}`}
        />
      </div>

      <section className="space-y-2 border-t border-line pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              <Smartphone size={13} /> iPhone Push
            </p>
            <p className="mt-1 text-[11px] leading-snug text-ink-dim">
              Permission: {permissionLabel}. Active devices: {activePushCount}.
            </p>
          </div>
          <StatusPill
            on={support.standalone}
            label={support.standalone ? 'Home Screen' : nativeShell ? 'Lyra app' : 'Browser'}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {support.permission !== 'granted' ? (
            <button
              type="button"
              onClick={enablePush}
              disabled={!support.supported || !vapidPublicKey || busy !== null}
              className={successButton}
            >
              <BellRing size={13} /> {busy === 'push-enable' ? 'Enabling...' : activePushCount > 0 ? 'Enable on this device' : 'Enable push'}
            </button>
          ) : (
            <button type="button" onClick={disablePush} disabled={busy !== null} className={dangerButton}>
              <X size={13} /> {busy === 'push-disable' ? 'Disabling...' : 'Disable push'}
            </button>
          )}
          <button type="button" onClick={sendTest} disabled={!pushEnabled || busy !== null} className={secondaryButton}>
            <BellRing size={13} /> {busy === 'test' ? 'Sending...' : 'Send test'}
          </button>
        </div>

        {testResult && (
          <div className="mt-2 rounded-md border border-line-strong bg-panel p-3 text-[12px]">
            {testResult.deliveredChannels?.includes('push') ? (
              <p className="font-semibold text-positive mb-1">✓ Test push sent</p>
            ) : (
              <p className="font-semibold text-accent mb-1">
                {testResult.suppressedChannels?.includes('push') ? 'Test logged but suppressed' : 'Push not delivered'}
              </p>
            )}
            
            {testResult.errors && testResult.errors.length > 0 && (
              <p className="text-negative mt-1 break-all font-mono text-[10px]">Error: {testResult.errors.join(', ')}</p>
            )}
            {testResult.routeReason && (
              <p className="text-ink-3 mt-1 text-[11px]">Reason: {testResult.routeReason}</p>
            )}
            
            <div className="mt-2 border-t border-line pt-2 font-mono text-[10px] text-ink-dim">
              <p>eventId: {testResult.eventId || 'none'}</p>
              <p>route: {testResult.routeReason === 'forced instant' ? 'force instant' : testResult.routeReason || 'default'}</p>
              <p>channels: {testResult.deliveredChannels?.length ? testResult.deliveredChannels.join(', ') : 'none'}</p>
              <p>delivery: {testResult.deliveredChannels?.includes('push') ? 'sent' : testResult.errors?.length ? 'failed' : testResult.suppressedChannels?.includes('push') ? 'suppressed' : 'logged'}</p>
            </div>
          </div>
        )}

        {settingsLoaded && !pushConfigured && (
          <p className="text-[11px] leading-snug text-accent">VAPID keys are not configured in this environment.</p>
        )}
        {!support.standalone && !nativeShell && (
          <p className="text-[11px] leading-snug text-ink-dim">
            On iPhone, open Lyra from the Home Screen before enabling push.
          </p>
        )}
        {nativeShell && (
          <p className="text-[11px] leading-snug text-ink-dim">
            In-app push is coming to the Lyra app - Telegram, Slack, and WhatsApp alerts work today.
          </p>
        )}
      </section>

      <section className="grid gap-2 border-t border-line pt-3 md:grid-cols-2">
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-3" htmlFor="tg-id">
            <TelegramLogo size={12} /> Telegram chat ID
          </label>
          <div className="flex gap-2">
            <input id="tg-id" inputMode="numeric" className={inputClass} value={telegramChatId} placeholder="123456789" onChange={(event) => setTelegramChatId(event.target.value.trim())} />
            <button type="button" onClick={() => saveChannel('telegram')} disabled={busy !== null} className={secondaryButton} aria-label="Save Telegram chat ID">
              <TelegramLogo size={14} />
            </button>
          </div>
          <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-info hover:underline">
            Get chat ID <ExternalLink size={11} />
          </a>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-3" htmlFor="wa-phone">
            <WhatsAppLogo size={12} /> WhatsApp number
          </label>
          <div className="flex gap-2">
            <input id="wa-phone" inputMode="tel" className={inputClass} value={whatsappPhone} placeholder="+61 400 000 000" onChange={(event) => setWhatsappPhone(event.target.value)} />
            <button type="button" onClick={() => saveChannel('whatsapp')} disabled={busy !== null} className={secondaryButton} aria-label="Save WhatsApp number">
              <WhatsAppLogo size={14} />
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-3" htmlFor="slack-webhook">
            <SlackLogo size={12} /> Slack webhook
          </label>
          <div className="flex gap-2">
            <input
              id="slack-webhook"
              type="password"
              autoComplete="off"
              className={inputClass}
              value={slackWebhook}
              placeholder="https://hooks.slack.com/services/..."
              onChange={(event) => setSlackWebhook(event.target.value.trim())}
            />
            <button type="button" onClick={() => saveChannel('slack')} disabled={busy !== null} className={secondaryButton} aria-label="Save Slack webhook">
              <SlackLogo size={13} />
            </button>
          </div>
          <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-info hover:underline">
            Create a webhook <ExternalLink size={11} />
          </a>
        </div>

        {channelNotice && (
          <div
            className={`md:col-span-2 rounded border px-3 py-2 font-mono text-[11px] leading-snug ${
              channelNotice.verified
                ? 'border-positive/40 bg-positive-tint text-positive'
                : 'border-accent-border bg-accent-tint text-accent'
            }`}
          >
            {channelNotice.verified ? <Check size={11} className="mr-1 inline" /> : <X size={11} className="mr-1 inline" />}
            {channelNotice.message}
          </div>
        )}
        {!channelNotice && telegramChatId && !telegramVerified && (
          <p className="md:col-span-2 font-mono text-[11px] text-accent">
            Telegram needs verification - open the bot, send /start, then save again so we can confirm delivery.
          </p>
        )}
        {!channelNotice && whatsappPhone && !whatsappVerified && (
          <p className="md:col-span-2 font-mono text-[11px] text-accent">
            WhatsApp needs verification - we have not confirmed a message can reach this number yet.
          </p>
        )}
        {!channelNotice && slackWebhook && !slackVerified && (
          <p className="md:col-span-2 font-mono text-[11px] text-accent">
            Slack needs verification - save the webhook so we can confirm a message reaches your channel.
          </p>
        )}
      </section>

      <section className="space-y-2 border-t border-line pt-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Agent personality</p>
          <p className="mt-1 text-[11px] leading-snug text-ink-dim">
            How Lyra words its alerts to you. The numbers never change - only the framing. Pick one and check the preview.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {VOICE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => updatePrefs({ voice: preset.id })}
              className={`rounded-md border p-2.5 text-left transition ${
                prefs.voice === preset.id
                  ? 'border-positive/40 bg-positive-tint'
                  : 'border-line-strong bg-panel hover:border-line-hair'
              }`}
            >
              <span className={`block text-[12px] font-semibold ${prefs.voice === preset.id ? 'text-positive' : 'text-ink-title'}`}>
                {preset.name}
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-ink-dim">{preset.tagline}</span>
            </button>
          ))}
        </div>
        <div className="rounded-md border border-line-strong bg-panel p-3">
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-ink-dim">Preview - a sample alert in this personality</p>
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink-title">
            {previewVoiceText(prefs.voice, firstName)}
          </pre>
        </div>
        <p className="text-[10px] leading-snug text-ink-dim">
          Personalities are pre-written templates - deterministic, instant, and they can never invent a number. An AI-written
          personality (BYOK, fabrication-guarded) is on the roadmap.
        </p>
      </section>

      <section className="space-y-3 border-t border-line pt-3">
        <div className="grid gap-3 md:grid-cols-[1fr_150px]">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-3" htmlFor="score-floor">
              Minimum signal score
            </label>
            <input
              id="score-floor"
              type="range"
              min="0"
              max="100"
              step="5"
              value={prefs.minRelevanceScore}
              onChange={(event) => updatePrefs({ minRelevanceScore: Number(event.target.value) })}
              className="w-full accent-blue-focus"
            />
          </div>
          <input
            type="number"
            min="0"
            max="100"
            value={prefs.minRelevanceScore}
            onChange={(event) => updatePrefs({ minRelevanceScore: Number(event.target.value) })}
            className={inputClass}
            aria-label="Minimum signal score"
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-3" htmlFor="quiet-start">
              Quiet start
            </label>
            <input id="quiet-start" type="time" value={prefs.quietStart} onChange={(event) => updatePrefs({ quietStart: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-3" htmlFor="quiet-end">
              Quiet end
            </label>
            <input id="quiet-end" type="time" value={prefs.quietEnd} onChange={(event) => updatePrefs({ quietEnd: event.target.value })} className={inputClass} />
          </div>
        </div>
        
        <div className="flex">
          <button type="button" onClick={() => savePrefs()} disabled={busy !== null} className={secondaryButton}>
            <Save size={13} /> {busy === 'prefs' ? 'Saving...' : 'Save preferences'}
          </button>
        </div>

        <div className="space-y-4 my-4">
          {/* Portfolio Card */}
          <div className="rounded-md border border-line border-l-4 border-l-accent bg-panel/50 p-3">
            <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent mb-2">
              <span>💼</span> Portfolio-Driven Alerts
            </h3>
            <p className="text-[11px] text-ink-3 mb-3 leading-relaxed">
              Triggers for risk events, price movements, and news updates related to stocks in your active portfolio.
            </p>
            <div className="divide-y divide-line/50">
              <ToggleRow label="Portfolio movement alerts" checked={prefs.portfolioMovementAlerts} onChange={(checked) => updatePrefs({ portfolioMovementAlerts: checked })} />
            </div>
          </div>

          {/* Watchlist Card */}
          <div className="rounded-md border border-line border-l-4 border-l-blue-deep bg-panel/50 p-3">
            <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-blue-deep mb-2">
              <span>⭐</span> Watchlist-Driven Alerts
            </h3>
            <p className="text-[11px] text-ink-3 mb-3 leading-relaxed">
              Triggers when watched stocks touch key support levels, breach RSI thresholds, or experience significant price swings.
            </p>
            <div className="divide-y divide-line/50">
              <ToggleRow label="Watchlist trigger alerts" checked={prefs.watchlistMovementAlerts} onChange={(checked) => updatePrefs({ watchlistMovementAlerts: checked })} />
            </div>
          </div>

          {/* Paper Bot Card */}
          <div className="rounded-md border border-line border-l-4 border-l-positive bg-panel/50 p-3">
            <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-positive mb-2">
              <span>🤖</span> Paper Bot-Driven Alerts
            </h3>
            <p className="text-[11px] text-ink-3 mb-3 leading-relaxed">
              Real-time notifications for filled simulated orders, stop-loss executions, and trade proposals requiring approval.
            </p>
            <div className="divide-y divide-line/50">
              <ToggleRow label="Paper bot trade alerts" checked={prefs.paperTradeAlerts} onChange={(checked) => updatePrefs({ paperTradeAlerts: checked })} />
              <ToggleRow label="Order approval alerts" checked={prefs.orderApprovalAlerts} onChange={(checked) => updatePrefs({ orderApprovalAlerts: checked })} />
            </div>
          </div>

          {/* General Preferences Card */}
          <div className="rounded-md border border-line border-l-4 border-l-ink-3 bg-panel/50 p-3">
            <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-2 mb-2">
              <span>⚙️</span> Delivery & Digest Rules
            </h3>
            <p className="text-[11px] text-ink-3 mb-3 leading-relaxed">
              Configure delivery windows, digests, quiet hours, and global alert settings.
            </p>
            <div className="divide-y divide-line/50">
              <ToggleRow label="Instant alerts" checked={prefs.instantAlerts} onChange={(checked) => updatePrefs({ instantAlerts: checked })} />
              <ToggleRow label="Quiet hours" checked={prefs.quietHoursEnabled} onChange={(checked) => updatePrefs({ quietHoursEnabled: checked })} />
              <ToggleRow label="Theme alerts" checked={prefs.themeAlerts} onChange={(checked) => updatePrefs({ themeAlerts: checked })} />
              <ToggleRow label="Macro alerts" checked={prefs.macroAlerts} onChange={(checked) => updatePrefs({ macroAlerts: checked })} />
              <ToggleRow label="Daily digest" checked={prefs.dailyDigest} onChange={(checked) => updatePrefs({ dailyDigest: checked })} />
              <ToggleRow label="Weekly report" checked={prefs.weeklyDigest} onChange={(checked) => updatePrefs({ weeklyDigest: checked })} />
            </div>
          </div>
        </div>

        <button type="button" onClick={() => savePrefs()} disabled={busy !== null} className={successButton}>
          <Save size={13} /> {busy === 'prefs' ? 'Saving...' : 'Save preferences'}
        </button>
      </section>

      {notice && <p className="font-mono text-[11px] text-positive">{notice}</p>}
      {error && <p className="font-mono text-[11px] text-negative">{error}</p>}
    </div>
  );
}
