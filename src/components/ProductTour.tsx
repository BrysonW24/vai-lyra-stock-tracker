'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BrainCircuit,
  BriefcaseBusiness,
  GraduationCap,
  Radar,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { loadOnboardingSummary } from '@/lib/onboarding-summary';
import { shouldAutoOpenProductTour } from '@/lib/product-tour';

/**
 * First-run product tour - a sequence of modern glass flashcards that walk a new user
 * through what's around (8 steps). Shows once (localStorage), can be skipped any time,
 * and never blocks the app. A "Take a tour" entry point can re-open it by clearing the
 * flag, but by default it self-dismisses after the first run.
 */
const SEEN_KEY = 'lyra.tourSeen';

type IconType = typeof Sparkles;

interface TourStep {
  icon: IconType;
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
}

const STEPS: TourStep[] = [
  { icon: Sparkles, title: 'Welcome to your console', body: 'This is the Command Centre - your daily home. The strongest setups, your holdings, and a plain-English brief, all in one glance.' },
  { icon: BrainCircuit, title: 'Daily brief', body: 'Every visit opens with a grounded read of the day: the market backdrop, the leading setup, what is moving in your book, and what to watch.' },
  { icon: Radar, title: 'Signal Radar', body: 'Every US tech stock scored 0-100 from hard maths - RSI, MACD, trend, volume, price location. Ranked so you always know what deserves attention.', href: '/radar', hrefLabel: 'Open Radar' },
  { icon: BarChart3, title: 'Ticker detail', body: 'Click any ticker for the full picture: candles, the momentum chart, the score breakdown, and exactly why it is flagged - plus what would invalidate it.' },
  { icon: BriefcaseBusiness, title: 'Your portfolio', body: 'Add what you own and the signals get personal: what to review, what is cooling, your momentum board front and centre.', href: '/portfolio', hrefLabel: 'Add holdings' },
  { icon: Star, title: 'Your watchlist', body: 'Track the setups you want to catch. Set a target and Lyra tells you when one is getting close.', href: '/watchlist', hrefLabel: 'Build a watchlist' },
  { icon: Bell, title: 'Alerts', body: 'Signal changes stay visible in the console. Account-backed Community builds can also deliver push, Telegram, or WhatsApp alerts.', href: '/account/notifications', hrefLabel: 'See alert options' },
  { icon: GraduationCap, title: 'Learn as you go', body: 'New to this? Education explains every metric in plain English. No jargon, no pressure - and your settings live in Account.', href: '/education', hrefLabel: 'Open Education' },
];

export function ProductTour() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(SEEN_KEY) === 'true';
      const onboardingComplete = loadOnboardingSummary()?.onboarded === true;
      if (onboardingComplete) {
        // The full setup already explained the product. Do not immediately force a
        // second eight-card tour; it remains available from the Help menu.
        window.localStorage.setItem(SEEN_KEY, 'true');
      }
      if (shouldAutoOpenProductTour(seen, onboardingComplete)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  function close() {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, 'true');
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-end justify-center bg-ground/70 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:place-items-center sm:pb-0">
      <div className="w-full max-w-md overflow-hidden rounded-panel border border-line-strong bg-panel-deep/95 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            <Sparkles size={13} className="text-accent" /> Quick tour
          </span>
          <button type="button" onClick={close} aria-label="Skip tour" className="grid h-11 w-11 place-items-center rounded text-ink-3 transition hover:text-ink sm:h-7 sm:w-7">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-6">
          <span className="grid h-11 w-11 place-items-center rounded-cell border border-accent-border/50 bg-accent-tint/80 text-accent">
            <Icon size={20} />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</p>

          {step.href && (
            <Link href={step.href} onClick={close} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
              {step.hrefLabel} <ArrowRight size={13} />
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-accent' : 'w-1.5 bg-line-strong'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button type="button" onClick={() => setIndex((i) => i - 1)} className="rounded-cell border border-line-strong bg-panel px-3 py-1.5 text-xs text-ink-2 transition hover:text-ink">
                Back
              </button>
            )}
            {isLast ? (
              <button type="button" onClick={close} className="rounded-cell border border-accent bg-accent-tint/80 px-4 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent-tint">
                Finish
              </button>
            ) : (
              <button type="button" onClick={() => setIndex((i) => i + 1)} className="inline-flex items-center gap-1 rounded-cell border border-accent bg-accent-tint/80 px-4 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent-tint">
                Next <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
