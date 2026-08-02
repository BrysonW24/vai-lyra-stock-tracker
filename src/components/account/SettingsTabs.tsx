'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellRing, BookOpen, BrainCircuit, UserRound } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';

/** The settings families, each its own page instead of one long scroll. */
const TABS = [
  { href: '/account', label: 'Account', icon: UserRound },
  { href: '/account/ai', label: 'AI Settings', icon: BrainCircuit },
  { href: '/account/notifications', label: 'Notifications', icon: BellRing },
  { href: '/account/how-it-works', label: 'How it works', icon: BookOpen },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();
  const soloMode = !isSupabaseConfigured();
  return (
    <nav className="grid grid-cols-2 gap-1 rounded-cell border border-line bg-chrome p-1 sm:grid-cols-4">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[12px] font-semibold transition ${
              active
                ? 'border border-accent-border bg-accent-tint text-accent'
                : 'border border-transparent text-ink-3 hover:text-ink-title'
            }`}
          >
            <Icon size={14} className="shrink-0" />
            <span className="truncate">
              {soloMode && href === '/account' ? 'Settings' : label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
