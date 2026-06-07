import Link from 'next/link';
import { ArrowUpRight, Plus } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { AddHoldingForm } from '@/components/portfolio/AddHoldingForm';
import { TickerLogo } from '@/components/TickerLogo';
import { getDashboardData } from '@/lib/data';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, toneClass } from '@/lib/format';

export default async function PortfolioPage() {
  const data = await getDashboardData();
  const totalValue = data.portfolio.reduce((sum, holding) => sum + holding.marketValue, 0);
  const totalPnl = data.portfolio.reduce((sum, holding) => sum + holding.unrealisedPnl, 0);
  const dailyRisk = data.portfolio.filter((holding) => ['elevated_risk', 'invalidated', 'overextended'].includes(holding.riskState)).length;
  const strongInHoldings = data.portfolio.filter((holding) => holding.signalStatus === 'strong_setup').length;

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
          {[
            ['Total value', formatCurrency(totalValue), 'text-[#eef3f8]'],
            ['Unrealised P/L', formatCurrency(totalPnl), totalPnl >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'],
            ['Holdings', formatNumber(data.portfolio.length, 0), 'text-[#eef3f8]'],
            ['Strong in holdings', formatNumber(strongInHoldings, 0), 'text-[#43d18b]'],
            ['Risk signals', formatNumber(dailyRisk, 0), dailyRisk > 0 ? 'text-[#ff6b6b]' : 'text-[#43d18b]'],
            ['Cash allocation', 'Backend', 'text-[#8190a0]'],
            ['Overlay rows', formatNumber(data.latestRun.portfolioOverlaysCreated, 0), 'text-[#60a5fa]'],
            ['Last scan', data.latestRun.timeframe.toUpperCase(), 'text-[#a8b5c2]'],
          ].map(([label, value, tone]) => (
            <div className="terminal-panel rounded-md p-3" key={label}>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#8190a0]">{label}</p>
              <p className={`numeric mt-2 truncate font-mono text-xl font-semibold ${tone}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1fr_340px]">
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Portfolio holdings</h1>
              <p className="mt-1 font-mono text-xs text-[#8190a0]">Values, risk states, and action states are middleware overlay outputs.</p>
            </div>
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
                  {data.portfolio.map((holding) => (
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
              {data.portfolio.map((holding) => (
                <Link href={`/tickers/${holding.symbol}`} className="block px-3 py-3" key={holding.symbol}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <TickerLogo symbol={holding.symbol} size={22} />
                      <div>
                        <p className="font-mono text-lg font-semibold">{holding.symbol}</p>
                        <p className="font-mono text-xs text-[#8190a0]">{formatCurrency(holding.marketValue)} | {formatPercent(holding.portfolioWeight)}</p>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <p className={toneClass(holding.unrealisedPnl)}>{formatPercent(holding.unrealisedPnlPercent)}</p>
                      <p className="text-xs text-[#f3a33a]">{holding.actionState.replaceAll('_', ' ')}</p>
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-xs text-[#a8b5c2]">
                    Score {holding.signalScore} {formatSignedNumber(holding.scoreDelta, 0)} | RSI {formatNumber(holding.rsi)} | {holding.riskState.replaceAll('_', ' ')}
                  </p>
                </Link>
              ))}
            </div>
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

            <section className="terminal-panel rounded-md p-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Portfolio signal overlay</h2>
              <div className="mt-3 space-y-3">
                {data.portfolio.map((holding) => (
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
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
