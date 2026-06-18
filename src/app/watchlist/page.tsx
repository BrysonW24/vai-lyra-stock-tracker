import Link from 'next/link';
import { ArrowUpRight, BellPlus } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { AddWatchRuleForm } from '@/components/watchlist/AddWatchRuleForm';
import { TickerLogo } from '@/components/TickerLogo';
import { getDashboardData } from '@/lib/data';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, toneClass } from '@/lib/format';
import { pageTitleClass } from '@/lib/ui';

export default async function WatchlistPage() {
  const data = await getDashboardData();
  const approaching = data.watchlist.filter((item) => item.triggerState === 'approaching').length;
  const triggered = data.watchlist.filter((item) => item.triggerState === 'triggered').length;
  const bestScore = Math.max(...data.watchlist.map((item) => item.signalScore), 0);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="grid grid-cols-3 gap-1.5 md:grid-cols-4 xl:grid-cols-6">
          {[
            ['Watching', data.watchlist.length.toString(), 'text-[#eef3f8]'],
            ['Approaching', approaching.toString(), 'text-[#f3a33a]'],
            ['Triggered', triggered.toString(), triggered > 0 ? 'text-[#43d18b]' : 'text-[#8190a0]'],
            ['Best setup', bestScore.toString(), 'text-[#eef3f8]'],
            ['Tracked', data.latestRun.watchlistOverlaysCreated.toString(), 'text-[#60a5fa]'],
            ['Alerts', 'Off', 'text-[#8190a0]'],
          ].map(([label, value, tone]) => (
            <div className="terminal-panel rounded-md p-2" key={label}>
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
              <p className={`numeric mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1fr_360px]">
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <h1 className={pageTitleClass}>Watchlist triggers</h1>
              <p className="mt-1 text-[11px] leading-relaxed text-[#8190a0]">
                <span className="font-semibold text-[#a8b5c2]">Setup score (0-100)</span> = how strongly each name reads as a beaten-down stock showing an early turn, from five signals: RSI in the reset band + an improving (still-negative) MACD histogram + price near its 60-day low + trend + volume. <span className="text-[#43d18b]">60+</span> = watchlist-worthy, <span className="text-[#f3a33a]">75+</span> = alert. Higher means a clearer early-turn setup - not buying strength, and not a price target or fundamentals rating. Recomputed hourly.
              </p>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[1120px] text-left text-xs">
                <thead className="bg-[#0b1016] font-mono uppercase text-[#8190a0]">
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
                <tbody className="divide-y divide-[#1b2530]">
                  {data.watchlist.map((item) => (
                    <tr className="font-mono text-[#dbe5ee] hover:bg-[#101720]" key={item.symbol}>
                      <td className="px-3 py-2 font-semibold text-[#eef3f8]">
                        <Link href={`/tickers/${item.symbol}`} className="inline-flex items-center gap-1.5">
                          <TickerLogo symbol={item.symbol} companyName={item.companyName} size={16} />
                          {item.symbol} <ArrowUpRight size={11} />
                        </Link>
                      </td>
                      <td className="px-3 py-2">{item.companyName}</td>
                      <td className="px-3 py-2">{item.category}</td>
                      <td className="px-3 py-2">{formatCurrency(item.targetBuyZone)}</td>
                      <td className="px-3 py-2">{formatCurrency(item.currentPrice)}</td>
                      <td className="px-3 py-2">{formatPercent(item.distanceToTarget)}</td>
                      <td className="px-3 py-2">{item.signalScore} <span className={toneClass(item.scoreDelta)}>{formatSignedNumber(item.scoreDelta, 0)}</span></td>
                      <td className="px-3 py-2"><StatusBadge status={item.signalStatus} /></td>
                      <td className="px-3 py-2 text-[#f3a33a]">{item.triggerState.replaceAll('_', ' ')}</td>
                      <td className="px-3 py-2">{formatNumber(item.rsi)}</td>
                      <td className="px-3 py-2">{formatNumber(item.macdHistogram, 2)}</td>
                      <td className="px-3 py-2">{formatNumber(item.volumeRatio, 2)}x</td>
                      <td className="max-w-[260px] truncate px-3 py-2 text-[#8190a0]">{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#1b2530] md:hidden">
              {data.watchlist.map((item) => (
                <Link href={`/tickers/${item.symbol}`} className="block px-3 py-3" key={item.symbol}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <TickerLogo symbol={item.symbol} companyName={item.companyName} size={22} />
                      <div>
                        <p className="font-mono text-lg font-semibold">{item.symbol}</p>
                        <p className="font-mono text-xs text-[#8190a0]">{formatCurrency(item.currentPrice)} | target {formatCurrency(item.targetBuyZone)}</p>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-[8px] uppercase tracking-[0.12em] text-[#6f7d8a]">Setup</p>
                      <p>{item.signalScore} <span className={toneClass(item.scoreDelta)}>{formatSignedNumber(item.scoreDelta, 0)}</span></p>
                      <p className="text-xs text-[#f3a33a]">{item.triggerState.replaceAll('_', ' ')}</p>
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-xs text-[#a8b5c2]">
                    RSI {formatNumber(item.rsi)} | Hist {formatNumber(item.macdHistogram, 2)} | Vol {formatNumber(item.volumeRatio, 2)}x | {formatPercent(item.distanceToTarget)}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <aside className="space-y-3">
            <section className="terminal-panel rounded-md p-3">
              <div className="flex items-center gap-2">
                <BellPlus className="text-[#f3a33a]" size={16} />
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Watch rule</h2>
              </div>
              <div className="mt-3">
                <AddWatchRuleForm />
              </div>
            </section>

            <section className="terminal-panel rounded-md p-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Trigger explanations</h2>
              <div className="mt-3 space-y-3">
                {data.watchlist.map((item) => (
                  <div className="border-b border-[#1b2530] pb-3 last:border-b-0 last:pb-0" key={item.symbol}>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="font-semibold text-[#eef3f8]">{item.symbol}</span>
                      <span className="text-[#f3a33a]">{item.triggerState.replaceAll('_', ' ')}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#a8b5c2]">{item.explanation.missingConfirmation[0] ?? item.notes}</p>
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
