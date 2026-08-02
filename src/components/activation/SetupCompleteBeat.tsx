'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { prefersReducedMotion } from '@/lib/activation/animationTiming';

/**
 * "You're all set" beat - a short success moment shown the instant the user finishes
 * onboarding, before the world flips to the dark command centre. A success mark blooms
 * in, a calibrating line sweeps, then it hands off to the console.
 */
export function SetupCompleteBeat({ holdMs = 2600 }: { holdMs?: number }) {
  const router = useRouter();
  const reduced = prefersReducedMotion();

  useEffect(() => {
    const total = reduced ? 900 : holdMs;
    const timer = setTimeout(() => {
      router.push('/');
      router.refresh();
    }, total);
    return () => clearTimeout(timer);
  }, [router, reduced, holdMs]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ground">
      <div className="pointer-events-none absolute h-72 w-72 rounded-full bg-positive/15 blur-[90px]" />

      <div
        className="relative flex flex-col items-center gap-5"
        style={{ animation: reduced ? undefined : 'beatIn 700ms cubic-bezier(0.22, 0.61, 0.36, 1) both' }}
      >
        <span className="grid h-20 w-20 place-items-center rounded-full border border-positive/40 bg-positive-tint text-positive shadow-[0_0_50px_-10px_rgba(67,209,139,0.6)]">
          <Check size={40} strokeWidth={2.5} />
        </span>
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight text-ink">You&apos;re all set</p>
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.24em] text-ink-3">
            Calibrating your command centre…
          </p>
        </div>
        <div className="mt-2 h-0.5 w-40 overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-gradient-to-r from-blue-deep via-positive to-accent"
            style={{ width: reduced ? '100%' : '0%', animation: reduced ? undefined : `beatBar ${holdMs}ms linear both` }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes beatIn {
          from {
            opacity: 0;
            transform: scale(0.82);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes beatBar {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
