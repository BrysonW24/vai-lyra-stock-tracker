'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Compass, GraduationCap, X } from 'lucide-react';
import { loadOnboardingSummary } from '@/lib/onboarding-summary';
import { loadLocalHoldings } from '@/lib/local-portfolio';
import { loadProfile, loadAi, loadNotifications } from '@/lib/account';
import { isSupabaseConfigured } from '@/lib/supabase/client';

interface Step {
  label: string;
  done: boolean;
}

/**
 * Command Centre entry point - personalised, not perpetual. A brand-new user sees the
 * orientation (set up / never traded). Once they've onboarded it becomes either a
 * beginner-education nudge (if they said they've never traded) or a compact setup tracker
 * (how much of the console is configured) that disappears once complete - so it never
 * just nags "New here?" at someone who already set everything up. Demo-mode surface;
 * signed-in users get the server-backed SetupChecklist instead.
 */
export function GettingStartedBanner() {
  const soloMode = !isSupabaseConfigured();
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [neverTraded, setNeverTraded] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem('lyra.gettingStartedDismissed') === 'true';
    } catch {
      /* ignore */
    }
    const summary = loadOnboardingSummary();
    const holdings = loadLocalHoldings();
    const profile = loadProfile();
    const ai = loadAi();
    const notifications = loadNotifications();

    setOnboarded(!!summary?.onboarded);
    setNeverTraded(summary?.tradedBefore === 'no');
    setSteps([
      { label: 'Profile', done: profile.displayName.trim().length > 0 },
      { label: 'Holdings', done: holdings.length > 0 || (summary?.portfolioCount ?? 0) > 0 },
      { label: 'Watchlist', done: (summary?.watchlistCount ?? 0) > 0 },
      { label: 'Alerts', done: notifications.telegramEnabled },
      { label: 'Paper Bot', done: ai.mode !== 'off' },
    ]);
    setShow(!dismissed);
    setReady(true);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem('lyra.gettingStartedDismissed', 'true');
    } catch {
      /* ignore */
    }
  }

  if (!ready || !show) return null;

  // Completing Solo onboarding is the whole required setup. Optional AI, paper
  // trading, and Community-only notification delivery must not become a permanent
  // incomplete checklist for a returning Solo user.
  if (soloMode && onboarded && !neverTraded) return null;

  const dismissButton = (
    <button
      onClick={dismiss}
      type="button"
      aria-label="Dismiss"
      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded text-ink-3 transition hover:text-ink"
    >
      <X size={15} />
    </button>
  );

  // State A: brand new - orientation.
  if (!onboarded) {
    return (
      <section className="terminal-panel glass-hero relative overflow-hidden rounded-panel p-3">
        {dismissButton}
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">New here? Let&apos;s get you oriented.</p>
            <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-ink-2">
              Set up your console to make these signals personal to what you own and watch - or, if you are new to the
              market, start with a short plain-English walkthrough first. No jargon, no pressure.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-2 rounded-cell border border-accent bg-accent-tint/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent transition hover:bg-accent-tint"
            >
              <Compass size={14} /> Set up my console
            </Link>
            <Link
              href="/education?track=beginner"
              className="inline-flex items-center justify-center gap-2 rounded-cell border border-blue-deep bg-blue-tint px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-pending transition hover:bg-blue-deep/30"
            >
              <GraduationCap size={14} /> Never traded before? Start here
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // State B: onboarded + said "never traded" - personalised education nudge.
  if (neverTraded) {
    return (
      <section className="terminal-panel glass-hero relative overflow-hidden rounded-panel p-3">
        {dismissButton}
        <div className="flex flex-col gap-2.5 pr-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">New to trading? Keep going on the basics.</p>
            <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-ink-2">
              You told us you&apos;re new to the market - your plain-English walkthrough is ready whenever you want it.
            </p>
          </div>
          <Link
            href="/education?track=beginner"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-cell border border-blue-deep bg-blue-tint px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-pending transition hover:bg-blue-deep/30"
          >
            <GraduationCap size={14} /> Continue the basics
          </Link>
        </div>
      </section>
    );
  }

  // State C: onboarded - compact setup tracker; hides once complete.
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount >= steps.length) return null;

  return (
    <section className="terminal-panel relative overflow-hidden rounded-panel p-3">
      {dismissButton}
      <div className="flex flex-col gap-2.5 pr-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            Your console · {doneCount}/{steps.length} set up
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-ink-2">Finish setup to make every signal personal to your book.</p>
        </div>
        <Link
          href="/onboarding"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-cell border border-accent bg-accent-tint/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent transition hover:bg-accent-tint"
        >
          <Compass size={14} /> Refine setup
        </Link>
      </div>
      {/* Actual checklist: a square checkbox that ticks when done + the item, in a
          compact grid so all five fit without getting tall. */}
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition ${
                s.done ? 'border-positive/50 bg-positive-tint text-positive' : 'border-line-hair bg-panel'
              }`}
            >
              {s.done && <Check size={11} strokeWidth={3} />}
            </span>
            <span className={`text-[12px] ${s.done ? 'text-ink-dim' : 'text-ink-title'}`}>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
