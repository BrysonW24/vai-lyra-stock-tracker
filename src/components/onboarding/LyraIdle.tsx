'use client';

import { BrandLogo } from '@/components/BrandLogo';

/**
 * Idle Lyra mark - fills blank/black space (a sparse onboarding step, an empty
 * watchlist, a loading gap...) with the real brand logo, dimmed and gently
 * floating: just sitting there waiting. Decorative (pointer-events-none).
 * Reusable: pass a `caption` for empty states and `size` to fit the gap.
 */
interface LyraIdleProps {
  /** Optional one-line caption under the mark (e.g. "no holdings yet"). */
  caption?: string;
  /** Pixel size of the logo tile. Default 72. */
  size?: number;
}

export function LyraIdle({ caption, size = 72 }: LyraIdleProps) {
  return (
    <div
      className="pointer-events-none flex flex-col items-center gap-3 opacity-40"
      style={{ animation: 'creatureFloat 4.8s ease-in-out infinite' }}
      aria-hidden="true"
    >
      <BrandLogo size={size} />
      {caption && (
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5d6b79]">{caption}</p>
      )}
    </div>
  );
}
