'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, HelpCircle } from 'lucide-react';
import { getModule, getModuleHref } from '@/lib/education';

interface MetricHelpProps {
  /** Education module id - pulls the canonical definition so copy never drifts. */
  moduleId: string;
  /** Override the help text (e.g. the SignalDrawer HELP map). Falls back to the module definition. */
  text?: string;
  /** Override the deep-link label. Defaults to the module title. */
  label?: string;
  /** Visual size of the trigger glyph. */
  size?: number;
}

/**
 * Tap-to-reveal inline metric explainer. A tiny "?" glyph next to a jargon label that
 * pops a compact definition and a "Learn more" deep-link into /education?module=<id>.
 * Content comes from EDUCATION_MODULES (or an explicit override) so it can never drift
 * from the academy. Frontend explains - it never recomputes a trading number.
 */
export function MetricHelp({ moduleId, text, label, size = 12 }: MetricHelpProps) {
  const [open, setOpen] = useState(false);
  const moduleEntry = getModule(moduleId);
  const body = text ?? moduleEntry?.definition;
  const linkLabel = label ?? moduleEntry?.title ?? 'Learn more';

  if (!body) return null;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`What is ${linkLabel}`}
        aria-expanded={open}
        title={body}
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[#263241] text-[#8190a0] transition hover:border-[#3a4754] hover:text-[#eef3f8]"
      >
        <HelpCircle size={size} />
      </button>

      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <span className="absolute left-0 top-5 z-50 block w-60 rounded-md border border-[#263241] bg-[#0b1016] p-2.5 text-left shadow-2xl">
            <span className="block text-[11px] leading-snug text-[#c8d3de]">{body}</span>
            <Link
              href={getModuleHref(moduleId)}
              className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#8aa2ff] transition hover:text-[#b3c4ff]"
            >
              Learn more <ArrowUpRight size={11} />
            </Link>
          </span>
        </>
      )}
    </span>
  );
}
