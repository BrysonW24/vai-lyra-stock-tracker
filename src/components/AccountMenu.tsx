'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
import { loadProfile } from '@/lib/account';
import {
  ALERT_FREQ,
  ALERT_MODES,
  useAlertPrefs,
  type AlertFrequency,
  type AlertScope,
} from '@/lib/alert-prefs';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Header account button: the user's emoji avatar + a dropdown (alert mode, name, settings,
 * sign out). Alert mode lives here - colour-coded - so it is actually discovered, instead
 * of competing with the Live Wire bell in the top bar.
 */
export function AccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦎');
  const ref = useRef<HTMLDivElement | null>(null);

  const { prefs, update, tempMuted, muteFor } = useAlertPrefs();
  const activeMode = tempMuted ? 'muted' : prefs.mode;

  useEffect(() => {
    const read = () => {
      const profile = loadProfile();
      setName(profile.displayName);
      setAvatar(profile.avatarEmoji || '🦎');
    };
    read();
    // Reflect edits made on the settings page (incl. other tabs).
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/welcome');
      router.refresh();
    }
    setOpen(false);
  }

  const label = name.trim() || 'Your account';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid h-9 w-9 place-items-center rounded-full border border-[#263241] bg-[#0d141c] text-lg leading-none transition hover:border-[#f3a33a]/60"
      >
        <span aria-hidden>{avatar}</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 max-h-[82vh] w-64 overflow-y-auto rounded-md border border-[#263241] bg-[#0d1117] shadow-2xl">
          <div className="flex items-center gap-2.5 border-b border-[#1b2530] px-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#263241] bg-[#0d141c] text-lg" aria-hidden>
              {avatar}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#eef3f8]">{label}</p>
              <p className="text-[11px] text-[#8190a0]">{isSupabaseConfigured() ? 'Signed in' : 'Demo mode'}</p>
            </div>
          </div>

          {/* Alert mode - colour-coded, lives here so it is actually discovered */}
          <div className="border-b border-[#1b2530] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Alert mode</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              {ALERT_MODES.map((m) => {
                const active = activeMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    title={m.hint}
                    onClick={() => update({ mode: m.value, mutedUntil: m.value === 'muted' ? prefs.mutedUntil : null })}
                    className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-xs transition ${
                      active ? m.tone : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#3a4754]'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.dot }} />
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {([['15m', 15 * 60000], ['1h', 60 * 60000], ['4h', 240 * 60000]] as const).map(([lbl, ms]) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => muteFor(ms)}
                  className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[10px] text-[#a8b5c2] transition hover:text-[#eef3f8]"
                >
                  Mute {lbl}
                </button>
              ))}
              {tempMuted && (
                <button
                  type="button"
                  onClick={() => update({ mutedUntil: null })}
                  className="rounded border border-[#1d7f55] bg-[#0d251b] px-1.5 py-0.5 font-mono text-[10px] text-[#43d18b]"
                >
                  Unmute
                </button>
              )}
            </div>

            {/* Advanced controls appear only for Custom, matching its hint */}
            {prefs.mode === 'custom' && (
              <div className="mt-2 space-y-1.5">
                <select
                  value={prefs.frequency}
                  onChange={(e) => update({ frequency: e.target.value as AlertFrequency })}
                  className="w-full rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[11px] text-[#dbe5ee] outline-none"
                >
                  {ALERT_FREQ.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <select
                  value={prefs.scope}
                  onChange={(e) => update({ scope: e.target.value as AlertScope })}
                  className="w-full rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[11px] text-[#dbe5ee] outline-none"
                >
                  <option value="all">All signals</option>
                  <option value="portfolio">Portfolio only</option>
                  <option value="watchlist">Watchlist only</option>
                </select>
                <label className="flex items-center justify-between rounded border border-[#263241] bg-[#0d141c] px-2 py-1 text-[11px] text-[#a8b5c2]">
                  Quiet hours
                  <input type="checkbox" checked={prefs.quietHoursEnabled} onChange={(e) => update({ quietHoursEnabled: e.target.checked })} />
                </label>
                {prefs.quietHoursEnabled && (
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#dbe5ee]">
                    <input type="time" value={prefs.quietStart} onChange={(e) => update({ quietStart: e.target.value })} className="flex-1 rounded border border-[#263241] bg-[#080a0d] px-1.5 py-0.5 outline-none" />
                    <span className="text-[#8190a0]">to</span>
                    <input type="time" value={prefs.quietEnd} onChange={(e) => update({ quietEnd: e.target.value })} className="flex-1 rounded border border-[#263241] bg-[#080a0d] px-1.5 py-0.5 outline-none" />
                  </div>
                )}
              </div>
            )}
          </div>

          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-[#cdd8e3] transition hover:bg-[#101720]"
          >
            <Settings size={15} className="text-[#8190a0]" /> Account &amp; settings
          </Link>
          {isSupabaseConfigured() && (
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-2 border-t border-[#1b2530] px-3 py-2.5 text-left text-sm text-[#f0758a] transition hover:bg-[#1a1012]"
            >
              <LogOut size={15} /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
