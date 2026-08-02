'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { DetailDrawer } from '@/components/DetailDrawer';
import { relativeTime } from '@/lib/format';
import { SMART_MONEY, type Backer, type SmartMoneyItem } from '@/lib/smart-money';

const BACKER_STYLE: Record<Backer, string> = {
  government: 'border-blue-info/40 bg-blue-tint text-pending',
  'big-tech': 'border-pending/40 bg-pending/10 text-pending',
  'big-ai': 'border-positive/40 bg-positive-tint text-positive',
};
const BACKER_KIND: Record<Backer, string> = { government: 'Gov', 'big-tech': 'Big tech', 'big-ai': 'Big AI' };

/**
 * Smart Money - small caps catching government / big-tech / big-AI money. News-driven, so
 * it sits outside the deterministic engine. Tap a row for the explainer drawer. Sample
 * shape until the live Finnhub-news -> AI-extraction pipeline lands (see lib/smart-money.ts).
 */
export function SmartMoneyCard({ items = SMART_MONEY, live = false }: { items?: SmartMoneyItem[]; live?: boolean }) {
  const [selected, setSelected] = useState<SmartMoneyItem | null>(null);

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Smart money · small caps</p>
          <p className="mt-0.5 text-[10px] text-ink-2">Small caps catching government + big-tech/AI money - news-driven</p>
        </div>
        {live ? (
          <span className="shrink-0 rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-2">As of last scan</span>
        ) : (
          <span className="shrink-0 rounded border border-accent-border bg-accent-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-accent">Sample</span>
        )}
      </div>
      <div className="divide-y divide-line">
        {items.map((item) => (
          <button
            type="button"
            key={`${item.ticker}-${item.backerName}`}
            onClick={() => setSelected(item)}
            className="block w-full px-3 py-2 text-left transition hover:bg-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <TickerLogo symbol={item.ticker} size={16} />
                <span className="font-mono text-sm font-semibold text-ink">{item.ticker}</span>
                <span className="truncate text-[10px] text-ink-3">{item.company}</span>
              </div>
              <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${BACKER_STYLE[item.backer]}`}>
                {BACKER_KIND[item.backer]} · {item.backerName}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-ink-title">{item.catalyst}</p>
            <p className="mt-0.5 font-mono text-[10px] text-ink-3">{relativeTime(item.date)}</p>
          </button>
        ))}
      </div>
      <p className="border-t border-line px-3 py-1.5 font-mono text-[10px] text-ink-dim">
        {live
          ? 'Live: Finnhub news -> AI extraction of small-cap backing events.'
          : 'Illustrative shape. Live next: Finnhub news -> AI extraction of small-cap backing events.'}
      </p>

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.ticker} · ${selected.company}` : ''}
        subtitle={selected ? `Backed by ${selected.backerName}` : ''}
        badge={
          selected ? (
            <span className={`mb-1 inline-block rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${BACKER_STYLE[selected.backer]}`}>
              {BACKER_KIND[selected.backer]} money
            </span>
          ) : undefined
        }
      >
        {selected && (
          <>
            <p className="text-[11px] leading-snug text-ink-2">
              A small cap drawing attention because {selected.backerName} ({BACKER_KIND[selected.backer]}) money or programs are flowing toward it. News-driven, not a price signal - context for your own research.
            </p>
            <div className="rounded-cell border border-line-strong bg-panel p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Catalyst</p>
              <p className="mt-1 text-[12px] leading-snug text-ink-title">{selected.catalyst}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
              <span className="text-ink-3">Backer</span>
              <span className="text-right text-ink-title">{selected.backerName}</span>
              <span className="text-ink-3">Type</span>
              <span className="text-right text-ink-title">{BACKER_KIND[selected.backer]}</span>
              <span className="text-ink-3">Surfaced</span>
              <span className="text-right text-ink-title">{relativeTime(selected.date)}</span>
              <span className="text-ink-3">Source</span>
              <span className="text-right text-ink-title">{selected.source}</span>
            </div>
            <Link
              href={`/tickers/${selected.ticker}`}
              className="inline-flex items-center gap-1 rounded border border-line-strong bg-panel px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-2 transition hover:text-ink"
            >
              Open {selected.ticker} <ArrowUpRight size={12} />
            </Link>
            <p className="text-[10px] leading-4 text-ink-dim">Sample shape. Live backing data wires in via Finnhub news + AI extraction. Research only, not financial advice.</p>
          </>
        )}
      </DetailDrawer>
    </section>
  );
}
