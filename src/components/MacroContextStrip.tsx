'use client';

import { ArrowUpRight } from 'lucide-react';
import type { DeltaDirection, MacroSnapshot, MacroStance } from '@/lib/macro-context';

const STANCE_COLOR: Record<MacroStance, { text: string; dot: string }> = {
  easing: { text: 'text-blue-focus', dot: 'bg-blue-focus' },
  hold: { text: 'text-ink-2', dot: 'bg-ink-2' },
  tightening: { text: 'text-negative', dot: 'bg-negative' },
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
      // No editorial judgement hardcoded here: the strip states the stance and lets each
      // indicator carry its own note - "a supportive backdrop for risk" was an authored
      // opinion that would survive any data change (2026-08-11 audit).
      implication: `${data.stanceLabel}. Each indicator carries its own read below.`,
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
    <div className="intel-marquee terminal-panel glass-hero relative flex items-center overflow-hidden rounded-panel">
      {/* Fixed feed title - same treatment as the Intel tape. Dot stays stance-coloured. */}
      <div className="z-20 flex shrink-0 items-center gap-1.5 border-r border-line bg-chrome px-3 py-1.5">
        <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${STANCE_COLOR[data.stance].dot}`} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-pending">{data.countryCode} Macro</span>
        {/* Honesty chip. This strip was the ONLY sample surface in the app with no badge -
            a frozen cash rate read as live. 'Partly live' once the hourly snapshot overlays
            AUD/USD + ASX 200 (getMacroContextLive); fully seeded rows stay 'Sample'. */}
        {data.isDemo && (
          <span
            className="rounded border border-accent-border bg-accent-tint px-1 py-px font-mono text-[8px] uppercase tracking-[0.12em] text-accent"
            title={
              data.liveOverlay?.length
                ? `Live: ${data.liveOverlay.join(', ')} (hourly snapshot). Other rows are seeded reference values as of ${data.asOf}.`
                : `Seeded reference values as of ${data.asOf} - live RBA/ABS wiring lands next.`
            }
          >
            {data.liveOverlay?.length ? 'Partial' : 'Sample'}
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
                className="inline-flex shrink-0 items-baseline gap-1.5 border-r border-line px-4 font-mono transition hover:bg-line/30"
              >
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{item.label}</span>
                {item.value && <span className="text-xs font-semibold text-ink-title">{item.value}</span>}
                {item.change && <span className="text-[11px] text-ink-3">{item.change}</span>}
                {item.implication && <span className="text-[11px] text-ink-dim">- {item.implication}</span>}
                {!item.value && !item.implication && <ArrowUpRight size={11} className="self-center text-ink-3" />}
              </a>
            ) : (
              <span
                key={`${item.key}-${i}`}
                className="inline-flex shrink-0 items-baseline gap-1.5 border-r border-line px-4 font-mono"
              >
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{item.label}</span>
                {item.value && <span className="text-xs font-semibold text-ink-title">{item.value}</span>}
                {item.change && <span className="text-[11px] text-ink-3">{item.change}</span>}
                {item.implication && <span className="text-[11px] text-ink-dim">- {item.implication}</span>}
              </span>
            ),
          )}
        </div>
        {/* Right edge fade */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-chrome to-transparent" />
      </div>
    </div>
  );
}
