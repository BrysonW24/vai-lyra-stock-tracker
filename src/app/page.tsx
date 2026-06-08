import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { DailyBriefCard } from '@/components/DailyBriefCard';
import { ExecutiveStrip } from '@/components/ExecutiveStrip';
import type { SignalRow } from '@/types/scanner';
import { HoldingsMomentumBoard } from '@/components/HoldingsMomentumBoard';
import { GettingStartedBanner } from '@/components/GettingStartedBanner';
import { SetupChecklist } from '@/components/SetupChecklist';
import { ProductTour } from '@/components/ProductTour';
import { MarketContextStrip } from '@/components/MarketContextStrip';
import { MacroContextStrip } from '@/components/MacroContextStrip';
import { IntelligenceTicker } from '@/components/IntelligenceTicker';
import { MetricStrip } from '@/components/MetricStrip';
import { SignalTable } from '@/components/SignalTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getDashboardData } from '@/lib/data';
import { getMarketContext } from '@/lib/market-context';
import { getMacroContext } from '@/lib/macro-context';
import { getSetupStatus } from '@/lib/setup-status';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, relativeTime, toneClass, trendArrow } from '@/lib/format';

export default async function OverviewPage() {
  const data = await getDashboardData();
  const marketContext = await getMarketContext();
  const macroContext = await getMacroContext();
  const setupStatus = await getSetupStatus();
  const strongSignals = data.signals.filter((signal) => signal.status === 'strong_setup').slice(0, 5);
  const watchlistNearTrigger = [...data.watchlist].sort((a, b) => b.scoreDelta - a.scoreDelta).slice(0, 5);
  const portfolioRows = data.portfolio.slice(0, 4);
  const sigBySymbol = new Map(data.signals.map((s) => [s.symbol, s]));
  const stripSignals =
    data.portfolio.length > 0
      ? data.portfolio.map((h) => sigBySymbol.get(h.symbol)).filter((s): s is SignalRow => Boolean(s))
      : [...data.signals].sort((a, b) => b.score - a.score).slice(0, 8);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <ProductTour />

        {setupStatus.signedIn ? <SetupChecklist status={setupStatus} /> : <GettingStartedBanner />}

        <ExecutiveStrip signals={stripSignals} />

        <DailyBriefCard data={data} market={marketContext} />

        <MetricStrip data={data} />

        <MarketContextStrip data={marketContext} />

        <MacroContextStrip data={macroContext} />

        <IntelligenceTicker />

        <section className="terminal-panel overflow-hidden rounded-md">
            <div className="flex items-center justify-between border-b border-[#1b2530] px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Strongest setups</p>
                <p className="mt-0.5 font-mono text-[10px] text-[#a8b5c2]">Ranked backend signal outputs</p>
              </div>
              <Link href="/radar" className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-2 py-1 text-xs text-[#a8b5c2] transition hover:text-[#eef3f8]">
                Radar <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="no-scrollbar overflow-x-auto">
              <table className="min-w-[640px] text-left text-xs md:min-w-full">
                <thead className="bg-[#0b1016] font-mono uppercase text-[#8190a0]">
                  <tr>
                    <th className="px-3 py-2">Ticker</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Delta</th>
                    <th className="px-3 py-2">RSI</th>
                    <th className="px-3 py-2">Hist</th>
                    <th className="px-3 py-2">Vol</th>
                    <th className="px-3 py-2">Low</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2530]">
                  {strongSignals.map((signal) => (
                    <tr className="font-mono text-[#dbe5ee] hover:bg-[#101720]" key={signal.symbol}>
                      <td className="px-3 py-2 font-semibold text-[#eef3f8]">
                        <Link href={`/tickers/${signal.symbol}`} className="inline-flex items-center gap-1">
                          {signal.symbol} <ArrowUpRight size={11} />
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-base font-semibold">{signal.score}</td>
                      <td className={`px-3 py-2 ${toneClass(signal.scoreDelta)}`}>{formatSignedNumber(signal.scoreDelta, 0)}</td>
                      <td className="px-3 py-2">{formatNumber(signal.rsi)}{trendArrow(signal.rsiDelta)}</td>
                      <td className="px-3 py-2">{formatNumber(signal.macdHistogram, 2)}{trendArrow(signal.histDelta)}</td>
                      <td className="px-3 py-2">{formatNumber(signal.volumeRatio, 2)}x</td>
                      <td className="px-3 py-2">{formatPercent(signal.distanceFromLow)}</td>
                      <td className="px-3 py-2"><StatusBadge status={signal.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </section>

        <HoldingsMomentumBoard holdings={data.portfolio} signals={data.signals} tickers={data.tickers} />

        <section className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Watchlist near trigger</p>
              <p className="mt-0.5 font-mono text-[10px] text-[#a8b5c2]">Backend watchlist overlay state</p>
            </div>
            <div className="divide-y divide-[#1b2530]">
              {watchlistNearTrigger.map((item) => (
                <div className="grid grid-cols-[72px_1fr_84px] items-center gap-3 px-3 py-2 font-mono text-xs" key={item.symbol}>
                  <Link href={`/tickers/${item.symbol}`} className="font-semibold text-[#eef3f8]">{item.symbol}</Link>
                  <div className="min-w-0">
                    <p className="truncate text-[#dbe5ee]">{item.triggerState.replaceAll('_', ' ')} | target {formatCurrency(item.targetBuyZone)}</p>
                    <p className="truncate text-[#8190a0]">Score {item.signalScore} {formatSignedNumber(item.scoreDelta, 0)} | dist {formatPercent(item.distanceToTarget)}</p>
                  </div>
                  <span className="justify-self-end rounded border border-[#9a6a1f] bg-[#2a1f0f] px-2 py-1 text-[#f3a33a]">{item.alertStatus}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="flex items-center justify-between border-b border-[#1b2530] px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Recent signal changes</p>
                <p className="mt-0.5 font-mono text-[10px] text-[#a8b5c2]">Since last scan</p>
              </div>
              <Clock3 className="text-[#8190a0]" size={16} />
            </div>
            <div className="divide-y divide-[#1b2530]">
              {data.signalChanges.map((change) => (
                <div className="grid grid-cols-[72px_1fr_86px] items-center gap-3 px-3 py-2 font-mono text-xs" key={`${change.symbol}-${change.label}`}>
                  <Link href={`/tickers/${change.symbol}`} className="font-semibold text-[#eef3f8]">{change.symbol}</Link>
                  <span className="truncate text-[#dbe5ee]">{change.label}</span>
                  <span className={`justify-self-end ${toneClass(change.change)}`}>{formatSignedNumber(change.change, 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="terminal-panel overflow-hidden rounded-md">
          <div className="flex items-center justify-between border-b border-[#1b2530] px-3 py-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Portfolio exposure / current holdings</p>
              <p className="mt-0.5 font-mono text-[10px] text-[#a8b5c2]">Displays backend portfolio overlay values</p>
            </div>
            <Link href="/portfolio" className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-2 py-1 text-xs text-[#a8b5c2] transition hover:text-[#eef3f8]">
              Portfolio <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#1b2530] md:grid-cols-2 xl:grid-cols-4">
            {portfolioRows.map((holding) => (
              <div className="bg-[#0d1117] p-2" key={holding.symbol}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-[#eef3f8]">{holding.symbol}</p>
                    <p className="font-mono text-[10px] text-[#8190a0]">Weight {formatPercent(holding.portfolioWeight)}</p>
                  </div>
                  <span className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[10px] text-[#f3a33a]">
                    {holding.actionState.replaceAll('_', ' ')}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <span className="text-[#8190a0]">Value</span>
                  <span className="text-right text-[#dbe5ee]">{formatCurrency(holding.marketValue)}</span>
                  <span className="text-[#8190a0]">P/L</span>
                  <span className={`text-right ${toneClass(holding.unrealisedPnl)}`}>{formatCurrency(holding.unrealisedPnl)}</span>
                  <span className="text-[#8190a0]">Signal</span>
                  <span className="text-right text-[#dbe5ee]">{holding.signalScore} {formatSignedNumber(holding.scoreDelta, 0)}</span>
                  <span className="text-[#8190a0]">Risk</span>
                  <span className="text-right text-[#dbe5ee]">{holding.riskState.replaceAll('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Suspense fallback={<div className="terminal-panel rounded-md p-4 text-sm text-[#8190a0]">Loading compact ticker feed...</div>}>
          <SignalTable
            signals={data.signals.slice(0, 5)}
            compact
            portfolioSymbols={data.portfolio.map((holding) => holding.symbol)}
            watchlistSymbols={data.watchlist.map((item) => item.symbol)}
            title="Compact ticker feed"
          />
        </Suspense>
      </div>
    </AppShell>
  );
}
