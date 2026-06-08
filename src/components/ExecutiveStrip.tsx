'use client';

import { useState } from 'react';
import { TickerLogo } from '@/components/TickerLogo';
import { SignalDrawer } from '@/components/SignalDrawer';
import { formatCurrency, formatSignedPercent, toneClass } from '@/lib/format';
import type { SignalRow } from '@/types/scanner';

/**
 * Executive strip - a Bloomberg-TV-style row of minimal, real mini-trackers across the
 * top of Command: ticker, price, 1d change, score. Horizontally scrollable; tap a tile
 * for the full signal explainer drawer. Real numbers off the live signal set.
 */
export function ExecutiveStrip({ signals }: { signals: SignalRow[] }) {
  const [selected, setSelected] = useState<SignalRow | null>(null);
  if (signals.length === 0) return null;

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center justify-between gap-2 px-3 pb-1.5 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Your book · tap a tile</p>
        <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#43d18b]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#43d18b]" /> Live
        </span>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2.5">
        {signals.map((s) => (
          <button
            key={s.symbol}
            type="button"
            onClick={() => setSelected(s)}
            className="flex w-[92px] shrink-0 flex-col gap-0.5 rounded-md border border-[#1b2530] bg-[#0d141c] px-2 py-1.5 text-left transition hover:border-[#3a4754]"
          >
            <div className="flex items-center gap-1">
              <TickerLogo symbol={s.symbol} companyName={s.companyName} size={13} />
              <span className="truncate font-mono text-[11px] font-semibold text-[#eef3f8]">{s.symbol}</span>
            </div>
            <span className="font-mono text-[11px] text-[#dbe5ee]">{formatCurrency(s.close)}</span>
            <div className="flex items-center justify-between gap-1">
              <span className={`font-mono text-[10px] ${toneClass(s.priceChange1d)}`}>{formatSignedPercent(s.priceChange1d)}</span>
              <span className="font-mono text-[10px] font-semibold text-[#f3a33a]">{s.score}</span>
            </div>
          </button>
        ))}
      </div>

      <SignalDrawer signal={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
