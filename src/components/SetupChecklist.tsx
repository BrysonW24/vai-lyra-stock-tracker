'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, BriefcaseBusiness, Check, ChevronRight, Compass, Star, X } from 'lucide-react';
import type { SetupStatus } from '@/lib/setup-status';

/**
 * In-app "Get started" checklist (Vercel-style). Each step reflects real per-user DB
 * state from getSetupStatus(). Completed steps are ticked; the rest deep-link to the
 * page where the user finishes them. Hidden in demo/logged-out mode and once complete.
 */
const DISMISS_KEY = 'lyra.setupChecklistDismissed';

type IconType = typeof Compass;

interface Step {
  key: string;
  label: string;
  hint: string;
  href: string;
  icon: IconType;
  done: boolean;
}

export function SetupChecklist({ status }: { status: SetupStatus }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === 'true');
    } catch {
      /* ignore */
    }
  }, []);

  const steps: Step[] = [
    { key: 'profile', label: 'Complete your profile', hint: 'Tailor Lyra to how you invest', href: '/onboarding', icon: Compass, done: status.profileComplete },
    { key: 'portfolio', label: 'Add your portfolio', hint: 'Make the signals about what you own', href: '/portfolio', icon: BriefcaseBusiness, done: status.hasPortfolio },
    { key: 'watchlist', label: 'Create a watchlist', hint: 'Track setups you want to catch', href: '/watchlist', icon: Star, done: status.hasWatchlist },
    { key: 'notifications', label: 'Set up notifications', hint: 'Get alerts on Telegram or WhatsApp', href: '/account', icon: Bell, done: status.hasNotifications },
  ];

  const completed = steps.filter((step) => step.done).length;
  const allDone = completed === steps.length;

  if (!status.signedIn || dismissed || allDone) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center justify-between gap-3 border-b border-[#1b2530] px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Get started</p>
          <span className="rounded-full border border-[#263241] bg-[#0d141c] px-2 py-0.5 font-mono text-[11px] text-[#a8b5c2]">
            {completed}/{steps.length}
          </span>
        </div>
        <button
          onClick={dismiss}
          type="button"
          aria-label="Dismiss setup checklist"
          className="grid h-7 w-7 place-items-center rounded text-[#8190a0] transition hover:text-[#eef3f8]"
        >
          <X size={15} />
        </button>
      </div>

      <div className="divide-y divide-[#141c25]">
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className={`flex items-center gap-3 px-4 py-3 transition ${
              step.done ? 'bg-[#0c130d]' : 'hover:bg-[#101720]'
            }`}
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${
                step.done
                  ? 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]'
                  : 'border-[#263241] bg-[#0d141c] text-[#f3a33a]'
              }`}
            >
              {step.done ? <Check size={16} /> : <step.icon size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-medium ${step.done ? 'text-[#6f7d8a] line-through' : 'text-[#eef3f8]'}`}>
                {step.label}
              </span>
              {!step.done && <span className="block truncate text-[11px] text-[#8190a0]">{step.hint}</span>}
            </span>
            {!step.done && <ChevronRight size={16} className="shrink-0 text-[#5e6b78]" />}
          </Link>
        ))}
      </div>
    </section>
  );
}
