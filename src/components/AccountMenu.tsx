'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellRing, BrainCircuit, LogOut, Settings } from 'lucide-react';
import { loadProfile } from '@/lib/account';
import { ALERT_MODES, useAlertPrefs } from '@/lib/alert-prefs';
import { OPEN_ACCOUNT_MENU_EVENT } from '@/components/AlertStatusBadge';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { APP_VERSION, APP_VERSION_DATE, formatVersionDate } from '@/lib/version';

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

  // Open the menu when the header alert badge is tapped (jumps to the mode controls).
  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener(OPEN_ACCOUNT_MENU_EVENT, openMenu);
    return () => window.removeEventListener(OPEN_ACCOUNT_MENU_EVENT, openMenu);
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

  const soloMode = !isSupabaseConfigured();
  const label = name.trim() || (soloMode ? 'Your console' : 'Your account');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-panel text-lg leading-none transition hover:border-accent/60"
      >
        <span aria-hidden>{avatar}</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 max-h-[82vh] w-64 overflow-y-auto rounded-cell border border-line-strong bg-panel-deep shadow-2xl">
          <div className="flex items-center gap-2.5 border-b border-line px-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong bg-panel text-lg" aria-hidden>
              {avatar}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{label}</p>
              <p className="text-[11px] text-ink-3">{soloMode ? 'Solo · this device' : 'Signed in'}</p>
            </div>
          </div>

          {/* Alert mode - colour-coded, lives here so it is actually discovered */}
          {!soloMode && (
          <div className="border-b border-line px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Alert mode</p>
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
                      active ? m.tone : 'border-line-strong bg-panel text-ink-2 hover:border-line-hair'
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
                  className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[10px] text-ink-2 transition hover:text-ink"
                >
                  Mute {lbl}
                </button>
              ))}
              {tempMuted && (
                <button
                  type="button"
                  onClick={() => update({ mutedUntil: null })}
                  className="rounded border border-positive/50 bg-positive-tint px-1.5 py-0.5 font-mono text-[10px] text-positive"
                >
                  Unmute
                </button>
              )}
            </div>

            {/* Custom reveals quiet hours - the one advanced control the dispatch router actually
                enforces (quiet_start/quiet_end sync to the server via useAlertPrefs.update). The old
                frequency + scope dropdowns were removed: the router has no concept of either, so
                they were dead controls (2026-07-27 audit V6). */}
            {prefs.mode === 'custom' && (
              <div className="mt-2 space-y-1.5">
                <label className="flex items-center justify-between rounded border border-line-strong bg-panel px-2 py-1 text-[11px] text-ink-2">
                  Quiet hours
                  <input type="checkbox" checked={prefs.quietHoursEnabled} onChange={(e) => update({ quietHoursEnabled: e.target.checked })} />
                </label>
                {prefs.quietHoursEnabled && (
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-title">
                    <input type="time" value={prefs.quietStart} onChange={(e) => update({ quietStart: e.target.value })} className="flex-1 rounded border border-line-strong bg-well px-1.5 py-0.5 outline-none" />
                    <span className="text-ink-3">to</span>
                    <input type="time" value={prefs.quietEnd} onChange={(e) => update({ quietEnd: e.target.value })} className="flex-1 rounded border border-line-strong bg-well px-1.5 py-0.5 outline-none" />
                  </div>
                )}
                <p className="text-[10px] leading-snug text-ink-dim">
                  Quiet hours pause non-urgent alerts on your account; they release after the window.
                </p>
              </div>
            )}
          </div>
          )}

          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-ink-2 transition hover:bg-panel hover:text-ink"
          >
            <Settings size={15} className="text-ink-3" /> {soloMode ? 'Settings' : 'Account'}
          </Link>
          <Link
            href="/account/notifications"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-line px-3 py-2.5 text-sm text-ink-2 transition hover:bg-panel hover:text-ink"
          >
            <BellRing size={15} className="text-ink-3" /> {soloMode ? 'Notification limits' : 'Notifications'}
          </Link>
          <Link
            href="/account/ai"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-line px-3 py-2.5 text-sm text-ink-2 transition hover:bg-panel hover:text-ink"
          >
            <BrainCircuit size={15} className="text-ink-3" /> AI Settings
          </Link>
          {isSupabaseConfigured() && (
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-sm text-negative-soft transition hover:bg-negative/10"
            >
              <LogOut size={15} /> Sign out
            </button>
          )}

          <Link
            href="/whats-new"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5 text-[11px] text-ink-dim transition hover:bg-panel hover:text-ink-2"
          >
            <span>What&apos;s new</span>
            <span className="font-mono">
              v{APP_VERSION} <span className="opacity-60">· {formatVersionDate(APP_VERSION_DATE)}</span>
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
