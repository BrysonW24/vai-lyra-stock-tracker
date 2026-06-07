'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, GraduationCap, X } from 'lucide-react';

/**
 * Command Centre onboarding entry points. Shows two clear paths for a new user:
 * set up their console, or - if they have never traded - start with the beginner
 * education journey first. Dismissible (remembered in localStorage).
 */
export function GettingStartedBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem('lyra.gettingStartedDismissed') === 'true';
      setShow(!dismissed);
    } catch {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem('lyra.gettingStartedDismissed', 'true');
    } catch {
      /* ignore */
    }
  };

  if (!show) return null;

  return (
    <section className="terminal-panel glass-hero relative overflow-hidden rounded-md p-4 md:p-5">
      <button
        onClick={dismiss}
        type="button"
        aria-label="Dismiss"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded text-[#8190a0] transition hover:text-[#eef3f8]"
      >
        <X size={15} />
      </button>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#eef3f8]">New here? Let&apos;s get you oriented.</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#a8b5c2]">
            Set up your console to make these signals personal to what you own and watch - or, if you are new to the
            market, start with a short plain-English walkthrough first. No jargon, no pressure.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#f3a33a] bg-[#23180b] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#f3a33a] transition hover:bg-[#2a1f0f]"
          >
            <Compass size={14} /> Set up my console
          </Link>
          <Link
            href="/education?track=beginner"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#3b5bdb] bg-[#0d1530] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#8aa2ff] transition hover:bg-[#11193a]"
          >
            <GraduationCap size={14} /> Never traded before? Start here
          </Link>
        </div>
      </div>
    </section>
  );
}
