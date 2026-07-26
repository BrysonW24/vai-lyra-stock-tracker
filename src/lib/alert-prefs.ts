'use client';

import { useEffect, useState } from 'react';

/**
 * Alert preferences - the operator-facing alert mode + frequency + quiet hours + scope.
 * Persisted to localStorage (demo-safe) and shared across the header status badge and the
 * account-menu controls via a same-tab custom event, so changing the mode in one place
 * updates the other instantly.
 *
 * Mutes are ENFORCED SERVER-SIDE: any change to mode / mutedUntil also PATCHes
 * /api/notifications (user_alert_preferences.mute_all / muted_until), which the dispatch
 * router reads before any channel sends. localStorage remains the optimistic cache; for a
 * signed-out/demo session the PATCH 401s harmlessly and the badge is the whole story.
 * Before this sync existed the "Muted" badge was localStorage-only and every channel kept
 * sending - a visible control that silently did nothing.
 */

export type AlertMode = 'live' | 'quiet' | 'muted' | 'custom';
export type AlertFrequency = '30m' | '1h' | '2h' | '4h' | 'digest';
export type AlertScope = 'all' | 'portfolio' | 'watchlist';

export interface AlertPrefs {
  mode: AlertMode;
  frequency: AlertFrequency;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  scope: AlertScope;
  mutedUntil: number | null;
}

export const ALERT_DEFAULTS: AlertPrefs = {
  mode: 'live',
  frequency: '1h',
  quietHoursEnabled: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  scope: 'all',
  mutedUntil: null,
};

/** Each mode carries its own colour - Live green, Quiet blue, Muted red, Custom purple. */
export const ALERT_MODES: { value: AlertMode; label: string; hint: string; dot: string; tone: string }[] = [
  { value: 'live', label: 'Live', hint: 'Alert as setups change (respecting cooldown)', dot: '#43d18b', tone: 'border-[#1d4f3a] bg-[#0d251b] text-[#43d18b]' },
  { value: 'quiet', label: 'Quiet', hint: 'Only portfolio risk & strong setups', dot: '#60a5fa', tone: 'border-[#2a4a7a] bg-[#0f1a2c] text-[#7fb0ff]' },
  { value: 'muted', label: 'Muted', hint: 'No alerts until you turn them back on', dot: '#f0758a', tone: 'border-[#7a2630] bg-[#260f12] text-[#f0758a]' },
  { value: 'custom', label: 'Custom', hint: 'Use the frequency, hours & scope below', dot: '#a78bfa', tone: 'border-[#4c3a7a] bg-[#170f29] text-[#a78bfa]' },
];

export const ALERT_FREQ: { value: AlertFrequency; label: string }[] = [
  { value: '30m', label: 'Every 30 min' },
  { value: '1h', label: 'Every 1 hour' },
  { value: '2h', label: 'Every 2 hours' },
  { value: '4h', label: 'Every 4 hours' },
  { value: 'digest', label: 'Daily digest only' },
];

const KEY = 'lyra.alertPrefs';
const EVENT = 'lyra:alertprefs';

export function loadAlertPrefs(): AlertPrefs {
  if (typeof window === 'undefined') return ALERT_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...ALERT_DEFAULTS, ...(JSON.parse(raw) as Partial<AlertPrefs>) };
  } catch {
    /* ignore */
  }
  return ALERT_DEFAULTS;
}

/**
 * Commit a prefs patch outside React (onboarding finish seeds the demo prefs this way -
 * previously onboarding alert choices went nowhere in demo mode). Read-modify-write against
 * storage so other listeners see the committed value; returns the committed prefs.
 */
function commitAlertPrefs(patch: Partial<AlertPrefs>): { prefs: AlertPrefs; storageOk: boolean } {
  const next = { ...loadAlertPrefs(), ...patch };
  let storageOk = false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    storageOk = true;
  } catch {
    /* reported to callers that need a verified local commit */
  }
  if (storageOk) window.dispatchEvent(new Event(EVENT));
  // Server sync for the mute half - the part the dispatch router actually enforces. Only fires
  // when the patch touches mute state; fire-and-forget (a 401 in demo/signed-out is expected).
  if ('mode' in patch || 'mutedUntil' in patch) {
    try {
      void fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            muteAll: next.mode === 'muted',
            // The router enforces quiet/muted server-side (alert_mode column) - Live/Custom
            // change nothing there, but syncing the mode keeps the account's truth current.
            alertMode: next.mode,
            mutedUntil: next.mutedUntil !== null ? new Date(next.mutedUntil).toISOString() : null,
          },
        }),
      }).catch(() => {});
    } catch {
      /* never let a sync failure break the local save */
    }
  }
  return { prefs: next, storageOk };
}

export function saveAlertPrefs(patch: Partial<AlertPrefs>): AlertPrefs {
  return commitAlertPrefs(patch).prefs;
}

/** Onboarding uses this stricter variant so Solo never claims completion after a rejected write. */
export function saveAlertPrefsWithStatus(patch: Partial<AlertPrefs>): boolean {
  return commitAlertPrefs(patch).storageOk;
}

/** Shared alert-prefs state: read, update, and the derived status used by the header badge. */
export function useAlertPrefs() {
  const [prefs, setPrefs] = useState<AlertPrefs>(ALERT_DEFAULTS);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const read = () => setPrefs(loadAlertPrefs());
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const update = (patch: Partial<AlertPrefs>) => {
    setPrefs(saveAlertPrefs(patch));
  };

  const tempMuted = prefs.mutedUntil !== null && prefs.mutedUntil > now;
  const isMuted = prefs.mode === 'muted' || tempMuted;
  const activeMode: AlertMode = tempMuted ? 'muted' : prefs.mode;

  const muteFor = (ms: number | 'tomorrow') => {
    if (ms === 'tomorrow') {
      const d = new Date();
      d.setHours(24, 0, 0, 0);
      update({ mutedUntil: d.getTime() });
    } else {
      update({ mutedUntil: now + ms });
    }
  };

  const statusLabel = isMuted
    ? tempMuted
      ? `Muted ${Math.max(1, Math.round((prefs.mutedUntil! - now) / 60000))}m`
      : 'Muted'
    : prefs.mode.charAt(0).toUpperCase() + prefs.mode.slice(1);

  return { prefs, update, now, tempMuted, isMuted, activeMode, muteFor, statusLabel };
}
