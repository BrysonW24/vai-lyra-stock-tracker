'use client';

import { MarketUniverseSelection, MARKET_CATEGORIES, MarketCategory } from '@/lib/onboarding';

// Lyra brand gradient sampled across the sector grid: blue -> cyan -> green ->
// yellow -> orange, so the coverage reads as one gradient sweep. Artistic gradient
// (allowed per TOKENS.md); its anchor stops are the token values of blue-focus,
// positive and accent, with two interpolated midpoints. Numeric RGB is required
// for the runtime rgba() interpolation below.
const GRAD_STOPS: { p: number; c: [number, number, number] }[] = [
  { p: 0, c: [96, 165, 250] },
  { p: 0.25, c: [79, 209, 217] },
  { p: 0.5, c: [67, 209, 139] },
  { p: 0.75, c: [255, 206, 138] },
  { p: 1, c: [243, 163, 58] },
];

function gradientRGB(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < GRAD_STOPS.length; i++) {
    const a = GRAD_STOPS[i - 1];
    const b = GRAD_STOPS[i];
    if (x <= b.p) {
      const f = (x - a.p) / (b.p - a.p);
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * f),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * f),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * f),
      ];
    }
  }
  return GRAD_STOPS[GRAD_STOPS.length - 1].c;
}

interface MarketUniverseSelectorProps {
  selection: MarketUniverseSelection;
  onChange: (selection: MarketUniverseSelection) => void;
  onNext: () => void;
}

/**
 * "Your market universe" - a read-only statement, not a choice. Lyra's hourly scan
 * covers a fixed ~100-name US (NASDAQ/NYSE) tech universe - no ASX rows, no ETFs
 * (workers/stock_scanner/universe.py; the old "US + ASX equities and ETFs" copy
 * overclaimed coverage, 2026-08-14 audit). The names the user actually cares about
 * are captured in the portfolio + watchlist steps (any ticker, fetched live on demand).
 */
export function MarketUniverseSelector({ onNext }: MarketUniverseSelectorProps) {
  const categories = Object.entries(MARKET_CATEGORIES) as [MarketCategory, (typeof MARKET_CATEGORIES)[MarketCategory]][];

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-snug text-ink-2">
        Lyra continuously scans ~100 top US (NASDAQ/NYSE) tech names - hourly. Next you&apos;ll add the names that are
        actually yours - any ticker, US or ASX, fetched live on demand.
      </p>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Sectors covered</h3>
          <span className="font-mono text-[10px] text-ink-3">{categories.length} sectors · always on</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {categories.map(([key, data], i) => {
            const [r, g, b] = gradientRGB(categories.length > 1 ? i / (categories.length - 1) : 0);
            return (
              <div
                key={key}
                title={`${data.label} · ${data.tickers.length} names`}
                className="flex items-center justify-between gap-2 rounded-cell border px-2.5 py-1.5"
                style={{
                  borderColor: `rgba(${r}, ${g}, ${b}, 0.4)`,
                  color: `rgb(${r}, ${g}, ${b})`,
                  backgroundColor: `rgba(${r}, ${g}, ${b}, 0.08)`,
                }}
              >
                <span className="truncate text-[12px] font-medium leading-tight">{data.label}</span>
                <span className="shrink-0 font-mono text-[10px] opacity-70">{data.tickers.length}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] leading-snug text-ink-dim">
        <span className="font-semibold text-ink-3">How it works:</span> ~100 of the top US (NASDAQ/NYSE) tech names are
        scanned hourly out of the box. Anything else you add - your holdings or watchlist, US or ASX - is fetched live on
        demand via Lyra&apos;s market API, not scanned hourly.
      </p>

      <button
        onClick={onNext}
        className="min-h-[44px] w-full rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
      >
        Continue
      </button>
    </div>
  );
}
