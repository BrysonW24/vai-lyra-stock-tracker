'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, Check, ExternalLink, MessageCircle, Save, Send, Smartphone, X } from 'lucide-react';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@/lib/notifications/types';
import {
  getExistingPushSubscription,
  getPushSupportStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupportStatus,
} from '@/lib/push/client';
import { loadNotifications, saveNotifications } from '@/lib/account';
import { saveNotificationPreferences } from '@/lib/notifications/preferences';
import { Toggle } from '@/components/Toggle';

type Channel = 'telegram' | 'whatsapp';

interface NotificationApiState {
  ok?: boolean;
  preferences?: NotificationPreferences;
  channels?: Array<{ channel_type: Channel; destination: string | null; is_active?: boolean }>;
  push?: {
    activeSubscriptions: number;
    vapidPublicKey: string;
    configured: boolean;
  };
  error?: string;
  demo?: boolean;
}

const inputClass =
  'w-full rounded border border-[#263241] bg-[#0d141c] px-2.5 py-1.5 font-mono text-[13px] text-[#dbe5ee] outline-none transition focus:border-[#3a4754] focus:ring-1 focus:ring-[#f3a33a]/30';

const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded border border-[#263241] bg-[#0d141c] px-3 py-1.5 font-mono text-[11px] text-[#c8d3de] transition hover:border-[#3a4754] disabled:opacity-40';

const successButton =
  'inline-flex items-center justify-center gap-1.5 rounded border border-[#1d7f55] bg-[#0d251b] px-3 py-1.5 font-mono text-[11px] text-[#43d18b] transition hover:bg-[#103626] disabled:opacity-40';

const dangerButton =
  'inline-flex items-center justify-center gap-1.5 rounded border border-[#7a2230] bg-[#2a1115] px-3 py-1.5 font-mono text-[11px] text-[#ff6b6b] transition hover:bg-[#351419] disabled:opacity-40';

function StatusPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] ${
        on ? 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]' : 'border-[#263241] bg-[#0d141c] text-[#8190a0]'
      }`}
    >
      {on ? <Check size={11} /> : <X size={11} />} {label}
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
    <div className="flex items-center justify-between gap-3 border-t border-[#1b2530] py-2 first:border-t-0">
      <span className="text-[13px] font-medium text-[#eef3f8]">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function channelDestination(channels: NotificationApiState['channels'], channel: Channel): string {
  return channels?.find((item) => item.channel_type === channel && item.destination)?.destination || '';
}

export function PushNotificationSetup() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [support, setSupport] = useState<PushSupportStatus>({ supported: false, permission: 'unsupported', standalone: false });
  const [activePushCount, setActivePushCount] = useState(0);
  const [vapidPublicKey, setVapidPublicKey] = useState('');
  const [pushConfigured, setPushConfigured] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const pushEnabled = prefs.pushEnabled && activePushCount > 0;
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
    const destination = channel === 'telegram' ? telegramChatId.trim() : whatsappPhone.trim();
    if (!destination) {
      setError(channel === 'telegram' ? 'Enter your Telegram chat ID.' : 'Enter your WhatsApp number.');
      return;
    }
    setBusy(channel);
    setError(null);

    const current = loadNotifications();
    saveNotifications({
      ...current,
      telegramEnabled: channel === 'telegram' ? true : current.telegramEnabled,
      telegramChatId: channel === 'telegram' ? destination : current.telegramChatId,
      whatsappPhone: channel === 'whatsapp' ? destination : current.whatsappPhone,
    });

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelType: channel, destination }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `Could not save ${channel}.`);
      updatePrefs(channel === 'telegram' ? { telegramEnabled: true } : { whatsappEnabled: true });
      await loadState();
      setNotice(`${channel === 'telegram' ? 'Telegram' : 'WhatsApp'} saved.`);
      setTimeout(() => setNotice(null), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${channel}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <StatusPill on={pushEnabled} label={`Push ${pushEnabled ? 'on' : 'off'}`} />
        <StatusPill on={prefs.telegramEnabled} label={`Telegram ${prefs.telegramEnabled ? 'on' : 'off'}`} />
        <StatusPill on={prefs.whatsappEnabled} label={`WhatsApp ${prefs.whatsappEnabled ? 'on' : 'off'}`} />
      </div>

      <section className="space-y-2 border-t border-[#1b2530] pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
              <Smartphone size={13} /> iPhone Push
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[#6f7d8a]">
              Permission: {permissionLabel}. Active devices: {activePushCount}.
            </p>
          </div>
          <StatusPill on={support.standalone} label={support.standalone ? 'Home Screen' : 'Browser'} />
        </div>

        <div className="flex flex-wrap gap-2">
          {!pushEnabled ? (
            <button
              type="button"
              onClick={enablePush}
              disabled={!support.supported || !vapidPublicKey || busy !== null}
              className={successButton}
            >
              <BellRing size={13} /> {busy === 'push-enable' ? 'Enabling...' : 'Enable push'}
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
          <div className="mt-2 rounded-md border border-[#263241] bg-[#0d141c] p-3 text-[12px]">
            {testResult.deliveredChannels?.includes('push') ? (
              <p className="font-semibold text-[#43d18b] mb-1">✓ Test push sent</p>
            ) : (
              <p className="font-semibold text-[#f3a33a] mb-1">
                {testResult.suppressedChannels?.includes('push') ? 'Test logged but suppressed' : 'Push not delivered'}
              </p>
            )}
            
            {testResult.errors && testResult.errors.length > 0 && (
              <p className="text-[#ff6b6b] mt-1 break-all font-mono text-[10px]">Error: {testResult.errors.join(', ')}</p>
            )}
            {testResult.routeReason && (
              <p className="text-[#8190a0] mt-1 text-[11px]">Reason: {testResult.routeReason}</p>
            )}
            
            <div className="mt-2 border-t border-[#1b2530] pt-2 font-mono text-[10px] text-[#6f7d8a]">
              <p>eventId: {testResult.eventId || 'none'}</p>
              <p>route: {testResult.routeReason === 'forced instant' ? 'force instant' : testResult.routeReason || 'default'}</p>
              <p>channels: {testResult.deliveredChannels?.length ? testResult.deliveredChannels.join(', ') : 'none'}</p>
              <p>delivery: {testResult.deliveredChannels?.includes('push') ? 'sent' : testResult.errors?.length ? 'failed' : testResult.suppressedChannels?.includes('push') ? 'suppressed' : 'logged'}</p>
            </div>
          </div>
        )}

        {settingsLoaded && !pushConfigured && (
          <p className="text-[11px] leading-snug text-[#f3a33a]">VAPID keys are not configured in this environment.</p>
        )}
        {!support.standalone && (
          <p className="text-[11px] leading-snug text-[#6f7d8a]">
            On iPhone, open Lyra from the Home Screen before enabling push.
          </p>
        )}
      </section>

      <section className="grid gap-2 border-t border-[#1b2530] pt-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#8190a0]" htmlFor="tg-id">
            Telegram chat ID
          </label>
          <div className="flex gap-2">
            <input id="tg-id" inputMode="numeric" className={inputClass} value={telegramChatId} placeholder="123456789" onChange={(event) => setTelegramChatId(event.target.value.trim())} />
            <button type="button" onClick={() => saveChannel('telegram')} disabled={busy !== null} className={secondaryButton}>
              <Send size={13} />
            </button>
          </div>
          <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#60a5fa] hover:underline">
            Get chat ID <ExternalLink size={11} />
          </a>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#8190a0]" htmlFor="wa-phone">
            WhatsApp number
          </label>
          <div className="flex gap-2">
            <input id="wa-phone" inputMode="tel" className={inputClass} value={whatsappPhone} placeholder="+61 400 000 000" onChange={(event) => setWhatsappPhone(event.target.value)} />
            <button type="button" onClick={() => saveChannel('whatsapp')} disabled={busy !== null} className={secondaryButton}>
              <MessageCircle size={13} />
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-[#1b2530] pt-3">
        <div className="grid gap-3 md:grid-cols-[1fr_150px]">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#8190a0]" htmlFor="score-floor">
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
              className="w-full accent-[#43d18b]"
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
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#8190a0]" htmlFor="quiet-start">
              Quiet start
            </label>
            <input id="quiet-start" type="time" value={prefs.quietStart} onChange={(event) => updatePrefs({ quietStart: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#8190a0]" htmlFor="quiet-end">
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

        <div className="divide-y divide-[#1b2530]">
          <ToggleRow label="Instant alerts" checked={prefs.instantAlerts} onChange={(checked) => updatePrefs({ instantAlerts: checked })} />
          <ToggleRow label="Quiet hours" checked={prefs.quietHoursEnabled} onChange={(checked) => updatePrefs({ quietHoursEnabled: checked })} />
          <ToggleRow label="Watchlist trigger alerts" checked={prefs.watchlistMovementAlerts} onChange={(checked) => updatePrefs({ watchlistMovementAlerts: checked })} />
          <ToggleRow label="Portfolio movement alerts" checked={prefs.portfolioMovementAlerts} onChange={(checked) => updatePrefs({ portfolioMovementAlerts: checked })} />
          <ToggleRow label="Paper bot alerts" checked={prefs.paperTradeAlerts} onChange={(checked) => updatePrefs({ paperTradeAlerts: checked })} />
          <ToggleRow label="Order approval alerts" checked={prefs.orderApprovalAlerts} onChange={(checked) => updatePrefs({ orderApprovalAlerts: checked })} />
          <ToggleRow label="Theme alerts" checked={prefs.themeAlerts} onChange={(checked) => updatePrefs({ themeAlerts: checked })} />
          <ToggleRow label="Macro alerts" checked={prefs.macroAlerts} onChange={(checked) => updatePrefs({ macroAlerts: checked })} />
          <ToggleRow label="Daily digest" checked={prefs.dailyDigest} onChange={(checked) => updatePrefs({ dailyDigest: checked })} />
          <ToggleRow label="Weekly report" checked={prefs.weeklyDigest} onChange={(checked) => updatePrefs({ weeklyDigest: checked })} />
        </div>

        <button type="button" onClick={() => savePrefs()} disabled={busy !== null} className={successButton}>
          <Save size={13} /> {busy === 'prefs' ? 'Saving...' : 'Save preferences'}
        </button>
      </section>

      {notice && <p className="font-mono text-[11px] text-[#43d18b]">{notice}</p>}
      {error && <p className="font-mono text-[11px] text-[#ff6b6b]">{error}</p>}
    </div>
  );
}
