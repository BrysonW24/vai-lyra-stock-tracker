'use client';

import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { prefersReducedMotion } from '@/lib/activation/animationTiming';

/**
 * Grand-opening brand reveal: the Lyra mark scales and fades up over a patient beat,
 * concentric radar rings pulse out behind it, the wordmark settles in, then it hands
 * off to the feature primer. Tap anywhere to skip. Respects reduced-motion.
 */
export function LyraReveal({ onDone, holdMs = 5000 }: { onDone: () => void; holdMs?: number }) {
  const reduced = prefersReducedMotion();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const total = reduced ? 1400 : holdMs;
    const fade = setTimeout(() => setLeaving(true), Math.max(0, total - 500));
    const done = setTimeout(() => onDone(), total);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [reduced, holdMs, onDone]);

  return (
    <div
      onClick={onDone}
      role="button"
      tabIndex={0}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ground"
      style={{ animation: leaving ? 'lyraRevealOut 500ms ease forwards' : undefined }}
    >
      {/* Concentric radar rings + core glow */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute rounded-full border border-blue/15"
            style={{
              width: `${(i + 1) * 170}px`,
              height: `${(i + 1) * 170}px`,
              animation: reduced ? undefined : `lyraRing 3.2s ease-out ${i * 0.45}s infinite`,
            }}
          />
        ))}
        <div className="absolute h-72 w-72 rounded-full bg-blue/15 blur-[90px]" />
      </div>

      {/* Logo + wordmark */}
      <div
        className="relative flex flex-col items-center gap-5"
        style={{ animation: reduced ? undefined : 'lyraLogoIn 1600ms cubic-bezier(0.22, 0.61, 0.36, 1) both' }}
      >
        <BrandLogo size={92} />
        <div
          className="text-center"
          style={{ animation: reduced ? undefined : 'lyraWordIn 900ms ease 800ms both' }}
        >
          <p className="text-3xl font-semibold tracking-tight text-ink">{BRAND_NAME}</p>
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-ink-3">{BRAND_TAGLINE}</p>
        </div>
      </div>

      <p
        className="absolute bottom-10 text-[10px] uppercase tracking-[0.18em] text-line-hair"
        style={{ animation: reduced ? undefined : 'lyraWordIn 600ms ease 2200ms both' }}
      >
        Tap to continue
      </p>

      <style jsx>{`
        @keyframes lyraLogoIn {
          from {
            opacity: 0;
            transform: scale(0.55);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes lyraWordIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes lyraRing {
          0% {
            opacity: 0;
            transform: scale(0.75);
          }
          35% {
            opacity: 0.55;
          }
          100% {
            opacity: 0;
            transform: scale(1.12);
          }
        }
        @keyframes lyraRevealOut {
          to {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
