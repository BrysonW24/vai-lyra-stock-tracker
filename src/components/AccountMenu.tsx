'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
import { loadProfile } from '@/lib/account';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Header account button: the user's emoji avatar + a dropdown (name, settings,
 * sign out). The avatar/name come from the local profile and double as the
 * identity hook for personalised greetings/AI ("Morning, {name}").
 */
export function AccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('📈');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const read = () => {
      const profile = loadProfile();
      setName(profile.displayName);
      setAvatar(profile.avatarEmoji || '📈');
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
        <div role="menu" className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-md border border-[#263241] bg-[#0d1117] shadow-2xl">
          <div className="flex items-center gap-2.5 border-b border-[#1b2530] px-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#263241] bg-[#0d141c] text-lg" aria-hidden>
              {avatar}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#eef3f8]">{label}</p>
              <p className="text-[11px] text-[#8190a0]">{isSupabaseConfigured() ? 'Signed in' : 'Demo mode'}</p>
            </div>
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
