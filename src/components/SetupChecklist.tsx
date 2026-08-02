'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Bot, BriefcaseBusiness, Check, ChevronDown, ChevronRight, Compass, Star, X } from 'lucide-react';
import type { SetupStatus } from '@/lib/setup-status';

/**
 * In-app "Getting started" checklist (Vercel-style). Each step reflects real per-user DB
 * state from getSetupStatus(). Completed steps are ticked; the rest deep-link to the
 * page where the user finishes them. Hidden in demo/logged-out mode and once complete.
 */
const DISMISS_KEY = 'lyra.setupChecklistDismissed';
const COLLAPSE_KEY = 'lyra.setupChecklistCollapsed';

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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === 'true');
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === 'true');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const steps: Step[] = [
    { key: 'profile', label: 'Complete your profile', hint: 'Tailor Lyra to how you invest', href: '/onboarding', icon: Compass, done: status.profileComplete },
    { key: 'portfolio', label: 'Add your portfolio', hint: 'Make the signals about what you own', href: '/portfolio', icon: BriefcaseBusiness, done: status.hasPortfolio },
    { key: 'watchlist', label: 'Create a watchlist', hint: 'Track setups you want to catch', href: '/watchlist', icon: Star, done: status.hasWatchlist },
    { key: 'notifications', label: 'Set up notifications', hint: 'Get alerts on Telegram or WhatsApp', href: '/account/notifications', icon: Bell, done: status.hasNotifications },
    { key: 'paper-bot', label: 'Try the Paper Bot', hint: 'Let the AI propose simulated trades for you', href: '/paper-bot', icon: Bot, done: status.hasPortfolio },
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
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={toggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand setup checklist' : 'Collapse setup checklist'}
          className="flex items-center gap-2 text-left"
        >
          <ChevronDown size={15} className={`text-ink-3 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Getting started</p>
          <span className="rounded-full border border-line-strong bg-panel px-2 py-0.5 font-mono text-[11px] text-ink-2">
            {completed}/{steps.length}
          </span>
        </button>
        <button
          onClick={dismiss}
          type="button"
          aria-label="Dismiss setup checklist"
          className="grid h-7 w-7 place-items-center rounded text-ink-3 transition hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>

      <div className={`divide-y divide-line/70 ${collapsed ? 'hidden' : ''}`}>
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className={`flex items-center gap-3 px-4 py-3 transition ${
              step.done ? 'bg-positive-tint/40' : 'hover:bg-line/30'
            }`}
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-cell border ${
                step.done
                  ? 'border-positive/50 bg-positive-tint text-positive'
                  : 'border-line-strong bg-panel text-accent'
              }`}
            >
              {step.done ? <Check size={16} /> : <step.icon size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-medium ${step.done ? 'text-ink-dim line-through' : 'text-ink'}`}>
                {step.label}
              </span>
              {!step.done && <span className="block truncate text-[11px] text-ink-3">{step.hint}</span>}
            </span>
            {!step.done && <ChevronRight size={16} className="shrink-0 text-ink-dim" />}
          </Link>
        ))}
      </div>
    </section>
  );
}
