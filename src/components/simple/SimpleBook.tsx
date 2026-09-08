'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DashboardData, PortfolioHolding } from '@/types/scanner';
import { formatCurrency, formatSignedPercent, toneClass } from '@/lib/format';
import { loadLocalHoldings, PORTFOLIO_CHANGED_EVENT } from '@/lib/local-portfolio';
import { buildLocalPortfolioHoldings } from '@/lib/local-dashboard';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { TickerLogo } from '@/components/TickerLogo';
import { SimpleEmpty } from '@/components/simple/SimpleSection';

/**
 * "Your book" in Simple view: what you own, what it is worth, and what each name is
 * doing. No donut, no sparkline, no sector split - the founder asked for no charts, and
 * a list of five rows answers "how am I doing" faster than a chart does anyway.
 *
 * Solo keeps holdings in this browser, so this is a client component that layers local
 * holdings exactly as PortfolioView does. Unscanned rows render '-' (they carry NaN by
 * contract) rather than echoing your own buy price back as a market price.
 */
export function SimpleBook({ data }: { data: DashboardData }) {
  const soloMode =
    data.mode === 'solo' ? true : data.mode === 'supabase' ? false : !isSupabaseConfigured();
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(data.portfolio);

  useEffect(() => {
    function sync() {
      const local = loadLocalHoldings();
      setHoldings(
        soloMode || (data.generatedFrom !== 'supabase' && local.length > 0)
          ? buildLocalPortfolioHoldings(local, data.signals)
          : data.portfolio,
      );
    }
    sync();
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PORTFOLIO_CHANGED_EVENT, sync);
  }, [soloMode, data.portfolio, data.signals, data.generatedFrom]);

  if (holdings.length === 0) {
    return (
      <SimpleEmpty>
        No holdings yet.{' '}
        <Link href="/onboarding?beat=holdings" className="text-accent underline-offset-2 hover:underline">
          Add what you own
        </Link>{' '}
        and this becomes your book.
      </SimpleEmpty>
    );
  }

  // Finite guards: unscanned rows carry NaN market fields by contract (2026-08-14 audit).
  const priced = holdings.filter((h) => Number.isFinite(h.marketValue));
  const totalValue = priced.reduce((sum, h) => sum + h.marketValue, 0);
  const totalPnl = priced.reduce((sum, h) => sum + h.unrealisedPnl, 0);
  const cost = priced.reduce(
    (sum, h) =>
      sum + (Number.isFinite(h.unrealisedPnlPercent) ? h.marketValue / (1 + h.unrealisedPnlPercent / 100) : 0),
    0,
  );
  const totalPct = cost > 0 ? (totalPnl / cost) * 100 : Number.NaN;
  const shown = [...holdings].sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0)).slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-2xl font-semibold tabular-nums text-ink-title">
          {formatCurrency(totalValue)}
        </span>
        <span className={`font-mono text-[13px] tabular-nums ${toneClass(totalPnl)}`}>
          {formatCurrency(totalPnl)} {Number.isFinite(totalPct) ? `(${formatSignedPercent(totalPct)})` : ''}
        </span>
        <span className="text-[12px] text-ink-3">
          {holdings.length} {holdings.length === 1 ? 'holding' : 'holdings'}
        </span>
      </div>

      <ul className="divide-y divide-line/70">
        {shown.map((h) => (
          <li key={h.symbol}>
            <Link
              href={`/tickers/${h.symbol}`}
              className="-mx-1 flex items-center gap-2.5 rounded px-1 py-2 transition hover:bg-panel/60"
            >
              <TickerLogo symbol={h.symbol} companyName={h.symbol} size={22} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[13px] font-semibold text-ink">{h.symbol}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {h.scanned === false ? 'Not scanned - outside the hourly universe' : h.suggestedAction}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-[13px] tabular-nums text-ink-title">
                  {formatCurrency(h.marketValue)}
                </span>
                <span className={`block font-mono text-[11px] tabular-nums ${toneClass(h.unrealisedPnl)}`}>
                  {formatSignedPercent(h.unrealisedPnlPercent)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {holdings.length > shown.length && (
        <p className="text-[11px] text-ink-dim">
          +{holdings.length - shown.length} more in your portfolio
        </p>
      )}
    </div>
  );
}
