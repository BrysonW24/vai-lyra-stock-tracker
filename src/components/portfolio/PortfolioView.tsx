'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { AddHoldingForm } from '@/components/portfolio/AddHoldingForm';
import { TickerLogo } from '@/components/TickerLogo';
import type { DashboardData, PortfolioHolding } from '@/types/scanner';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, toneClass } from '@/lib/format';
import { cgtBadgeClass, cgtStatusFor } from '@/lib/cgt';
import { loadLocalHoldings, removeLocalHolding, PORTFOLIO_CHANGED_EVENT } from '@/lib/local-portfolio';
import { buildLocalPortfolioHoldings } from '@/lib/local-dashboard';
import { isSupabaseConfigured } from '@/lib/supabase/client';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Format an ISO YYYY-MM-DD purchase date as a short "5 Jun" label. */
function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  if (!m || !d) return iso;
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}`;
}

/** Fractional shares are valid; never round a real position down to the visually-false "0". */
function formatQuantity(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/**
 * Client portfolio view. In demo mode it overlays the user's locally-saved holdings
 * (from onboarding / Add-holding) on top of the static demo book so what they entered
 * actually shows up. In Supabase mode it just renders the server-provided holdings.
 */
export function PortfolioView({ data }: { data: DashboardData }) {
  const router = useRouter();
  const demo = data.generatedFrom !== 'supabase';
  // Prefer the explicit mode (audit V2) over re-deriving Solo from isSupabaseConfigured(): 'solo'
  // and 'supabase' are authoritative. Only the demo fallback (a no-keys or configured-but-erroring
  // deploy) still consults isSupabaseConfigured(), preserving existing behavior for that case.
  const soloMode =
    data.mode === 'solo' ? true : data.mode === 'supabase' ? false : !isSupabaseConfigured();
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(data.portfolio);
  const [lastTrade, setLastTrade] = useState('-');
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  // Client-side clock for CGT badges; set after mount to keep SSR/CSR markup identical.
  const [todayIso, setTodayIso] = useState('');
  useEffect(() => {
    setTodayIso(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    function sync() {
      const local = loadLocalHoldings();
      // Solo's local book is authoritative even when it is empty. Falling back to the sample
      // portfolio after a user removes/undoes their final holding makes fictitious positions
      // reappear and then leak into the AI's answer.
      const activeHoldings = soloMode
        ? buildLocalPortfolioHoldings(local, data.signals)
        : demo && local.length > 0
          ? buildLocalPortfolioHoldings(local, data.signals)
          : data.portfolio;
      setHoldings(activeHoldings);
      const dates = activeHoldings.map((h) => h.purchaseDate).filter((d): d is string => Boolean(d)).sort();
      setLastTrade(dates.length ? formatShortDate(dates[dates.length - 1]) : '-');
    }
    sync();
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PORTFOLIO_CHANGED_EVENT, sync);
  }, [demo, soloMode, data.portfolio, data.signals]);

  // Per-row remove (audit V4 fix - the page used to have no remove/edit affordance, so a Supabase
  // user who fat-fingered a holding could not correct it here). A row with a DB id is an
  // account-backed holding -> DELETE /api/portfolio by id; otherwise it is a browser-local Solo/demo
  // row -> removeLocalHolding(symbol), which fires PORTFOLIO_CHANGED_EVENT and the sync effect re-reads.
  async function handleRemove(holding: PortfolioHolding) {
    setRemoveError(null);
    setRemoving(holding.symbol);
    try {
      if (holding.id) {
        const res = await fetch('/api/portfolio', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: holding.id }),
        });
        const result = (await res.json()) as { ok: boolean; error?: string };
        if (!result.ok) {
          setRemoveError(result.error || `Could not remove ${holding.symbol}. Try again.`);
          return;
        }
        setHoldings((prev) => prev.filter((h) => h.id !== holding.id));
        router.refresh();
      } else {
        const ok = removeLocalHolding(holding.symbol);
        if (!ok) {
          setRemoveError(`Could not remove ${holding.symbol} on this device.`);
          return;
        }
        // The change event triggers sync(); reflect it immediately too so the row disappears at once.
        setHoldings((prev) => prev.filter((h) => h.symbol !== holding.symbol));
      }
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : `Could not remove ${holding.symbol}.`);
    } finally {
      setRemoving(null);
    }
  }

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

          {removeError && (
            <p className="border-b border-[#5a1f1f] bg-[#2b0f0f] px-3 py-2 font-mono text-[11px] text-[#ff6b6b]">
              {removeError}
            </p>
          )}

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
                      <th className="px-3 py-2">Held</th>
                      <th className="px-3 py-2">Signal</th>
                      <th className="px-3 py-2">RSI</th>
                      <th className="px-3 py-2">MACD</th>
                      <th className="px-3 py-2">Risk</th>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2 text-right"><span className="sr-only">Remove</span></th>
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
                        <td className="px-3 py-2">{formatQuantity(holding.quantity)}</td>
                        <td className="px-3 py-2">{formatCurrency(holding.averagePrice)}</td>
                        <td className="px-3 py-2">{formatCurrency(holding.currentPrice)}</td>
                        <td className="px-3 py-2">{formatCurrency(holding.marketValue)}</td>
                        <td className={`px-3 py-2 ${toneClass(holding.unrealisedPnl)}`}>
                          {formatCurrency(holding.unrealisedPnl)} / {formatPercent(holding.unrealisedPnlPercent)}
                        </td>
                        <td className="px-3 py-2">{formatPercent(holding.portfolioWeight)}</td>
                        <td className="px-3 py-2">
                          {(() => {
                            const cgt = cgtStatusFor(holding.purchaseDate, todayIso);
                            if (!cgt) return <span className="text-[#5e6b78]">-</span>;
                            return (
                              <span
                                className={`inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${cgtBadgeClass(cgt.state)}`}
                                title="Australian CGT applies a 50% discount to gains on assets held over 12 months. Date math from your records. General information, not tax advice."
                              >
                                {cgt.label}
                              </span>
                            );
                          })()}
                        </td>
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
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemove(holding)}
                            disabled={removing === holding.symbol}
                            title={`Remove ${holding.symbol} from your book`}
                            aria-label={`Remove ${holding.symbol}`}
                            className="inline-grid h-8 w-8 place-items-center rounded text-[#6f7d8a] transition hover:bg-[#2b0f0f] hover:text-[#ff6b6b] disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-[#1b2530] md:hidden">
                {holdings.map((holding) => (
                  <div className="relative" key={holding.symbol}>
                    <Link href={`/tickers/${holding.symbol}`} className="block px-3 py-2.5 pr-12">
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
                          {(() => {
                            const cgt = cgtStatusFor(holding.purchaseDate, todayIso);
                            // Mobile keeps only the states worth a glance - quiet while building.
                            if (!cgt || cgt.state === 'building') return null;
                            return (
                              <p className={`mt-0.5 inline-block rounded border px-1 py-px text-[9px] uppercase tracking-[0.08em] ${cgtBadgeClass(cgt.state)}`}>
                                {cgt.label}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRemove(holding)}
                      disabled={removing === holding.symbol}
                      aria-label={`Remove ${holding.symbol}`}
                      className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded text-[#6f7d8a] transition hover:bg-[#2b0f0f] hover:text-[#ff6b6b] disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
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
