'use client';

import { Sparkles } from 'lucide-react';

interface SaaSTooltipProps {
  title: string;
  body: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function SaaSTooltip({ title, body, position = 'top' }: SaaSTooltipProps) {
  let posClasses = '';
  switch (position) {
    case 'top':
      posClasses = 'bottom-full left-1/2 mb-3 -translate-x-1/2';
      break;
    case 'bottom':
      posClasses = 'top-full left-1/2 mt-3 -translate-x-1/2';
      break;
    case 'left':
      posClasses = 'right-full top-1/2 mr-3 -translate-y-1/2';
      break;
    case 'right':
      posClasses = 'left-full top-1/2 ml-3 -translate-y-1/2';
      break;
  }

  return (
    <div className={`absolute z-50 w-64 ${posClasses}`}>
      <div className="relative overflow-hidden rounded-xl border border-[#f3a33a]/50 bg-[#23180b]/95 p-3 shadow-2xl backdrop-blur-md">
        <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[#f3a33a]/20 blur-xl" />
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#f3a33a]">
          <Sparkles size={12} /> {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#dbe5ee]">{body}</p>
      </div>
      
      {/* Arrow pointer */}
      <div className={`absolute h-3 w-3 rotate-45 border-[#f3a33a]/50 bg-[#23180b]/95
        ${position === 'top' ? 'bottom-[-7px] left-1/2 -translate-x-1/2 border-b border-r' : ''}
        ${position === 'bottom' ? 'top-[-7px] left-1/2 -translate-x-1/2 border-l border-t' : ''}
        ${position === 'left' ? 'right-[-7px] top-1/2 -translate-y-1/2 border-r border-t' : ''}
        ${position === 'right' ? 'left-[-7px] top-1/2 -translate-y-1/2 border-b border-l' : ''}
      `} />
    </div>
  );
}
