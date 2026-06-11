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
 * Local macro context as a ticker-tape (same UX as the Intel marquee): the
 * country/stance badge sits fixed on the left while the rates, inflation and jobs
 * series stream behind it. Every indicator is tappable and opens its primary
 * source (RBA / ABS release). Pauses on hover; honours prefers-reduced-motion.
 *
 * Macro deltas stay muted (not green/red): a rise in GDP and a rise in
 * unemployment both point "up" but mean opposite things - direction, not sentiment.
 */
export function MacroContextStrip({ data }: { data: MacroSnapshot }) {
  const items = [
    ...data.indicators.map((indicator) => ({
      key: indicator.label,
      label: indicator.label,
      value: indicator.value,
      change: indicator.change ? `${indicator.direction ? `${DIR_GLYPH[indicator.direction]} ` : ''}${indicator.change}` : '',
      href: indicator.sourceUrl,
      source: indicator.source,
    })),
    {
      key: 'chart-pack',
      label: data.chartPackLabel,
      value: '',
      change: '',
      href: data.chartPackUrl,
      source: 'RBA',
    },
  ];

  return (
    <div className="intel-marquee terminal-panel glass-hero relative flex items-center overflow-hidden rounded-md">
      {/* Fixed country + policy stance badge - the tape scrolls behind it */}
      <div className="z-20 flex shrink-0 items-center border-r border-[#1b2530] bg-[#0b1016] px-3 py-2">
        <span className={`rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${STANCE_COLOR[data.stance]}`}>
          {data.countryCode} · {data.stanceLabel}
        </span>
      </div>

      {/* Scrolling track (items duplicated for a seamless loop) */}
      <div className="relative min-w-0 flex-1 overflow-hidden py-2">
        <div className="context-track flex w-max items-center">
          {[...items, ...items].map((item, i) =>
            item.href ? (
              <a
                key={`${item.key}-${i}`}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                title={item.source ? `Open ${item.source} source` : 'Open source'}
                className="inline-flex shrink-0 items-baseline gap-1.5 border-r border-[#1b2530] px-4 font-mono transition hover:bg-[#101720]"
              >
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">{item.label}</span>
                {item.value && <span className="text-xs font-semibold text-[#dbe5ee]">{item.value}</span>}
                {item.change && <span className="text-[11px] text-[#8190a0]">{item.change}</span>}
                {!item.value && <ArrowUpRight size={11} className="self-center text-[#8190a0]" />}
              </a>
            ) : (
              <span
                key={`${item.key}-${i}`}
                className="inline-flex shrink-0 items-baseline gap-1.5 border-r border-[#1b2530] px-4 font-mono"
              >
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">{item.label}</span>
                {item.value && <span className="text-xs font-semibold text-[#dbe5ee]">{item.value}</span>}
                {item.change && <span className="text-[11px] text-[#8190a0]">{item.change}</span>}
              </span>
            ),
          )}
        </div>
        {/* Right edge fade */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0b1016] to-transparent" />
      </div>
    </div>
  );
}
