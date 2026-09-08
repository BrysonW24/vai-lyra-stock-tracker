import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * One block of Simple view. Deliberately the OPPOSITE of the dense default: generous
 * spacing, readable type, a plain heading, a few rows, and exactly one quiet way deeper.
 * No charts, no carousels, no sliders - the three things the founder named as noise
 * (2026-09-09). If a block has nothing real to show it says so; it never fills space.
 */
export function SimpleSection({
  title,
  hint,
  href,
  linkLabel,
  chip,
  children,
}: {
  title: string;
  /** One plain-English line under the title. Says what this is, not how it works. */
  hint?: string;
  /** Where "see all" goes. Omit for a block with no deeper surface. */
  href?: string;
  linkLabel?: string;
  /** Provenance or status chip - the honesty rule follows us into Simple view. */
  chip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-ink-title">{title}</h2>
          {chip}
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-ink-3 transition hover:text-accent"
          >
            {linkLabel ?? 'See all'} <ArrowRight size={13} />
          </Link>
        )}
      </div>
      {hint && <p className="px-4 pt-3 text-[12px] leading-relaxed text-ink-3">{hint}</p>}
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/** The honest empty state. Says what is missing and what would fill it - never filler. */
export function SimpleEmpty({ children }: { children: ReactNode }) {
  return <p className="py-1 text-[13px] leading-relaxed text-ink-dim">{children}</p>;
}

/** A provenance chip, same contract as the rest of the app (live renders nothing). */
export function SimpleChip({ tone = 'sample', children }: { tone?: 'sample' | 'live'; children: ReactNode }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${
        tone === 'live'
          ? 'border-positive/40 bg-positive-tint text-positive'
          : 'border-accent-border bg-accent-tint text-accent'
      }`}
    >
      {children}
    </span>
  );
}
