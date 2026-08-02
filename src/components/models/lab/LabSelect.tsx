'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * LabSelect - a compact, accessible dropdown. One clean control that shows the current choice and
 * opens a tidy list on tap, so a complex configuration reads as a few simple selectors instead of a
 * wall of buttons. Closes on outside click or Escape. Options can carry an availability badge and a
 * one-line subtitle; a disabled option stays visible (all features on) but cannot be chosen.
 */

export type BadgeTone = 'live' | 'shadow-live' | 'reference' | 'planned';

const BADGE_TONE: Record<BadgeTone, string> = {
  live: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
  'shadow-live': 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  reference: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/40',
  planned: 'bg-white/10 text-white/60',
};

export interface LabOption {
  value: string;
  label: string;
  sub?: string;
  badge?: { text: string; tone?: BadgeTone };
  disabled?: boolean;
}

function Badge({ text, tone }: { text: string; tone?: BadgeTone }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${BADGE_TONE[tone ?? 'planned']}`}>{text}</span>
  );
}

export function LabSelect({
  value,
  options,
  onChange,
  ariaLabel,
  compact = false,
}: {
  value: string;
  options: LabOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  /** Tighter trigger for inline controls (e.g. a sort selector inside a panel header). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] text-left transition hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate font-medium text-white/90 ${compact ? 'text-[12px]' : 'text-[14px]'}`}>
          {selected?.label}
        </span>
        {selected?.badge ? <Badge text={selected.badge.text} tone={selected.badge.tone} /> : null}
        <ChevronDown size={compact ? 14 : 16} className={`shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-white/12 bg-[#0d141c] shadow-2xl shadow-black/50"
        >
          <ul className="max-h-72 overflow-y-auto py-1">
            {options.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={o.disabled}
                    onClick={() => {
                      if (o.disabled) return;
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${
                      o.disabled
                        ? 'cursor-not-allowed opacity-45'
                        : active
                          ? 'bg-sky-500/[0.12]'
                          : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {active ? <Check size={14} className="text-sky-300" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-white/90">{o.label}</span>
                      {o.sub ? <span className="block truncate text-[11px] text-white/45">{o.sub}</span> : null}
                    </span>
                    {o.badge ? <Badge text={o.badge.text} tone={o.badge.tone} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
