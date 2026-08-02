'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, HelpCircle } from 'lucide-react';
import { DetailDrawer } from '@/components/DetailDrawer';
import { getModule, getModuleHref } from '@/lib/education';

export interface HelpTerm {
  /** The jargon as it appears on screen, e.g. "Form 4", "btl", "13F". */
  term: string;
  /** Plain-English definition for this space. */
  what: string;
  /** Optional education module id - adds a "Learn more" deep-link when set. */
  moduleId?: string;
}

interface HelpDrawerProps {
  /** Drawer heading, e.g. "What the terms mean". */
  title: string;
  /** One-line subtitle under the heading. */
  subtitle?: string;
  /** Intro paragraph above the glossary. */
  intro?: string;
  /** The glossary - each row defines one piece of jargon for this space. */
  terms: HelpTerm[];
  /** Optional research-only footnote. Defaults to the standard disclaimer. */
  footnote?: string;
  /** Accessible label for the trigger. Defaults to the title. */
  ariaLabel?: string;
}

const DEFAULT_FOOTNOTE =
  'Every figure is read off the deterministic backend. Lyra surfaces structure + evidence - it never tells you to buy or sell, and never invents a number. Research only.';

/**
 * Reusable "?" glossary drawer for an analytical space - the PrimeSetupsHelp /
 * CatalystRadarHelp pattern, generalised. A small info button opens a right-slide panel
 * that defines the space's jargon inline, with a per-term "Learn more" deep-link into
 * /education?module=<id> wherever a matching academy module exists.
 */
export function HelpDrawer({ title, subtitle, intro, terms, footnote, ariaLabel }: HelpDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel ?? title}
        title={ariaLabel ?? title}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-strong text-ink-3 transition hover:border-line-hair hover:text-ink"
      >
        <HelpCircle size={12} />
      </button>

      <DetailDrawer open={open} onClose={() => setOpen(false)} title={title} subtitle={subtitle}>
        {intro && <p className="text-[12px] leading-relaxed text-ink-title">{intro}</p>}

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">What the terms mean</p>
          {terms.map((t) => {
            const moduleEntry = t.moduleId ? getModule(t.moduleId) : undefined;
            return (
              <div key={t.term} className="rounded-cell border border-line bg-panel p-2.5">
                <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-ink">
                  <span className="rounded border border-line-strong bg-chrome px-1.5 py-0.5 font-mono text-[10px] text-ink-2">{t.term}</span>
                </p>
                <p className="mt-1 text-[11px] leading-snug text-ink-2">{t.what}</p>
                {moduleEntry && t.moduleId && (
                  <Link
                    href={getModuleHref(t.moduleId)}
                    className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-blue-info transition hover:text-blue-focus"
                  >
                    Learn more <ArrowUpRight size={11} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <p className="rounded-cell border border-line-strong bg-panel p-2.5 font-mono text-[10px] leading-snug text-ink-3">
          {footnote ?? DEFAULT_FOOTNOTE}
        </p>
      </DetailDrawer>
    </>
  );
}
