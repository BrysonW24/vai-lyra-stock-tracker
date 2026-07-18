'use client';

import { ReactNode, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ONBOARDING_STEPS } from '@/lib/onboarding';
import { BrandLogo } from '@/components/BrandLogo';

interface OnboardingShellProps {
  currentStep: number; // step ID (for title lookup)
  stepNumber: number; // 1-based position within the chosen path (for progress/labels)
  totalSteps: number;
  canGoBack: boolean;
  onBack: () => void;
  children: ReactNode;
  visual?: ReactNode;
  /** When true, the visual also renders as a compact strip above the content on
   *  mobile (desktop always shows it in the side column). Use on steps with the
   *  vertical headroom for it - e.g. the dense market-universe step. */
  mobileVisual?: boolean;
}

export function OnboardingShell({
  currentStep,
  stepNumber,
  totalSteps,
  canGoBack,
  onBack,
  children,
  visual,
  mobileVisual = false,
}: OnboardingShellProps) {
  const stepInfo = ONBOARDING_STEPS.find((s) => s.id === currentStep);
  const safeNumber = Math.min(Math.max(stepNumber, 1), totalSteps);
  const progressPercent = Math.round((safeNumber / totalSteps) * 100);

  // Every step change starts at the top - a new step must never inherit the
  // previous step's scroll position. A focused field keeps iOS scrolled to it
  // (keyboard up), so blur first, then jump to the top instantly - now and again
  // after layout settles (rAF) - bypassing the page's smooth-scroll.
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const toTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    toTop();
    // Re-assert the top across the next paints and a couple of short delays so a late
    // autoFocus / layout shift (which scrolls a field into view a frame or two later)
    // can't leave the step nudged down.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      toTop();
      raf2 = requestAnimationFrame(toTop);
    });
    const t1 = window.setTimeout(toTop, 60);
    const t2 = window.setTimeout(toTop, 180);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [currentStep]);

  // Lock page scroll while the step fits the viewport (no scroll, no rubber-band),
  // and release it the instant content overflows - so dynamic steps (adding
  // holdings, expanding the advanced strategy panel) and smaller screens are never
  // trapped. A ResizeObserver re-measures whenever the content height changes.
  useEffect(() => {
    const update = () => {
      const fits = document.documentElement.scrollHeight <= window.innerHeight + 1;
      document.body.style.overflowY = fits ? 'hidden' : '';
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      document.body.style.overflowY = '';
    };
  }, [currentStep]);

  return (
    <div className="min-h-screen text-[#eef3f8]">
      {/* Header */}
      <header
        className="glass-chrome sticky top-0 z-20 border-b border-[#1b2530]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-14 items-center justify-between px-3 md:px-5">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={onBack}
                className="grid h-9 w-9 place-items-center rounded text-[#8190a0] transition hover:bg-[#151c25] hover:text-[#eef3f8]"
                title="Go back"
                type="button"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <BrandLogo size={24} showWordmark />
            <span className="ml-1 hidden font-mono text-[11px] uppercase tracking-[0.16em] text-[#8190a0] sm:inline">
              Setup · {safeNumber}/{totalSteps}
            </span>
          </div>
          {/* No exit/close: onboarding is mandatory and must be completed. */}
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-[#0d141c]">
          <div
            className="h-full bg-gradient-to-r from-[#3b5bdb] via-[#43d18b] to-[#f3a33a] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main content - auto-adapts: two columns when a side visual exists,
          otherwise one comfortably wide centred column (no wasted half on desktop). */}
      <main className="px-3 py-3 md:px-6 md:py-10">
        <div
          className={
            visual
              ? 'mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]'
              : 'mx-auto w-full max-w-4xl'
          }
        >
          {/* Left column: form / content */}
          <div className="min-w-0 space-y-2.5 md:space-y-4">
            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i < safeNumber ? 'w-6 bg-[#f3a33a]' : 'w-1.5 bg-[#263241]'
                  }`}
                />
              ))}
            </div>

            <h1 className="text-lg font-semibold tracking-tight md:text-2xl">{stepInfo?.title}</h1>

            <div className="space-y-3 md:space-y-4">{children}</div>

            {/* Footer: Back only - onboarding is mandatory, there is no skip. */}
            <div className="flex items-center justify-between gap-3 border-t border-[#1b2530] pt-3 md:pt-4">
              <button
                onClick={onBack}
                disabled={!canGoBack}
                type="button"
                className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  canGoBack ? 'text-[#a8b5c2] hover:text-[#eef3f8]' : 'cursor-not-allowed text-[#3a4754]'
                }`}
              >
                <ChevronLeft size={14} /> Back
              </button>
              <span />
            </div>
          </div>

          {/* Right column: visual */}
          {visual && (
            <div
              className={`terminal-panel items-center justify-center overflow-hidden lg:order-none lg:flex lg:h-auto lg:min-h-[420px] lg:rounded-2xl lg:p-6 ${
                mobileVisual ? 'order-first flex h-[120px] rounded-xl p-2' : 'hidden'
              }`}
            >
              {visual}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
