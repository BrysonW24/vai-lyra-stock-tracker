'use client';

import { ArrowUpRight } from 'lucide-react';
import type { DeltaDirection, MacroSnapshot, MacroStance } from '@/lib/macro-context';

const STANCE_COLOR: Record<MacroStance, { text: string; dot: string }> = {
  easing: { text: 'text-[#60a5fa]', dot: 'bg-[#60a5fa]' },
  hold: { text: 'text-[#a8b5c2]', dot: 'bg-[#a8b5c2]' },
  tightening: { text: 'text-[#ff6b6b]', dot: 'bg-[#ff6b6b]' },
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
    {
      key: 'read',
      label: 'Read',
      value: '',
      change: '',
      implication: `${data.stanceLabel} into a soft but stable economy - a supportive backdrop for risk.`,
    },
    ...data.indicators.map((indicator) => ({
      key: indicator.label,
      label: indicator.label,
      value: indicator.value,
      change: indicator.change ? `${indicator.direction ? `${DIR_GLYPH[indicator.direction]} ` : ''}${indicator.change}` : '',
      href: indicator.sourceUrl,
      source: indicator.source,
      implication: indicator.implication,
    })),
    {
      key: 'chart-pack',
      label: data.chartPackLabel,
      value: '',
      change: '',
      href: data.chartPackUrl,
      source: 'RBA',
    },
  ] as { key: string; label: string; value: string; change: string; href?: string; source?: string; implication?: string }[];

  return (
    <div className="intel-marquee terminal-panel glass-hero relative flex items-center overflow-hidden rounded-md">
      {/* Fixed feed title - same treatment as the Intel tape. Dot stays stance-coloured. */}
      <div className="z-20 flex shrink-0 items-center gap-1.5 border-r border-[#1b2530] bg-[#0b1016] px-3 py-1.5">
        <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${STANCE_COLOR[data.stance].dot}`} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8aa2ff]">{data.countryCode} Macro</span>
        {/* Honesty chip. This strip was the ONLY sample surface in the app with no badge -
            a frozen cash rate read as live. 'Partly live' once the hourly snapshot overlays
            AUD/USD + ASX 200 (getMacroContextLive); fully seeded rows stay 'Sample'. */}
        {data.isDemo && (
          <span
            className="rounded border border-[#9a6a1f] bg-[#2a1f0f] px-1 py-px font-mono text-[8px] uppercase tracking-[0.12em] text-[#f3a33a]"
            title={
              data.liveOverlay?.length
                ? `Live: ${data.liveOverlay.join(', ')} (hourly snapshot). Other rows are seeded reference values as of ${data.asOf}.`
                : `Seeded reference values as of ${data.asOf} - live RBA/ABS wiring lands next.`
            }
          >
            {data.liveOverlay?.length ? 'Partly live' : 'Sample'}
          </span>
        )}
      </div>

      {/* Scrolling track (items duplicated for a seamless loop) */}
      <div className="relative min-w-0 flex-1 overflow-hidden py-1.5">
        <div className="macro-track flex w-max items-center">
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
                {item.implication && <span className="text-[11px] text-[#6f7d8a]">- {item.implication}</span>}
                {!item.value && !item.implication && <ArrowUpRight size={11} className="self-center text-[#8190a0]" />}
              </a>
            ) : (
              <span
                key={`${item.key}-${i}`}
                className="inline-flex shrink-0 items-baseline gap-1.5 border-r border-[#1b2530] px-4 font-mono"
              >
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">{item.label}</span>
                {item.value && <span className="text-xs font-semibold text-[#dbe5ee]">{item.value}</span>}
                {item.change && <span className="text-[11px] text-[#8190a0]">{item.change}</span>}
                {item.implication && <span className="text-[11px] text-[#6f7d8a]">- {item.implication}</span>}
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
