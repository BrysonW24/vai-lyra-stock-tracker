'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertPreferences } from '@/lib/onboarding';
import { Toggle } from '@/components/Toggle';
import { BellRing, Smartphone } from 'lucide-react';
import { faviconUrl } from '@/lib/ticker-logos';
import { getPushSupportStatus, subscribeToPush } from '@/lib/push/client';
import { useIsNativeShell } from '@/lib/native/platform';
import { isSupabaseConfigured } from '@/lib/supabase/client';

interface AlertPreferencePanelProps {
  alerts: AlertPreferences;
  onChange: (alerts: AlertPreferences) => void;
  onNext: () => void;
}

type AlertToggleKey =
  | 'pushEnabled'
  | 'strongSetupAlerts'
  | 'portfolioRiskAlerts'
  | 'watchlistTriggerAlerts'
  | 'watchlistMovementAlerts'
  | 'portfolioMovementAlerts'
  | 'signalInvalidationAlerts'
  | 'paperBotAlerts'
  | 'orderApprovalAlerts'
  | 'themeAlerts'
  | 'macroAlerts'
  | 'dailyDigest'
  | 'hourlyDigest';

const ALERT_TYPES: { key: AlertToggleKey; label: string }[] = [
  { key: 'pushEnabled', label: 'iPhone push alerts' },
  { key: 'strongSetupAlerts', label: 'Strong setups' },
  { key: 'portfolioRiskAlerts', label: 'Portfolio risk' },
  { key: 'watchlistTriggerAlerts', label: 'Watchlist triggers' },
  { key: 'watchlistMovementAlerts', label: 'Watchlist +/- moves' },
  { key: 'portfolioMovementAlerts', label: 'Portfolio +/- moves' },
  { key: 'signalInvalidationAlerts', label: 'Signal invalidations' },
  { key: 'paperBotAlerts', label: 'Paper bot alerts' },
  { key: 'orderApprovalAlerts', label: 'Approval prompts' },
  { key: 'themeAlerts', label: 'Theme alerts' },
  { key: 'macroAlerts', label: 'Macro alerts' },
  { key: 'dailyDigest', label: 'Daily digest' },
  { key: 'hourlyDigest', label: 'Hourly digest' },
];

function ChannelCard({ logo, name, status, on }: { logo: ReactNode; name: string; status: string; on?: boolean }) {
  return (
    <div
      className={`relative flex flex-col items-center gap-1 overflow-hidden rounded-panel border p-2 text-center ${
        on ? 'border-positive/40 bg-positive-tint' : 'border-line bg-panel'
      }`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/25 to-transparent" />
      <span className="grid h-7 w-7 place-items-center rounded-cell border border-line bg-well">{logo}</span>
      <span className="text-[11px] font-semibold leading-none text-ink">{name}</span>
      <span className={`text-[8px] font-semibold uppercase tracking-[0.1em] ${on ? 'text-positive' : 'text-ink-3'}`}>{status}</span>
    </div>
  );
}

export function AlertPreferencePanel({ alerts, onChange, onNext }: AlertPreferencePanelProps) {
  const soloMode = !isSupabaseConfigured();
  const nativeShell = useIsNativeShell();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const didResetPush = useRef(false);

  // pushEnabled defaults to true in DEFAULT_ALERTS, but no browser subscription exists yet at the
  // start of this step - so the default lies. Reset it to false on first mount so the toggle and
  // the persisted value reflect reality; it only becomes true once a subscription actually
  // succeeds via enablePush below. Skip the reset if a subscription is already live (e.g. the user
  // resumed onboarding after enabling push).
  useEffect(() => {
    if (didResetPush.current) return;
    didResetPush.current = true;
    if (alerts.pushEnabled && getPushSupportStatus().permission !== 'granted') {
      onChange({ ...alerts, pushEnabled: false });
    }
  }, [alerts, onChange]);

  // Toggling push must register a REAL browser push subscription before we claim it is on -
  // a cosmetic flag would silently break the headline notification promise. We reuse the same
  // subscribe path the Settings panel uses (subscribeToPush + POST /api/push/subscribe) so the
  // two surfaces stay in lockstep. pushEnabled is only set true if a subscription succeeds.
  const enablePush = async () => {
    setPushBusy(true);
    setPushNote(null);
    try {
      const status = getPushSupportStatus();
      // iOS has no web push unless the app is installed to the Home Screen. Inside the native
      // shell web push never works (WKWebView) - point at the channels that do instead of
      // teaching an install the user does not need.
      if (!status.supported || !status.standalone) {
        setPushNote(
          nativeShell
            ? 'In-app push is coming to the Lyra app - Telegram alerts work today.'
            : 'Add Lyra to your Home Screen, then finish enabling push from Settings.'
        );
        return;
      }
      const subscription = await subscribeToPush();
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          platform: status.standalone ? 'pwa' : 'browser',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'Could not save push subscription.');
      }
      onChange({ ...alerts, pushEnabled: true });
      setPushNote('Push enabled on this device.');
    } catch (err) {
      setPushNote(err instanceof Error ? err.message : 'Could not enable push - finish from Settings later.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleToggle = (key: AlertToggleKey, value: boolean) => {
    // Push is special: turning it on must subscribe for real, not just flip a flag.
    if (key === 'pushEnabled') {
      if (value) {
        void enablePush();
      } else {
        setPushNote(null);
        onChange({ ...alerts, pushEnabled: false });
      }
      return;
    }
    onChange({ ...alerts, [key]: value });
  };

  if (soloMode) {
    return (
      <div className="space-y-3">
        <section className="rounded-cell border border-positive/30 bg-positive-tint p-4">
          <div className="flex items-start gap-2.5">
            <BellRing size={18} className="mt-0.5 shrink-0 text-positive" />
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Solo keeps notifications honest
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
                This accountless build does not send background push, Telegram,
                WhatsApp, or scheduled digests. Signal changes remain visible
                inside the console when you open it. The Community build adds
                account-backed delivery.
              </p>
              <p className="mt-2 text-[10px] text-ink-dim">
                No notification destination or personal identifier is collected
                in Solo.
              </p>
            </div>
          </div>
        </section>
        <button
          type="button"
          onClick={onNext}
          className="min-h-[44px] w-full rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
        >
          Continue without notifications
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Delivery channels - push-first; Telegram + WhatsApp are extras */}
      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">How you&apos;ll be alerted</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ChannelCard on name="In-app" status="On" logo={<BellRing size={15} className="text-positive" />} />
          <ChannelCard
            on={alerts.pushEnabled}
            name="Push"
            status={pushBusy ? 'Enabling' : alerts.pushEnabled ? 'On' : 'Off'}
            logo={<Smartphone size={15} className={alerts.pushEnabled ? 'text-positive' : 'text-ink-3'} />}
          />
          <ChannelCard
            name="Telegram"
            status="Settings"
            logo={
              // eslint-disable-next-line @next/next/no-img-element
              <img src={faviconUrl('telegram.org', 16)} alt="Telegram" width={16} height={16} className="rounded" />
            }
          />
          <ChannelCard
            name="WhatsApp"
            status="Settings"
            logo={
              // eslint-disable-next-line @next/next/no-img-element
              <img src={faviconUrl('whatsapp.com', 16)} alt="WhatsApp" width={16} height={16} className="rounded" />
            }
          />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-ink-dim">
          {nativeShell
            ? 'Telegram is the most reliable alert channel in the app today.'
            : 'Add Lyra to your home screen, then enable native push in Settings.'}
        </p>
        {pushNote && (
          <p className={`mt-1 text-[11px] leading-snug ${alerts.pushEnabled ? 'text-positive' : 'text-accent'}`}>
            {pushNote}
          </p>
        )}
      </div>

      {/* What to alert about - compact single-line rows with real iOS toggles */}
      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">What to alert me about</h3>
        <div className="divide-y divide-line overflow-hidden rounded-cell border border-line-strong bg-panel">
          <div className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span className="text-[13px] font-medium text-ink">Minimum signal score</span>
            <input
              type="number"
              min={0}
              max={100}
              value={alerts.minSignalScore ?? 75}
              onChange={(e) => onChange({ ...alerts, minSignalScore: Math.min(Math.max(Number(e.target.value), 0), 100) })}
              aria-label="Minimum signal score"
              className="h-7 w-20 rounded-cell border border-line-strong bg-well px-2 text-right font-mono text-[13px] tabular-nums text-ink-title outline-none focus:border-accent/50"
            />
          </div>
          {ALERT_TYPES.map(({ key, label }) => (
            <div key={key}>
              <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="text-[13px] font-medium text-ink">{label}</span>
                <Toggle
                  checked={Boolean(alerts[key])}
                  onChange={(v) => handleToggle(key, v)}
                  label={label}
                  disabled={key === 'pushEnabled' && pushBusy}
                />
              </div>
              {key === 'dailyDigest' && alerts.dailyDigest && (
                <div className="flex items-center justify-between gap-3 bg-well px-3 py-1.5 pl-6">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">Delivered at</span>
                  <input
                    type="time"
                    value={alerts.digestTime || '08:00'}
                    onChange={(e) => onChange({ ...alerts, digestTime: e.target.value })}
                    aria-label="Daily digest delivery time"
                    className="h-7 rounded-cell border border-line-strong bg-panel px-2 text-[13px] text-ink-title outline-none focus:border-accent/50"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-ink-dim">
          Setups, risk, triggers &amp; invalidations fire with each hourly scan. Hourly digest is hourly; daily at your chosen time.
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="min-h-[44px] w-full rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
      >
        Continue
      </button>
    </div>
  );
}
