'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

/**
 * Top-bar alert control - one-tap mute, mode, frequency, quiet hours and scope.
 * Preferences persist to localStorage (demo-safe). Live enforcement is applied
 * by the backend alert engine; this is the operator-facing control surface.
 */

type Mode = 'live' | 'quiet' | 'muted' | 'custom';
type Frequency = '30m' | '1h' | '2h' | '4h' | 'digest';
type Scope = 'all' | 'portfolio' | 'watchlist';

interface AlertPrefs {
  mode: Mode;
  frequency: Frequency;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  scope: Scope;
  mutedUntil: number | null;
}

const DEFAULTS: AlertPrefs = {
  mode: 'live',
  frequency: '1h',
  quietHoursEnabled: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  scope: 'all',
  mutedUntil: null,
};

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'live', label: 'Live', hint: 'Alert as setups change (respecting cooldown)' },
  { value: 'quiet', label: 'Quiet', hint: 'Only portfolio risk & strong setups' },
  { value: 'muted', label: 'Muted', hint: 'No alerts until you turn them back on' },
  { value: 'custom', label: 'Custom', hint: 'Use the frequency, hours & scope below' },
];

const FREQ: { value: Frequency; label: string }[] = [
  { value: '30m', label: 'Every 30 min' },
  { value: '1h', label: 'Every 1 hour' },
  { value: '2h', label: 'Every 2 hours' },
  { value: '4h', label: 'Every 4 hours' },
  { value: 'digest', label: 'Daily digest only' },
];

function load(): AlertPrefs {
  try {
    const raw = window.localStorage.getItem('lyra.alertPrefs');
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AlertPrefs>) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

export function AlertControl() {
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULTS);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => setPrefs(load()), []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const update = (patch: Partial<AlertPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem('lyra.alertPrefs', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const tempMuted = prefs.mutedUntil !== null && prefs.mutedUntil > now;
  const isMuted = prefs.mode === 'muted' || tempMuted;

  const muteFor = (ms: number | 'tomorrow') => {
    if (ms === 'tomorrow') {
      const d = new Date();
      d.setHours(24, 0, 0, 0);
      update({ mutedUntil: d.getTime() });
    } else {
      update({ mutedUntil: now + ms });
    }
  };

  const label = isMuted
    ? tempMuted
      ? `Muted ${Math.max(1, Math.round((prefs.mutedUntil! - now) / 60000))}m`
      : 'Muted'
    : prefs.mode.charAt(0).toUpperCase() + prefs.mode.slice(1);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={!isMuted && !open ? { animation: 'badgePulse 2.2s ease-in-out infinite' } : undefined}
        className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-xs transition ${
          isMuted
            ? 'border-[#7f1d1d] bg-[#2b1214] text-[#ff6b6b]'
            : 'border-[#1d4f3a] bg-[#0d251b] text-[#43d18b]'
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {isMuted ? <BellOff size={13} /> : <Bell size={13} />}
        {label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 w-72 rounded-lg border border-[#2c3a4a] bg-[#0d1117] p-3 shadow-2xl ring-1 ring-black/50">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Alert mode</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  title={m.hint}
                  onClick={() => update({ mode: m.value, mutedUntil: m.value === 'muted' ? prefs.mutedUntil : null })}
                  className={`rounded border px-2 py-1.5 text-xs transition ${
                    prefs.mode === m.value && !tempMuted
                      ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
                      : 'border-[#263241] bg-[#0d141c] text-[#dbe5ee] hover:border-[#3a4754]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Quick mute</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {([['15m', 15 * 60000], ['1h', 60 * 60000], ['4h', 240 * 60000]] as const).map(([lbl, ms]) => (
                <button key={lbl} type="button" onClick={() => muteFor(ms)} className="rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[11px] text-[#a8b5c2] transition hover:text-[#eef3f8]">
                  Mute {lbl}
                </button>
              ))}
              <button type="button" onClick={() => muteFor('tomorrow')} className="rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[11px] text-[#a8b5c2] transition hover:text-[#eef3f8]">
                Until tomorrow
              </button>
              {tempMuted && (
                <button type="button" onClick={() => update({ mutedUntil: null })} className="rounded border border-[#1d7f55] bg-[#0d251b] px-2 py-1 font-mono text-[11px] text-[#43d18b]">
                  Unmute
                </button>
              )}
            </div>

            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Frequency</label>
            <select
              value={prefs.frequency}
              onChange={(e) => update({ frequency: e.target.value as Frequency })}
              className="mt-1 w-full rounded border border-[#263241] bg-[#0d141c] px-2 py-1.5 font-mono text-xs text-[#dbe5ee] outline-none"
            >
              {FREQ.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>

            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Scope</label>
            <select
              value={prefs.scope}
              onChange={(e) => update({ scope: e.target.value as Scope })}
              className="mt-1 w-full rounded border border-[#263241] bg-[#0d141c] px-2 py-1.5 font-mono text-xs text-[#dbe5ee] outline-none"
            >
              <option value="all">All signals</option>
              <option value="portfolio">Portfolio only</option>
              <option value="watchlist">Watchlist only</option>
            </select>

            <label className="mt-3 flex items-center justify-between rounded border border-[#263241] bg-[#0d141c] px-2 py-1.5 text-xs text-[#a8b5c2]">
              Quiet hours
              <input type="checkbox" checked={prefs.quietHoursEnabled} onChange={(e) => update({ quietHoursEnabled: e.target.checked })} />
            </label>
            {prefs.quietHoursEnabled && (
              <div className="mt-1.5 flex items-center gap-2 font-mono text-xs text-[#dbe5ee]">
                <input type="time" value={prefs.quietStart} onChange={(e) => update({ quietStart: e.target.value })} className="flex-1 rounded border border-[#263241] bg-[#080a0d] px-2 py-1 outline-none" />
                <span className="text-[#8190a0]">to</span>
                <input type="time" value={prefs.quietEnd} onChange={(e) => update({ quietEnd: e.target.value })} className="flex-1 rounded border border-[#263241] bg-[#080a0d] px-2 py-1 outline-none" />
              </div>
            )}

            <p className="mt-3 text-[10px] leading-4 text-[#8190a0]">
              Saved to this device. Live delivery (Telegram) honours these once alerts are connected.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
