'use client';

import type { ReactNode } from 'react';
import { AlertPreferences } from '@/lib/onboarding';
import { Toggle } from '@/components/Toggle';
import { BellRing } from 'lucide-react';
import { faviconUrl } from '@/lib/ticker-logos';

interface AlertPreferencePanelProps {
  alerts: AlertPreferences;
  onChange: (alerts: AlertPreferences) => void;
  onNext: () => void;
}

const ALERT_TYPES: { key: keyof AlertPreferences; label: string }[] = [
  { key: 'strongSetupAlerts', label: 'Strong setups' },
  { key: 'portfolioRiskAlerts', label: 'Portfolio risk' },
  { key: 'watchlistTriggerAlerts', label: 'Watchlist triggers' },
  { key: 'signalInvalidationAlerts', label: 'Signal invalidations' },
  { key: 'dailyDigest', label: 'Daily digest' },
  { key: 'hourlyDigest', label: 'Hourly digest' },
];

function ChannelCard({ logo, name, status, on }: { logo: ReactNode; name: string; status: string; on?: boolean }) {
  return (
    <div
      className={`relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border p-2 text-center ${
        on ? 'border-[#43d18b]/40 bg-[#43d18b]/[0.07]' : 'border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01]'
      }`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/10 backdrop-blur">{logo}</span>
      <span className="text-[11px] font-semibold leading-none text-[#eef3f8]">{name}</span>
      <span className={`text-[8px] font-semibold uppercase tracking-[0.1em] ${on ? 'text-[#43d18b]' : 'text-[#8190a0]'}`}>{status}</span>
    </div>
  );
}

export function AlertPreferencePanel({ alerts, onChange, onNext }: AlertPreferencePanelProps) {
  const handleToggle = (key: keyof AlertPreferences, value: boolean) => onChange({ ...alerts, [key]: value });

  return (
    <div className="space-y-3">
      {/* Delivery channels - push-first; Telegram + WhatsApp are extras */}
      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">How you&apos;ll be alerted</h3>
        <div className="grid grid-cols-3 gap-2">
          <ChannelCard on name="In-app" status="On" logo={<BellRing size={15} className="text-[#43d18b]" />} />
          <ChannelCard
            name="Telegram"
            status="Soon"
            logo={
              // eslint-disable-next-line @next/next/no-img-element
              <img src={faviconUrl('telegram.org', 16)} alt="Telegram" width={16} height={16} className="rounded" />
            }
          />
          <ChannelCard
            name="WhatsApp"
            status="Soon"
            logo={
              // eslint-disable-next-line @next/next/no-img-element
              <img src={faviconUrl('whatsapp.com', 16)} alt="WhatsApp" width={16} height={16} className="rounded" />
            }
          />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[#5d6b79]">
          Push lands right on your phone - add Lyra to your home screen. Telegram &amp; WhatsApp soon.
        </p>
      </div>

      {/* What to alert about - compact single-line rows with real iOS toggles */}
      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">What to alert me about</h3>
        <div className="divide-y divide-[#1b2530] overflow-hidden rounded-md border border-[#263241] bg-[#0d141c]">
          {ALERT_TYPES.map(({ key, label }) => (
            <div key={key}>
              <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="text-[13px] font-medium text-[#eef3f8]">{label}</span>
                <Toggle checked={Boolean(alerts[key])} onChange={(v) => handleToggle(key, v)} label={label} />
              </div>
              {key === 'dailyDigest' && alerts.dailyDigest && (
                <div className="flex items-center justify-between gap-3 bg-[#0b1119] px-3 py-1.5 pl-6">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">Delivered at</span>
                  <input
                    type="time"
                    value={alerts.digestTime || '08:00'}
                    onChange={(e) => onChange({ ...alerts, digestTime: e.target.value })}
                    aria-label="Daily digest delivery time"
                    className="h-7 rounded border border-[#263241] bg-[#0d141c] px-2 text-[13px] text-[#dbe5ee] outline-none focus:border-[#f3a33a]/50"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[#5d6b79]">
          Setups, risk, triggers &amp; invalidations fire in real time. Hourly digest is hourly; daily at your chosen time.
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full rounded-md bg-gradient-to-r from-[#3b5bdb] via-[#43d18b] to-[#f3a33a] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#07090c] shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
      >
        Continue
      </button>
    </div>
  );
}
