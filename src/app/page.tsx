import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { DailyBriefCard } from '@/components/DailyBriefCard';
import { ExecutiveStrip } from '@/components/ExecutiveStrip';
import { PrimeSetupsBoard } from '@/components/PrimeSetupsBoard';
import { CatalystCountdown } from '@/components/CatalystCountdown';
import { CatalystRadar } from '@/components/CatalystRadar';
import { SignalEventsPanel } from '@/components/SignalEventsPanel';
import { WatchlistTriggerBoard } from '@/components/WatchlistTriggerBoard';
import type { SignalRow } from '@/types/scanner';
import { HoldingsMomentumBoard } from '@/components/HoldingsMomentumBoard';
import { GettingStartedBanner } from '@/components/GettingStartedBanner';
import { SetupChecklist } from '@/components/SetupChecklist';
import { ProductTour } from '@/components/ProductTour';
import { MarketContextStrip } from '@/components/MarketContextStrip';
import { MacroContextStrip } from '@/components/MacroContextStrip';
import { IntelligenceTicker } from '@/components/IntelligenceTicker';
import { Insight } from '@/components/Insight';
import { MetricStrip } from '@/components/MetricStrip';
import { SignalTable } from '@/components/SignalTable';
import { StatusBadge } from '@/components/StatusBadge';
import { CommandLayout, type CommandSectionNode } from '@/components/CommandLayout';
import { LocalContextBar } from '@/components/LocalContextBar';
import { getDashboardData } from '@/lib/data';
import { getMarketContext } from '@/lib/market-context';
import { getMacroContext } from '@/lib/macro-context';
import { getSetupStatus } from '@/lib/setup-status';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, toneClass, trendArrow } from '@/lib/format';

export default async function OverviewPage() {
  // These four are independent - fetch them concurrently instead of one-after-another
  // so the server render waits on the slowest, not the sum.
  const [data, marketContext, macroContext, setupStatus] = await Promise.all([
    getDashboardData(),
    getMarketContext(),
    getMacroContext(),
    getSetupStatus(),
  ]);
  // Strongest setups: real strong_setup rows when they exist; otherwise fall back to
  // the top-scored names so the table is never blank (labelled honestly below).
  const trueStrong = data.signals.filter((signal) => signal.status === 'strong_setup');
  const hasStrong = trueStrong.length > 0;
  const strongSignals = hasStrong ? trueStrong.slice(0, 5) : [...data.signals].sort((a, b) => b.score - a.score).slice(0, 5);
  const watchlistNearTrigger = [...data.watchlist].sort((a, b) => b.scoreDelta - a.scoreDelta).slice(0, 5);
  const portfolioRows = data.portfolio.slice(0, 4);
  const sigBySymbol = new Map(data.signals.map((s) => [s.symbol, s]));
  const bookSignals =
    data.portfolio.length > 0
      ? data.portfolio.map((h) => sigBySymbol.get(h.symbol)).filter((s): s is SignalRow => Boolean(s))
      : [...data.signals].sort((a, b) => b.score - a.score).slice(0, 4);
  const watchlistSignals = data.watchlist
    .map((w) => ({ row: w, signal: sigBySymbol.get(w.symbol) }))
    .filter((x): x is { row: (typeof data.watchlist)[number]; signal: SignalRow } => Boolean(x.signal));
  const stripPanels = [
    { label: data.portfolio.length > 0 ? 'Your book' : 'Top signals', signals: bookSignals },
    {
      label: 'Watchlist leaders',
      signals: [...watchlistSignals].sort((a, b) => b.row.scoreDelta - a.row.scoreDelta).map((x) => x.signal).slice(0, 4),
    },
    {
      label: 'Watchlist losers',
      signals: [...watchlistSignals].sort((a, b) => a.signal.priceChange1d - b.signal.priceChange1d).map((x) => x.signal).slice(0, 4),
    },
    {
      label: 'Watchlist picks',
      signals: [...watchlistSignals]
        .filter((x) => x.row.triggerState === 'approaching' || x.row.triggerState === 'triggered' || x.signal.status === 'strong_setup')
        .sort((a, b) => b.row.signalScore - a.row.signalScore)
        .map((x) => x.signal)
        .slice(0, 4),
    },
  ];

  // Section order here is the DEFAULT layout; the user can reorder / hide via Customise.
  const sections: CommandSectionNode[] = [
    { id: 'runners', node: <ExecutiveStrip panels={stripPanels} /> },
    { id: 'metrics', node: <MetricStrip data={data} /> },
    {
      id: 'context',
      node: (
        <div className="space-y-3">
          <MarketContextStrip data={marketContext} />
          <MacroContextStrip data={macroContext} />
          <IntelligenceTicker />
          <Insight />
        </div>
      ),
    },
    { id: 'daily-brief', node: <DailyBriefCard data={data} market={marketContext} /> },
    { id: 'prime', node: <PrimeSetupsBoard signals={data.signals} /> },
    { id: 'countdown', node: <CatalystCountdown /> },
    { id: 'charts', node: <HoldingsMomentumBoard holdings={data.portfolio} signals={data.signals} tickers={data.tickers} /> },
    { id: 'signals', node: <SignalEventsPanel signals={data.signals} /> },
    { id: 'catalysts', node: <CatalystRadar /> },
    { id: 'watchlist', node: <WatchlistTriggerBoard rows={watchlistNearTrigger} /> },
    {
      id: 'portfolio-exposure',
      node: (
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
      ),
    },
    {
      id: 'compact-feed',
      node: (
        <Suspense fallback={<div className="terminal-panel rounded-md p-4 text-sm text-[#8190a0]">Loading compact ticker feed...</div>}>
          <SignalTable
            signals={data.signals.slice(0, 5)}
            compact
            portfolioSymbols={data.portfolio.map((holding) => holding.symbol)}
            watchlistSymbols={data.watchlist.map((item) => item.symbol)}
            title="Compact ticker feed"
          />
        </Suspense>
      ),
    },
    {
      id: 'strongest',
      node: (
        <section className="terminal-panel overflow-hidden rounded-md">
          <div className="flex items-center justify-between border-b border-[#1b2530] px-3 py-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Strongest setups</p>
              <p className="mt-0.5 font-mono text-[10px] text-[#a8b5c2]">
                {hasStrong ? 'Ranked backend signal outputs' : 'No strong setups right now - showing the top-scored radar names'}
              </p>
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
      ),
    },
  ];

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <ProductTour />

        {setupStatus.signedIn ? <SetupChecklist status={setupStatus} /> : <GettingStartedBanner />}

        <CommandLayout sections={sections} leading={<LocalContextBar />} />
      </div>
    </AppShell>
  );
}
