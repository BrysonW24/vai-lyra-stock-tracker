import Link from 'next/link';
import { ArrowUpRight, BellPlus } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { AddWatchRuleForm } from '@/components/watchlist/AddWatchRuleForm';
import {
  LocalWatchRules,
  SoloWatchlistMetrics,
} from '@/components/watchlist/LocalWatchRules';
import { TickerLogo } from '@/components/TickerLogo';
import { getDashboardData } from '@/lib/data';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, toneClass } from '@/lib/format';
import { pageTitleClass } from '@/lib/ui';

export const metadata = { title: 'Watchlist' };

export default async function WatchlistPage() {
  const data = await getDashboardData();
  const soloMode = !(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  // Static demo watchlist rows are a market showcase, not this Solo user's
  // watchlist. Never present them as personal data in the accountless build.
  const watchlist = soloMode ? [] : data.watchlist;
  const approaching = watchlist.filter((item) => item.triggerState === 'approaching').length;
  const triggered = watchlist.filter((item) => item.triggerState === 'triggered').length;
  const bestScore = Math.max(...watchlist.map((item) => item.signalScore), 0);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        {soloMode ? (
          <SoloWatchlistMetrics signals={data.signals} />
        ) : (
        <section className="grid grid-cols-3 gap-1.5 md:grid-cols-4 xl:grid-cols-6">
          {[
            ['Watching', watchlist.length.toString(), 'text-ink'],
            ['Approaching', approaching.toString(), 'text-accent'],
            ['Triggered', triggered.toString(), triggered > 0 ? 'text-positive' : 'text-ink-3'],
            ['Best setup', bestScore.toString(), 'text-ink'],
            ['Tracked', data.latestRun.watchlistOverlaysCreated.toString(), 'text-blue-focus'],
            // Engine truth from the latest run - this tile used to hardcode 'Off', which was
            // simply false for anyone with alerts configured.
            ['Alerts sent', data.latestRun.alertsSent.toString(), data.latestRun.alertsSent > 0 ? 'text-positive' : 'text-ink-3'],
          ].map(([label, value, tone]) => (
            <div className="terminal-panel rounded-cell p-2" key={label}>
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
              <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
            </div>
          ))}
        </section>
        )}

        {soloMode && <LocalWatchRules showEmpty />}

        <section className="grid gap-3 xl:grid-cols-[1fr_360px]">
          <div className="terminal-panel overflow-hidden rounded-panel">
            <div className="border-b border-line px-3 py-3">
              <h1 className={pageTitleClass}>Watchlist triggers</h1>
              {/* Desktop: help copy always visible. Mobile: collapsed behind a native
                  <details> so six lines of explanation stop pushing the list below the fold. */}
              <p className="mt-1 hidden text-[11px] leading-relaxed text-ink-3 md:block">
                <span className="font-semibold text-ink-2">Setup score (0-100)</span> = how strongly each name reads as a beaten-down stock showing an early turn, from five signals: RSI in the reset band + an improving (still-negative) MACD histogram + price near its 60-day low + trend + volume. <span className="text-positive">60+</span> = watchlist-worthy, <span className="text-accent">75+</span> = alert. Higher means a clearer early-turn setup - not buying strength, and not a price target or fundamentals rating. Recomputed hourly.
              </p>
              <details className="mt-1 md:hidden">
                <summary className="cursor-pointer list-none py-1 font-mono text-[11px] text-blue-info">What does the setup score mean?</summary>
                <p className="pb-1 text-[11px] leading-relaxed text-ink-3">
                  <span className="font-semibold text-ink-2">Setup score (0-100)</span> = how strongly each name reads as a beaten-down stock showing an early turn, from five signals: RSI in the reset band + an improving (still-negative) MACD histogram + price near its 60-day low + trend + volume. <span className="text-positive">60+</span> = watchlist-worthy, <span className="text-accent">75+</span> = alert. Recomputed hourly.
                </p>
              </details>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[1120px] text-left text-xs">
                <thead className="bg-chrome font-mono uppercase text-ink-3">
                  <tr>
                    <th className="px-3 py-2">Ticker</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Target Zone</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2">Distance</th>
                    <th className="px-3 py-2" title="Setup score 0-100 (RSI reset + improving MACD histogram + price near 60-day low + trend + volume). 60+ watchlist, 75+ alert. A high score = a beaten-down name showing an early turn, not buying strength.">Setup</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Trigger</th>
                    <th className="px-3 py-2">RSI</th>
                    <th className="px-3 py-2">Hist</th>
                    <th className="px-3 py-2">Vol</th>
                    <th className="px-3 py-2">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {watchlist.map((item) => (
                    <tr className="font-mono text-ink-title hover:bg-line/30" key={item.symbol}>
                      <td className="px-3 py-2 font-semibold text-ink">
                        <Link href={`/tickers/${item.symbol}`} className="inline-flex items-center gap-1.5">
                          <TickerLogo symbol={item.symbol} companyName={item.companyName} size={16} />
                          {item.symbol} <ArrowUpRight size={11} />
                        </Link>
                      </td>
                      <td className="px-3 py-2">{item.companyName}</td>
                      <td className="px-3 py-2">{item.category}</td>
                      <td className="px-3 py-2">{item.targetBuyZone === null ? `score ≥${item.targetSignalScore}` : formatCurrency(item.targetBuyZone)}</td>
                      <td className="px-3 py-2">{formatCurrency(item.currentPrice)}</td>
                      <td className="px-3 py-2">{formatPercent(item.distanceToTarget)}</td>
                      <td className="px-3 py-2">{item.signalScore} <span className={toneClass(item.scoreDelta)}>{formatSignedNumber(item.scoreDelta, 0)}</span></td>
                      <td className="px-3 py-2"><StatusBadge status={item.signalStatus} /></td>
                      <td className="px-3 py-2 text-accent">{item.triggerState.replaceAll('_', ' ')}</td>
                      <td className="px-3 py-2">{formatNumber(item.rsi)}</td>
                      <td className="px-3 py-2">{formatNumber(item.macdHistogram, 2)}</td>
                      <td className="px-3 py-2">{formatNumber(item.volumeRatio, 2)}x</td>
                      <td className="max-w-[260px] truncate px-3 py-2 text-ink-3">{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {watchlist.map((item) => (
                <Link href={`/tickers/${item.symbol}`} className="block px-3 py-3" key={item.symbol}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <TickerLogo symbol={item.symbol} companyName={item.companyName} size={22} />
                      <div>
                        <p className="font-mono text-lg font-semibold">{item.symbol}</p>
                        <p className="font-mono text-xs text-ink-3">{formatCurrency(item.currentPrice)} | target {item.targetBuyZone === null ? `score ≥${item.targetSignalScore}` : formatCurrency(item.targetBuyZone)}</p>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-[8px] uppercase tracking-[0.12em] text-ink-dim">Setup</p>
                      <p>{item.signalScore} <span className={toneClass(item.scoreDelta)}>{formatSignedNumber(item.scoreDelta, 0)}</span></p>
                      <p className="text-xs text-accent">{item.triggerState.replaceAll('_', ' ')}</p>
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-xs text-ink-2">
                    RSI {formatNumber(item.rsi)} | Hist {formatNumber(item.macdHistogram, 2)} | Vol {formatNumber(item.volumeRatio, 2)}x | {formatPercent(item.distanceToTarget)}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <aside className="space-y-3">
            <section className="terminal-panel rounded-panel p-3">
              <div className="flex items-center gap-2">
                <BellPlus className="text-accent" size={16} />
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Watch rule</h2>
              </div>
              <div className="mt-3">
                <AddWatchRuleForm />
              </div>
            </section>

            {/* Solo/demo only (renders null when Supabase is configured): the browser-local
                rules the form above saves - without this the demo-mode save was invisible. */}
            {!soloMode && <LocalWatchRules />}

            {/* xl-only: on mobile this re-listed the ENTIRE watchlist directly under the
                card list - the user scrolled every name twice. The cards already carry
                trigger state; full explanations live on each ticker page. */}
            <section className="terminal-panel hidden rounded-panel p-3 xl:block">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Trigger explanations</h2>
              <div className="mt-3 space-y-3">
                {watchlist.map((item) => (
                  <div className="border-b border-line pb-3 last:border-b-0 last:pb-0" key={item.symbol}>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="font-semibold text-ink">{item.symbol}</span>
                      <span className="text-accent">{item.triggerState.replaceAll('_', ' ')}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-ink-2">{item.explanation.missingConfirmation[0] ?? item.notes}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
