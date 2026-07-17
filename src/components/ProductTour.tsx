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
  { icon: Bell, title: 'Alerts', body: 'Get strong setups and risk flags delivered to Telegram or WhatsApp, with quiet hours and per-ticker control. Set it up in Account.', href: '/account/notifications', hrefLabel: 'Set up alerts' },
  { icon: GraduationCap, title: 'Learn as you go', body: 'New to this? Education explains every metric in plain English. No jargon, no pressure - and your settings live in Account.', href: '/education', hrefLabel: 'Open Education' },
];

export function ProductTour() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SEEN_KEY) !== 'true') setOpen(true);
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
    <div className="fixed inset-0 z-[90] grid place-items-end justify-center bg-black/50 px-4 pb-6 backdrop-blur-sm sm:place-items-center sm:pb-0">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]/95 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
            <Sparkles size={13} className="text-[#f3a33a]" /> Quick tour
          </span>
          <button type="button" onClick={close} aria-label="Skip tour" className="grid h-11 w-11 place-items-center rounded text-[#8190a0] transition hover:text-[#eef3f8] sm:h-7 sm:w-7">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#9a6a1f]/50 bg-[#23180b] text-[#f3a33a]">
            <Icon size={20} />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-[#eef3f8]">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#a8b5c2]">{step.body}</p>

          {step.href && (
            <Link href={step.href} onClick={close} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#f3a33a] hover:underline">
              {step.hrefLabel} <ArrowRight size={13} />
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-[#f3a33a]' : 'w-1.5 bg-[#2c3a4a]'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button type="button" onClick={() => setIndex((i) => i - 1)} className="rounded-md border border-[#263241] bg-[#0d141c] px-3 py-1.5 text-xs text-[#a8b5c2] transition hover:text-[#eef3f8]">
                Back
              </button>
            )}
            {isLast ? (
              <button type="button" onClick={close} className="rounded-md border border-[#f3a33a] bg-[#23180b] px-4 py-1.5 text-xs font-semibold text-[#f3a33a] transition hover:bg-[#2a1f0f]">
                Finish
              </button>
            ) : (
              <button type="button" onClick={() => setIndex((i) => i + 1)} className="inline-flex items-center gap-1 rounded-md border border-[#f3a33a] bg-[#23180b] px-4 py-1.5 text-xs font-semibold text-[#f3a33a] transition hover:bg-[#2a1f0f]">
                Next <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
