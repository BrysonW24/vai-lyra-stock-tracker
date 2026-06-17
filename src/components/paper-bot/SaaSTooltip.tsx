'use client';

import { useEffect, useRef } from 'react';
import { Sparkles, CheckCircle2, RotateCcw } from 'lucide-react';

interface SaaSTooltipProps {
  title: string;
  body: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'center' | 'left' | 'right';
  /** If provided, an "OK" dismiss button is shown */
  onDismiss?: () => void;
  /** If provided, a "Replay" button is shown */
  onReplay?: () => void;
}

export function SaaSTooltip({ title, body, position = 'top', align = 'center', onDismiss, onReplay }: SaaSTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  let posClasses = '';
  switch (position) {
    case 'top':
      if (align === 'center') posClasses = 'bottom-full left-1/2 mb-3 -translate-x-1/2';
      else if (align === 'left') posClasses = 'bottom-full left-0 mb-3';
      else if (align === 'right') posClasses = 'bottom-full right-0 mb-3';
      break;
    case 'bottom':
      if (align === 'center') posClasses = 'top-full left-1/2 mt-3 -translate-x-1/2';
      else if (align === 'left') posClasses = 'top-full left-0 mt-3';
      else if (align === 'right') posClasses = 'top-full right-0 mt-3';
      break;
    case 'left':
      posClasses = 'right-full top-1/2 mr-3 -translate-y-1/2';
      break;
    case 'right':
      posClasses = 'left-full top-1/2 ml-3 -translate-y-1/2';
      break;
  }

  let arrowClasses = '';
  if (position === 'top') {
    arrowClasses = 'bottom-[-7px] border-b border-r ';
    if (align === 'center') arrowClasses += 'left-1/2 -translate-x-1/2';
    if (align === 'left') arrowClasses += 'left-8';
    if (align === 'right') arrowClasses += 'right-8';
  } else if (position === 'bottom') {
    arrowClasses = 'top-[-7px] border-l border-t ';
    if (align === 'center') arrowClasses += 'left-1/2 -translate-x-1/2';
    if (align === 'left') arrowClasses += 'left-8';
    if (align === 'right') arrowClasses += 'right-8';
  } else if (position === 'left') {
    arrowClasses = 'right-[-7px] top-1/2 -translate-y-1/2 border-r border-t';
  } else if (position === 'right') {
    arrowClasses = 'left-[-7px] top-1/2 -translate-y-1/2 border-b border-l';
  }

  const hasActions = onDismiss || onReplay;

  return (
    <div ref={ref} className={`absolute z-50 w-72 ${posClasses}`}>
      <div className="relative overflow-hidden rounded-xl border border-[#f3a33a]/50 bg-[#23180b]/95 p-3 shadow-2xl backdrop-blur-md">
        <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[#f3a33a]/20 blur-xl" />
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#f3a33a]">
          <Sparkles size={12} /> {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#dbe5ee]">{body}</p>

        {/* Action buttons */}
        {hasActions && (
          <div className="mt-3 flex items-center gap-2 border-t border-[#f3a33a]/15 pt-2.5">
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#43d18b]/40 bg-[#0d251b] px-3 py-1.5 text-[11px] font-semibold text-[#43d18b] transition hover:bg-[#103626]"
              >
                <CheckCircle2 size={12} /> Got it!
              </button>
            )}
            {onReplay && (
              <button
                type="button"
                onClick={onReplay}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#f3a33a]/30 bg-[#1a1206] px-3 py-1.5 text-[11px] font-semibold text-[#f3a33a] transition hover:bg-[#231a08]"
              >
                <RotateCcw size={12} /> Replay
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Arrow pointer */}
      <div className={`absolute h-3 w-3 rotate-45 bg-[#23180b]/95 border-[#f3a33a]/50 ${arrowClasses}`} />
    </div>
  );
}
