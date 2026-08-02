'use client';

import { useState } from 'react';
import { TickerLogo } from '@/components/TickerLogo';
import { SignalDrawer } from '@/components/SignalDrawer';
import { RotatingFaces } from '@/components/RotatingFaces';
import { formatCurrency, formatSignedPercent, toneClass } from '@/lib/format';
import type { SignalRow } from '@/types/scanner';

export interface StripPanel {
  /** Header label, e.g. "Your book", "Watchlist leaders". */
  label: string;
  signals: SignalRow[];
}

/**
 * Executive strip - a rotating feature space across the top of Command. It rolls
 * through panels (Your book -> Watchlist leaders -> Watchlist losers -> Watchlist
 * picks) with the same slot-machine animation as the metric tiles, so one strip
 * carries four reads. Tap any tile for the full signal explainer drawer.
 */
export function ExecutiveStrip({ panels }: { panels: StripPanel[] }) {
  const [selected, setSelected] = useState<SignalRow | null>(null);
  const usable = panels.filter((p) => p.signals.length > 0);
  if (usable.length === 0) return null;

  const faces = usable.map((panel) => (
    <div key={panel.label}>
      <div className="flex items-center justify-between gap-2 px-3 pb-1.5 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{panel.label} · tap a tile</p>
        <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-positive">
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
          As of last scan
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 px-3 pb-2.5">
        {panel.signals.slice(0, 4).map((s) => (
          <button
            key={s.symbol}
            type="button"
            onClick={() => setSelected(s)}
            className="flex min-w-0 flex-col gap-0.5 rounded-cell border border-line bg-panel px-2 py-1.5 text-left transition hover:border-line-hair"
          >
            <div className="flex items-center gap-1">
              <TickerLogo symbol={s.symbol} companyName={s.companyName} size={13} />
              <span className="truncate font-mono text-[11px] font-semibold text-ink">{s.symbol}</span>
            </div>
            <span className="truncate font-mono text-[11px] text-ink-title">{formatCurrency(s.close)}</span>
            <span className={`font-mono text-[10px] ${toneClass(s.priceChange1d)}`}>{formatSignedPercent(s.priceChange1d)}</span>
          </button>
        ))}
      </div>
    </div>
  ));

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <RotatingFaces faces={faces} intervalMs={7500} />
      <SignalDrawer signal={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
