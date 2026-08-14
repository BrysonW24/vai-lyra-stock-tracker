'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { DashboardData, SignalRow } from '@/types/scanner';
import { TickerLogo } from '@/components/TickerLogo';
import { PortfolioDonut } from '@/components/charts/PortfolioDonut';
import { ChartsTabs } from '@/components/charts/ChartsTabs';
import { buildScoreBreakdown } from '@/lib/score-breakdown';
import { formatCurrency, formatSignedNumber, formatSignedPercent, toneClass } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  loadLocalHoldings,
  PORTFOLIO_CHANGED_EVENT,
} from '@/lib/local-portfolio';
import {
  loadLocalWatchlist,
  WATCHLIST_CHANGED_EVENT,
  type LocalWatchItem,
} from '@/lib/local-watchlist';
import {
  buildLocalPortfolioHoldings,
  buildLocalWatchlistRows,
} from '@/lib/local-dashboard';

/**
 * Real factor card - replaces the fabricated 7-point score sparkline (2026-08-11 audit).
 * The five mini bars ARE the score: each factor's server-computed points as a share of its
 * max (R=RSI, M=MACD, P=price location, T=trend, V=volume), plus the real scan-over-scan
 * delta. Nothing here is interpolated or invented.
 */
function FactorCard({ signal }: { signal: SignalRow }) {
  const factors = buildScoreBreakdown(signal.scoreBreakdown);
  return (
    <Link
      href={`/tickers/${signal.symbol}`}
      className="flex min-w-0 flex-col gap-1.5 rounded-cell border border-line bg-panel p-2 transition hover:border-line-hair"
    >
      <div className="flex items-center gap-1.5">
        <TickerLogo symbol={signal.symbol} companyName={signal.companyName} size={14} />
        <span className="truncate font-mono text-[11px] font-semibold text-ink">{signal.symbol}</span>
        <span className={`ml-auto shrink-0 font-mono text-[10px] tabular-nums ${toneClass(signal.scoreDelta)}`}>
          {signal.score} {formatSignedNumber(signal.scoreDelta, 0)}
        </span>
      </div>
      <div className="flex h-7 items-end gap-1" title={factors.map((f) => `${f.label} ${f.value}/${f.max}`).join(' · ')}>
        {factors.map((f) => (
          <div key={f.key} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
            <div className="flex h-5 w-full items-end overflow-hidden rounded-[2px] bg-line/60">
              <div
                className={`w-full ${f.pct >= 66 ? 'bg-positive' : f.pct >= 33 ? 'bg-accent' : 'bg-negative/70'}`}
                style={{ height: `${Math.max(6, f.pct)}%` }}
              />
            </div>
            <span className="font-mono text-[8px] leading-none text-ink-dim">{f.label.charAt(0)}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

/**
 * Charts hub - a dedicated, RBA-chart-pack-style visual space. The Portfolio tab condenses
 * everything you own + watch (composition donut, sector exposure, score factor walls);
 * the Economy / Markets / Commodities tabs give the macro backdrop. This component builds
 * the Portfolio tab from real data and hands the rest to ChartsTabs. Research only.
 */
export function ChartsView({ data }: { data: DashboardData }) {
  const soloMode = !isSupabaseConfigured();
  const [personalData, setPersonalData] = useState(data);
  const [localWatchlist, setLocalWatchlist] = useState<LocalWatchItem[]>([]);

  useEffect(() => {
    if (!soloMode) return;
    const refresh = () => {
      const localWatchItems = loadLocalWatchlist();
      setLocalWatchlist(localWatchItems);
      setPersonalData({
        ...data,
        portfolio: buildLocalPortfolioHoldings(
          loadLocalHoldings(),
          data.signals,
        ),
        watchlist: buildLocalWatchlistRows(
          localWatchItems,
          data.signals,
        ),
      });
    };
    refresh();
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, refresh);
    window.addEventListener(WATCHLIST_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(PORTFOLIO_CHANGED_EVENT, refresh);
      window.removeEventListener(WATCHLIST_CHANGED_EVENT, refresh);
    };
  }, [data, soloMode]);

  const activeData = soloMode ? personalData : data;
  const sigBySymbol = useMemo(
    () => new Map(activeData.signals.map((s) => [s.symbol, s])),
    [activeData.signals],
  );

  // Finite guards: unscanned Solo rows carry NaN market fields (2026-08-14 audit).
  const priced = activeData.portfolio.filter((h) => Number.isFinite(h.marketValue));
  const bookValue = priced.reduce((sum, h) => sum + h.marketValue, 0);
  const bookPnl = priced.reduce((sum, h) => sum + h.unrealisedPnl, 0);
  // TRUE book return from cost basis - the old market-value-weighted average of
  // per-holding percents overstated the book (winners gain weight as they rise; a flat
  // book could read +50%), disagreeing with the $ figure beside it (2026-08-14 audit).
  const bookCost = priced.reduce((sum, h) => sum + (Number.isFinite(h.unrealisedPnlPercent) && 1 + h.unrealisedPnlPercent / 100 !== 0 ? h.marketValue / (1 + h.unrealisedPnlPercent / 100) : 0), 0);
  const bookPnlPct = bookCost > 0 ? (bookPnl / bookCost) * 100 : 0;
  const pnlTone = bookPnl >= 0 ? 'text-positive' : 'text-negative';

  const donutSlices = priced.map((h) => ({ label: h.symbol, value: h.marketValue }));

  const sectorOf = new Map(activeData.tickers.map((t) => [t.symbol, t.sector]));
  const sectorTotals = new Map<string, number>();
  for (const h of activeData.portfolio) {
    const sector = sectorOf.get(h.symbol) ?? 'Other';
    if (!Number.isFinite(h.marketValue)) continue;
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + h.marketValue);
  }
  const sectors = [...sectorTotals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const sectorTotal = sectors.reduce((sum, s) => sum + s.value, 0) || 1;

  const holdingSignals = activeData.portfolio.map((h) => sigBySymbol.get(h.symbol)).filter((s): s is SignalRow => Boolean(s));
  const watchSignals = (soloMode ? localWatchlist : activeData.watchlist)
    .map((w) => sigBySymbol.get(w.symbol))
    .filter((s): s is SignalRow => Boolean(s));
  const watchedCount = soloMode
    ? localWatchlist.length
    : activeData.watchlist.length;

  const portfolio = (
    <div className="space-y-3">
      <section className="terminal-panel space-y-3 rounded-panel p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Your picture</p>
          <p className="font-mono text-[11px] text-ink-3">
            Book <span className="text-ink">{formatCurrency(bookValue)}</span> ·{' '}
            <span className={pnlTone}>{formatCurrency(bookPnl)} {formatSignedPercent(bookPnlPct)}</span> · {activeData.portfolio.length} holdings · {watchedCount} watched
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Composition</p>
            <PortfolioDonut slices={donutSlices} />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Sector exposure</p>
            {sectors.length > 0 ? (
              <div className="space-y-1.5">
                {sectors.map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="truncate text-ink-2">{s.label}</span>
                      <span className="text-ink-3">{Math.round((s.value / sectorTotal) * 100)}%</span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-sm bg-line">
                      <div className="h-full rounded-sm bg-gradient-to-r from-blue-deep to-positive" style={{ width: `${(s.value / sectorTotal) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-ink-3">Add holdings to see your sector mix.</p>
            )}
          </div>
        </div>
      </section>

      {holdingSignals.length > 0 && (
        <section className="terminal-panel rounded-panel p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Holdings - score factors</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {holdingSignals.map((s) => (
              <FactorCard key={s.symbol} signal={s} />
            ))}
          </div>
        </section>
      )}

      {watchSignals.length > 0 && (
        <section className="terminal-panel rounded-panel p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Watchlist - score factors</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {watchSignals.map((s) => (
              <FactorCard key={s.symbol} signal={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return <ChartsTabs portfolio={portfolio} pageMode={data.mode} />;
}
