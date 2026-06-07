'use client';

import { ArrowUpRight } from 'lucide-react';
import type { DeltaDirection, MacroSnapshot, MacroStance } from '@/lib/macro-context';

const STANCE_COLOR: Record<MacroStance, string> = {
  easing: 'bg-[#1a2a3a] text-[#60a5fa] border-[#60a5fa]',
  hold: 'bg-[#161e27] text-[#a8b5c2] border-[#3a4754]',
  tightening: 'bg-[#3a1a1a] text-[#ff6b6b] border-[#ff6b6b]',
};

const DIR_GLYPH: Record<DeltaDirection, string> = { up: '▲', down: '▼', flat: '-' };

/**
 * Local macro context strip - the country-of-residence backdrop (rates, inflation,
 * jobs) that sits directly under the global market-context strip on Command. Same
 * dense, horizontally-scrolling treatment so the two read as a stacked pair.
 *
 * Macro deltas are intentionally muted (not green/red): a rise in GDP and a rise in
 * unemployment both point "up" but mean opposite things, so we show direction, not
 * sentiment.
 */
export function MacroContextStrip({ data }: { data: MacroSnapshot }) {
  return (
    <div className="terminal-panel glass-hero overflow-hidden rounded-md p-3">
      <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0">
        {/* Country + policy stance badge */}
        <div className={`shrink-0 rounded border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${STANCE_COLOR[data.stance]}`}>
          {data.countryCode} · {data.stanceLabel}
        </div>

        {data.indicators.map((indicator) => (
          <div key={indicator.label} className="flex shrink-0 flex-col items-start gap-0.5 font-mono text-xs" title={indicator.source ? `Source: ${indicator.source}` : undefined}>
            <span className="uppercase tracking-[0.14em] text-[#8190a0]">{indicator.label}</span>
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-[#dbe5ee]">{indicator.value}</span>
              {indicator.change ? (
                <span className="text-[#8190a0]">
                  {indicator.direction ? `${DIR_GLYPH[indicator.direction]} ` : ''}
                  {indicator.change}
                </span>
              ) : null}
            </div>
          </div>
        ))}

        {/* Monthly RBA chart pack - read each month */}
        <a
          href={data.chartPackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-2 py-1.5 font-mono text-[11px] text-[#a8b5c2] transition hover:text-[#eef3f8]"
        >
          {data.chartPackLabel} <ArrowUpRight size={11} />
        </a>
      </div>
    </div>
  );
}
