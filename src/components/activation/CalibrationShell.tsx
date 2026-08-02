'use client';

import { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

interface CalibrationShellProps {
  children: ReactNode;
  step: number;
  totalSteps: number;
  onSkip: () => void;
  showSkip?: boolean;
  onBack?: () => void;
  showBack?: boolean;
  onContinue?: () => void;
  showContinue?: boolean;
  continueLabel?: string;
}

/**
 * CalibrationShell: Full-screen layout for the activation sequence.
 * Header with brand + Skip button, centred scene area, progress dots, footer.
 * Responsive: centred cinematic on desktop, stacked on mobile.
 */
export function CalibrationShell({
  children,
  step,
  totalSteps,
  onSkip,
  showSkip = true,
  onBack,
  showBack = false,
  onContinue,
  showContinue = false,
  continueLabel = 'Continue',
}: CalibrationShellProps) {
  return (
    <div className="fixed inset-0 flex flex-col bg-ground">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={onBack}
              type="button"
              title="Go back"
              aria-label="Go back"
              className="grid h-11 w-11 place-items-center rounded-cell border border-line-strong bg-panel text-ink-2 transition hover:border-line-hair hover:text-ink"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <BrandLogo size={28} />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-3 hidden sm:inline">
            Signal Calibration
          </span>
        </div>
        {showSkip && (
          <button
            onClick={onSkip}
            className="-m-3 p-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-3 transition hover:text-ink"
          >
            Skip
          </button>
        )}
      </header>

      {/* Scene Area - scrolls on small screens so dense scenes never clip */}
      <main className="flex-1 overflow-y-auto">
        {/* my-auto centres the scene when it fits but lets the top scroll into view when
            it overflows - justify-center clips the top of tall scenes and can't be scrolled to. */}
        <div className="flex min-h-full flex-col items-center px-4 py-3 md:px-6 md:py-5">
          <div className="my-auto w-full">{children}</div>
        </div>
      </main>

      {/* Progress Footer */}
      <footer
        className="flex flex-col items-center gap-2.5 px-4 py-3 md:px-6 md:py-4"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {/* Progress Dots */}
        <div className="flex gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`transition-all duration-300 rounded-full ${
                i < step
                  ? 'w-2 h-2 bg-blue-focus'
                  : i === step - 1
                    ? 'w-6 h-2 bg-blue-focus'
                    : 'w-2 h-2 bg-line-strong'
              }`}
            />
          ))}
        </div>

        {/* Step Label */}
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-3">
          Step {step} of {totalSteps}
        </p>

        {/* Manual advance - let the user move on when ready */}
        {showContinue && onContinue && (
          <button
            onClick={onContinue}
            type="button"
            className="min-h-[44px] rounded-cell bg-[image:var(--lyra-cta-gradient)] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
          >
            {continueLabel} &rarr;
          </button>
        )}
      </footer>
    </div>
  );
}
