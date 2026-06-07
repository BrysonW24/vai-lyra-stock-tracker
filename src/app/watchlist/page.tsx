import Link from 'next/link';
import { ArrowUpRight, BellPlus } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { AddWatchRuleForm } from '@/components/watchlist/AddWatchRuleForm';
import { TickerLogo } from '@/components/TickerLogo';
import { getDashboardData } from '@/lib/data';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, toneClass } from '@/lib/format';

export default async function WatchlistPage() {
  const data = await getDashboardData();
  const approaching = data.watchlist.filter((item) => item.triggerState === 'approaching').length;
  const triggered = data.watchlist.filter((item) => item.triggerState === 'triggered').length;
  const bestScore = Math.max(...data.watchlist.map((item) => item.signalScore), 0);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="grid gap-2 md:grid-cols-4 xl:grid-cols-6">
          {[
            ['Watchlist names', data.watchlist.length.toString(), 'text-[#eef3f8]'],
            ['Approaching', approaching.toString(), 'text-[#f3a33a]'],
            ['Triggered', triggered.toString(), triggered > 0 ? 'text-[#43d18b]' : 'text-[#8190a0]'],
            ['Best score', bestScore.toString(), 'text-[#eef3f8]'],
            ['Overlay rows', data.latestRun.watchlistOverlaysCreated.toString(), 'text-[#60a5fa]'],
            ['Watch alerts', 'Off default', 'text-[#8190a0]'],
          ].map(([label, value, tone]) => (
            <div className="terminal-panel rounded-md p-3" key={label}>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#8190a0]">{label}</p>
              <p className={`numeric mt-2 truncate font-mono text-xl font-semibold ${tone}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1fr_360px]">
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Watchlist triggers</h1>
              <p className="mt-1 font-mono text-xs text-[#8190a0]">Trigger state is supplied by watchlist_signal_overlay.</p>
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
                    <th className="px-3 py-2">Score</th>
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
