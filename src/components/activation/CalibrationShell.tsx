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
    <div className="fixed inset-0 flex flex-col bg-[#07090c]">
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
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#263241] bg-[#0d141c] text-[#a8b5c2] transition hover:border-[#3a4754] hover:text-[#eef3f8]"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <BrandLogo size={28} />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8190a0] hidden sm:inline">
            Signal Calibration
          </span>
        </div>
        {showSkip && (
          <button
            onClick={onSkip}
            className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8190a0] transition hover:text-[#eef3f8]"
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
                  ? 'w-2 h-2 bg-[#60a5fa]'
                  : i === step - 1
                    ? 'w-6 h-2 bg-[#60a5fa]'
                    : 'w-2 h-2 bg-[#263241]'
              }`}
            />
          ))}
        </div>

        {/* Step Label */}
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
          Step {step} of {totalSteps}
        </p>

        {/* Manual advance - let the user move on when ready */}
        {showContinue && onContinue && (
          <button
            onClick={onContinue}
            type="button"
            className="rounded-md bg-gradient-to-r from-[#3b5bdb] via-[#43d18b] to-[#f3a33a] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#07090c] shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
          >
            {continueLabel} &rarr;
          </button>
        )}
      </footer>
    </div>
  );
}
