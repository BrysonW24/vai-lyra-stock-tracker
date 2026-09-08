'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import type { SetupStatus } from '@/lib/setup-status';
import { loadLocalHoldings, PORTFOLIO_CHANGED_EVENT } from '@/lib/local-portfolio';
import { loadLocalWatchlist, WATCHLIST_CHANGED_EVENT } from '@/lib/local-watchlist';

/**
 * Progressive setup - onboarding AFTER the look around, not before it.
 *
 * The old flow front-loaded ten beats before the app unlocked. The founder's call
 * (2026-09-09): "we don't necessarily have to front load everything... offer the option
 * to do it once they've had a look around". The beats themselves stay exactly as they
 * are - they are good - but they become resumable rows here, each deep-linking into its
 * own beat and returning home.
 *
 * Truth comes from getSetupStatus() (real per-user DB state), with Solo's browser-local
 * book layered on top: Solo has no Supabase, so the server read is empty there and a
 * Solo user who HAS added holdings must still see that row ticked.
 */

export function SimpleSetup({ status }: { status: SetupStatus }) {
  const [local, setLocal] = useState<{ holdings: number; watch: number } | null>(null);
  useEffect(() => {
    const sync = () =>
      setLocal({ holdings: loadLocalHoldings().length, watch: loadLocalWatchlist().length });
    sync();
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, sync);
    window.addEventListener(WATCHLIST_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(PORTFOLIO_CHANGED_EVENT, sync);
      window.removeEventListener(WATCHLIST_CHANGED_EVENT, sync);
    };
  }, []);

  const items = [
    {
      id: 'holdings',
      label: 'Add what you own',
      why: 'Lyra reads your actual positions instead of guessing.',
      href: '/onboarding?beat=holdings',
      done: status.hasPortfolio || (local?.holdings ?? 0) > 0,
    },
    {
      id: 'watchlist',
      label: 'Add names to watch',
      why: 'You get told when one of them sets up.',
      href: '/onboarding?beat=watchlist',
      done: status.hasWatchlist || (local?.watch ?? 0) > 0,
    },
    {
      id: 'profile',
      label: 'Set your goal and risk',
      why: 'Tunes every read to the way you actually invest.',
      href: '/onboarding?beat=profile',
      done: status.profileComplete,
    },
    {
      id: 'alerts',
      label: 'Turn on alerts',
      why: 'Nothing worth acting on waits for you to open the app.',
      href: '/account/notifications',
      done: status.hasNotifications,
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  // Fully set up: the block disappears rather than lingering as a green wall.
  if (doneCount === items.length) return null;
  const next = items.find((i) => !i.done);

  return (
    <section className="overflow-hidden rounded-panel border border-accent-border/50 bg-accent-tint/40">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-3">
        <h2 className="text-[15px] font-semibold text-ink-title">Finish setting up</h2>
        <span className="font-mono text-[11px] tabular-nums text-ink-3">
          {doneCount} of {items.length} done
        </span>
      </div>
      <p className="px-4 pt-1 text-[12px] leading-relaxed text-ink-2">
        Have a look around first - none of this is required. Each one takes about a minute and makes
        every read yours.
      </p>

      <ul className="mt-3 divide-y divide-line/70 border-t border-line/70">
        {items.map((item) => (
          <li key={item.id}>
            {item.done ? (
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-positive/50 bg-positive-tint text-positive">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="text-[13px] text-ink-3 line-through decoration-ink-dim/60">{item.label}</span>
              </div>
            ) : (
              <Link href={item.href} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-panel/60">
                <span className="h-5 w-5 shrink-0 rounded-full border border-line-strong bg-panel" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink-title">{item.label}</span>
                  <span className="block text-[11px] leading-snug text-ink-3">{item.why}</span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-ink-dim" />
              </Link>
            )}
          </li>
        ))}
      </ul>

      {next && (
        <div className="border-t border-line/70 px-4 py-3">
          <Link
            href={next.href}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-cell border border-accent-border bg-accent-tint px-4 text-[13px] font-semibold text-accent transition hover:brightness-110"
          >
            {next.label} <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}
