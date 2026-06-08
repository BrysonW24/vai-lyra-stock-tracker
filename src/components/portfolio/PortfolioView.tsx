'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Plus } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { AddHoldingForm } from '@/components/portfolio/AddHoldingForm';
import { TickerLogo } from '@/components/TickerLogo';
import type { ActionState, DashboardData, PortfolioHolding, SignalRow, SignalStatus } from '@/types/scanner';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, toneClass } from '@/lib/format';
import { loadLocalHoldings, PORTFOLIO_CHANGED_EVENT, type LocalHolding } from '@/lib/local-portfolio';

/** Build display holdings from the user's local book, pricing each off the live signal set. */
function buildFromLocal(local: LocalHolding[], signals: SignalRow[]): PortfolioHolding[] {
  const sig = new Map(signals.map((s) => [s.symbol, s]));
  const rows = local.map((h) => {
    const s = sig.get(h.symbol);
    const currentPrice = s && s.close > 0 ? s.close : h.averageBuyPrice;
    const cost = h.averageBuyPrice * h.quantity;
    const marketValue = currentPrice * h.quantity;
    const unrealisedPnl = marketValue - cost;
    const unrealisedPnlPercent = cost > 0 ? (unrealisedPnl / cost) * 100 : 0;
    return { h, s, currentPrice, marketValue, unrealisedPnl, unrealisedPnlPercent };
  });
  const totalValue = rows.reduce((sum, r) => sum + r.marketValue, 0);
  return rows.map(({ h, s, currentPrice, marketValue, unrealisedPnl, unrealisedPnlPercent }) => ({
    symbol: h.symbol,
    quantity: h.quantity,
    averagePrice: h.averageBuyPrice,
    currentPrice,
    marketValue,
    unrealisedPnl,
    unrealisedPnlPercent,
    portfolioWeight: totalValue > 0 ? (marketValue / totalValue) * 100 : 0,
    signalScore: s?.score ?? 0,
    scoreDelta: s?.scoreDelta ?? 0,
    signalStatus: (s?.status ?? 'no_signal') as SignalStatus,
    actionState: (s?.actionState ?? 'hold') as ActionState,
    rsi: s?.rsi ?? 0,
    macdState: s?.macdState ?? 'Tracked',
    riskState: 'neutral' as PortfolioHolding['riskState'],
    suggestedAction: 'Hold',
    explanation: { action: (s?.actionState ?? 'hold') as ActionState, triggeredBecause: [], missingConfirmation: [], riskNotes: [] },
  }));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Format an ISO YYYY-MM-DD purchase date as a short "5 Jun" label. */
function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  if (!m || !d) return iso;
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}`;
}

/**
 * Client portfolio view. In demo mode it overlays the user's locally-saved holdings
 * (from onboarding / Add-holding) on top of the static demo book so what they entered
 * actually shows up. In Supabase mode it just renders the server-provided holdings.
 */
export function PortfolioView({ data }: { data: DashboardData }) {
  const demo = data.generatedFrom !== 'supabase';
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(data.portfolio);
  const [lastTrade, setLastTrade] = useState('-');

  useEffect(() => {
    function sync() {
      const local = loadLocalHoldings();
      setHoldings(demo && local.length > 0 ? buildFromLocal(local, data.signals) : data.portfolio);
      const dates = local.map((h) => h.purchaseDate).filter((d): d is string => Boolean(d)).sort();
      setLastTrade(dates.length ? formatShortDate(dates[dates.length - 1]) : '-');
    }
    sync();
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PORTFOLIO_CHANGED_EVENT, sync);
  }, [demo, data.portfolio, data.signals]);

  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalPnl = holdings.reduce((sum, h) => sum + h.unrealisedPnl, 0);
  const costBasis = holdings.reduce((sum, h) => sum + h.averagePrice * h.quantity, 0);
  const dailyRisk = holdings.filter((h) => ['elevated_risk', 'invalidated', 'overextended'].includes(h.riskState)).length;
  const strongInHoldings = holdings.filter((h) => h.signalStatus === 'strong_setup').length;

  // Layout: 2 headline boxes on top, then two rows of 3 - all labels a user understands.
  const topStats: Array<[string, string, string]> = [
    ['Total value', formatCurrency(totalValue), 'text-[#eef3f8]'],
    ['Unrealised P/L', formatCurrency(totalPnl), totalPnl >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'],
  ];
  const gridStats: Array<[string, string, string]> = [
    ['Holdings', formatNumber(holdings.length, 0), 'text-[#eef3f8]'],
    ['Strong', formatNumber(strongInHoldings, 0), 'text-[#43d18b]'],
    ['Risky', formatNumber(dailyRisk, 0), dailyRisk > 0 ? 'text-[#ff6b6b]' : 'text-[#8190a0]'],
    ['Cost basis', formatCurrency(costBasis), 'text-[#a8b5c2]'],
    ['Last trade', lastTrade, 'text-[#a8b5c2]'],
    ['Last scan', data.latestRun.timeframe.toUpperCase(), 'text-[#a8b5c2]'],
  ];

  return (
    <div className="space-y-3 pb-28 xl:pb-6">
      <div className="space-y-2">
        <section className="grid grid-cols-2 gap-1.5">
          {topStats.map(([label, value, tone]) => (
            <div className="terminal-panel rounded-md p-2" key={label}>
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
              <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
            </div>
          ))}
        </section>
        <section className="grid grid-cols-3 gap-1.5">
          {gridStats.map(([label, value, tone]) => (
            <div className="terminal-panel rounded-md p-2" key={label}>
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
              <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <div className="terminal-panel overflow-hidden rounded-md">
          <div className="border-b border-[#1b2530] px-3 py-3">
            <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Portfolio holdings</h1>
            <p className="mt-1 font-mono text-xs text-[#8190a0]">Values, risk states, and action states are middleware overlay outputs.</p>
          </div>

          {holdings.length === 0 ? (
            <p className="px-3 py-6 text-center font-mono text-xs text-[#8190a0]">
              No holdings yet. Add one on the right to populate your book.
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[1180px] text-left text-xs">
                  <thead className="bg-[#0b1016] font-mono uppercase text-[#8190a0]">
                    <tr>
                      <th className="px-3 py-2">Ticker</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Avg Price</th>
                      <th className="px-3 py-2">Current</th>
                      <th className="px-3 py-2">Market Value</th>
                      <th className="px-3 py-2">Unrealised P/L</th>
                      <th className="px-3 py-2">Weight</th>
                      <th className="px-3 py-2">Signal</th>
                      <th className="px-3 py-2">RSI</th>
                      <th className="px-3 py-2">MACD</th>
                      <th className="px-3 py-2">Risk</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1b2530]">
                    {holdings.map((holding) => (
                      <tr className="font-mono text-[#dbe5ee] hover:bg-[#101720]" key={holding.symbol}>
                        <td className="px-3 py-2 font-semibold text-[#eef3f8]">
                          <Link href={`/tickers/${holding.symbol}`} className="inline-flex items-center gap-1.5">
                            <TickerLogo symbol={holding.symbol} size={16} />
                            {holding.symbol} <ArrowUpRight size={11} />
                          </Link>
                        </td>
                        <td className="px-3 py-2">{formatNumber(holding.quantity, 0)}</td>
                        <td className="px-3 py-2">{formatCurrency(holding.averagePrice)}</td>
                        <td className="px-3 py-2">{formatCurrency(holding.currentPrice)}</td>
                        <td className="px-3 py-2">{formatCurrency(holding.marketValue)}</td>
                        <td className={`px-3 py-2 ${toneClass(holding.unrealisedPnl)}`}>
                          {formatCurrency(holding.unrealisedPnl)} / {formatPercent(holding.unrealisedPnlPercent)}
                        </td>
                        <td className="px-3 py-2">{formatPercent(holding.portfolioWeight)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span>{holding.signalScore} <span className={toneClass(holding.scoreDelta)}>{formatSignedNumber(holding.scoreDelta, 0)}</span></span>
                            <StatusBadge status={holding.signalStatus} />
                          </div>
                        </td>
                        <td className="px-3 py-2">{formatNumber(holding.rsi)}</td>
                        <td className="px-3 py-2">{holding.macdState}</td>
                        <td className="px-3 py-2">{holding.riskState.replaceAll('_', ' ')}</td>
                        <td className="px-3 py-2 text-[#f3a33a]">{holding.actionState.replaceAll('_', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-[#1b2530] md:hidden">
                {holdings.map((holding) => (
                  <Link href={`/tickers/${holding.symbol}`} className="block px-3 py-2.5" key={holding.symbol}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <TickerLogo symbol={holding.symbol} size={20} />
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold">{holding.symbol}</p>
                          <p className="truncate font-mono text-[10px] text-[#8190a0]">{formatCurrency(holding.marketValue)} | {formatPercent(holding.portfolioWeight)}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-mono">
                        <p className={`text-sm ${toneClass(holding.unrealisedPnl)}`}>{formatPercent(holding.unrealisedPnlPercent)}</p>
                        <p className="text-[10px] text-[#f3a33a]">{holding.actionState.replaceAll('_', ' ')}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="space-y-3">
          <section className="terminal-panel rounded-md p-3">
            <div className="flex items-center gap-2">
              <Plus className="text-[#f3a33a]" size={16} />
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Add holding</h2>
            </div>
            <div className="mt-3">
              <AddHoldingForm />
            </div>
          </section>

          {holdings.length > 0 && (
            <section className="terminal-panel rounded-md p-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Portfolio signal overlay</h2>
              <div className="mt-3 space-y-3">
                {holdings.map((holding) => (
                  <div className="border-b border-[#1b2530] pb-3 last:border-b-0 last:pb-0" key={holding.symbol}>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="font-semibold text-[#eef3f8]">{holding.symbol}</span>
                      <span className="text-[#f3a33a]">{holding.suggestedAction}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#a8b5c2]">{holding.explanation.riskNotes[0] ?? holding.riskState.replaceAll('_', ' ')}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>
    </div>
  );
}
