import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { DailyBriefCard } from '@/components/DailyBriefCard';
import { NextBestActions } from '@/components/NextBestActions';
import { AiOfferCard } from '@/components/AiOfferCard';
import { ExecutiveStrip } from '@/components/ExecutiveStrip';
import { PrimeSetupsBoard } from '@/components/PrimeSetupsBoard';
import { CatalystCountdown } from '@/components/CatalystCountdown';
import { getCalendarEventsLive } from '@/lib/calendar-live';
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
import { GoalCockpit } from '@/components/GoalCockpit';
import { computeGoalProgress } from '@/lib/goal';
import { computePortfolioActions } from '@/lib/portfolio-actions';
import { computeOrientation } from '@/lib/orientation';
import { getIntelligenceLive } from '@/lib/intelligence-live';
import { getUserConstraints } from '@/lib/ai/user-context';
import { getDashboardData } from '@/lib/data';
import { getMarketContextLive, getMacroContextLive } from '@/lib/market-context-live';
import { getSetupStatus } from '@/lib/setup-status';
import { getPaperAccountSummaryAuthAware } from '@/lib/trading/paper-account-repo';
import { loadTwinAffinity } from '@/lib/twin/repo';
import { applyAffinityTiebreak, affinityFor } from '@/lib/twin/ranking';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, toneClass, trendArrow } from '@/lib/format';
import { PaperBotStrip } from '@/components/paper-bot/PaperBotStrip';
import { SoloCommandLayout } from '@/components/SoloCommandLayout';

export const metadata = { title: 'Command' };

export default async function OverviewPage() {
  const soloMode = !(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  // These four are independent - fetch them concurrently instead of one-after-another
  // so the server render waits on the slowest, not the sum.
  const [data, marketContext, macroContext, setupStatus, paperAccount, twinAffinity, constraints, calendar, intel] = await Promise.all([
    getDashboardData(),
    getMarketContextLive(),
    getMacroContextLive(),
    getSetupStatus(),
    getPaperAccountSummaryAuthAware(),
    loadTwinAffinity().catch(() => null),
    getUserConstraints().catch(() => null),
    // Live calendar feeds the countdown hero (RBA/FOMC/IPO/earnings). Degrades to the
    // sample set inside getCalendarEventsLive; a hard failure just means no live moments.
    getCalendarEventsLive().catch(() => null),
    // Live news feeds the orientation + holdings intel; source 'sample' means the bundled
    // demo feed, which may only render on the demo tour - never against a real book.
    getIntelligenceLive().catch(() => null),
  ]);

  // Goal cockpit inputs: standing (equity = holdings + cash), return basis, and the risk/goal profile
  // that personalises the action thresholds. Deterministic; safe in demo (constraints null -> cash 0).
  const holdingsMarketValue = data.portfolio.reduce((sum, h) => sum + h.marketValue, 0);
  const investedBasis = data.portfolio.reduce((sum, h) => sum + h.averagePrice * h.quantity, 0);
  const cashAvailable = typeof constraints?.cashAvailable === 'number' ? constraints.cashAvailable : 0;
  const equity = holdingsMarketValue + cashAvailable;
  const goal = computeGoalProgress({
    equity,
    investedBasis,
    cashAvailable,
    monthlyContribution: constraints?.monthlyContribution ?? null,
    targetAmount: constraints?.goalTargetAmount ?? null,
    primaryGoal: constraints?.primaryGoal ?? null,
  });
  const portfolioActions = computePortfolioActions({
    holdings: data.portfolio,
    cashAvailable,
    equity,
    riskComfort: constraints?.riskComfort ?? null,
    maxPositionPct: constraints?.maxPositionSizePct ?? null,
    goalBehind: goal.pace === 'behind',
  });
  // Two-sided orientation: the news flow (good and bad) across the names you hold AND watch.
  // Honesty rule (2026-08-11 audit): LIVE news orients; the bundled sample feed may only
  // orient the demo tour's sample book - fabricated headlines never touch a real holding.
  const intelIsLive = intel?.source === 'live';
  const orientationNews = intelIsLive || data.mode === 'demo' ? (intel?.feed ?? []) : [];
  const orientation = computeOrientation({
    news: orientationNews,
    heldSymbols: data.portfolio.map((h) => h.symbol),
    watchedSymbols: data.watchlist.map((w) => w.symbol),
  });
  const orientationSample = !intelIsLive && orientationNews.length > 0;
  const cockpitEmpty = data.portfolio.length === 0 && cashAvailable <= 0;
  const cockpitCurrency = constraints?.baseCurrency ?? 'USD';
  // Strongest setups: real strong_setup rows when they exist; otherwise fall back to
  // the top-scored names so the table is never blank (labelled honestly below).
  const trueStrong = data.signals.filter((signal) => signal.status === 'strong_setup');
  const hasStrong = trueStrong.length > 0;
  const strongBase = hasStrong ? trueStrong.slice(0, 5) : [...data.signals].sort((a, b) => b.score - a.score).slice(0, 5);
  // Twin-affinity tiebreak: reorders ONLY equal-score names toward the user's interests. The score
  // still gates - a lower-scored name can never jump a higher one - and nothing is hidden (anti-bubble).
  const strongSignals = twinAffinity
    ? applyAffinityTiebreak(strongBase, (s) => s.score, (s) => affinityFor(s.symbol, twinAffinity))
    : strongBase;
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

  // Section order here is the DEFAULT layout; the user can reorder / hide via Customise. The goal
  // cockpit leads: where you stand against your goal and what your money needs from you, first.
  const sections: CommandSectionNode[] = [
    { id: 'goal-cockpit', node: <GoalCockpit goal={goal} actions={portfolioActions} orientation={orientation} orientationSample={orientationSample} baseCurrency={cockpitCurrency} currentTarget={constraints?.goalTargetAmount ?? null} canSetTarget={setupStatus.signedIn} isEmptyState={cockpitEmpty} /> },
    { id: 'runners', node: <ExecutiveStrip panels={stripPanels} /> },
    { id: 'metrics', node: <MetricStrip data={data} /> },
    { id: 'paper-bot', node: <PaperBotStrip account={paperAccount} /> },
    { id: 'ai-offer', node: <AiOfferCard /> },
    {
      id: 'context',
      node: (
        <div className="space-y-3">
          <MarketContextStrip data={marketContext} />
          <MacroContextStrip data={macroContext} />
          {/* orientationNews is already the rule's gate (live feed, or sample on the demo
              tour only) - passing the raw sample feed here serialized fabricated Goldman
              headlines into the live page payload even though the tape never drew them. */}
          <IntelligenceTicker feed={orientationNews} source={intel?.source ?? 'sample'} pageMode={data.mode} />
          <Insight />
        </div>
      ),
    },
    { id: 'daily-brief', node: <DailyBriefCard data={data} market={marketContext} /> },
    { id: 'next-best', node: <NextBestActions signals={data.signals} portfolio={data.portfolio} watchlist={data.watchlist} /> },
    { id: 'prime', node: <PrimeSetupsBoard signals={data.signals} /> },
    { id: 'countdown', node: <CatalystCountdown events={calendar?.events ?? []} calendarSource={calendar?.source ?? 'sample'} pageMode={data.mode} /> },
    { id: 'charts', node: <HoldingsMomentumBoard holdings={data.portfolio} signals={data.signals} tickers={data.tickers} intel={intel && (intelIsLive || data.mode === 'demo') ? { feed: intel.feed, hypeMap: intel.hypeMap, source: intel.source } : null} pageMode={data.mode} /> },
    { id: 'signals', node: <SignalEventsPanel signals={data.signals} /> },
    { id: 'catalysts', node: <CatalystRadar /> },
    { id: 'watchlist', node: <WatchlistTriggerBoard rows={watchlistNearTrigger} /> },
    {
      id: 'portfolio-exposure',
      node: (
        <section className="terminal-panel overflow-hidden rounded-panel">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Portfolio exposure / current holdings</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-2">Displays backend portfolio overlay values</p>
            </div>
            <Link href="/portfolio" className="inline-flex items-center gap-1 rounded border border-line-strong bg-panel px-2 py-1 text-xs text-ink-2 transition hover:text-ink">
              Portfolio <ArrowUpRight size={12} />
            </Link>
          </div>
          {portfolioRows.length === 0 ? (
            // A signed-in user with no holdings used to see a header over an empty bordered grid
            // (2026-07-27 audit V3 fix) - give the live path the same honest empty state the Solo path has.
            <p className="px-3 py-6 text-center font-mono text-xs text-ink-3">
              No holdings yet.{' '}
              <Link href="/portfolio" className="text-pending transition hover:text-ink">Add one</Link>{' '}
              to see your exposure, weights and per-position risk here.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-2 xl:grid-cols-4">
              {portfolioRows.map((holding) => (
                <div className="bg-panel-deep p-2" key={holding.symbol}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-ink">{holding.symbol}</p>
                      <p className="font-mono text-[10px] text-ink-3">Weight {formatPercent(holding.portfolioWeight)}</p>
                    </div>
                    <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[10px] text-accent">
                      {holding.actionState.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                    <span className="text-ink-3">Value</span>
                    <span className="text-right text-ink-title">{formatCurrency(holding.marketValue)}</span>
                    <span className="text-ink-3">P/L</span>
                    <span className={`text-right ${toneClass(holding.unrealisedPnl)}`}>{formatCurrency(holding.unrealisedPnl)}</span>
                    <span className="text-ink-3">Signal</span>
                    <span className="text-right text-ink-title">{holding.signalScore} {formatSignedNumber(holding.scoreDelta, 0)}</span>
                    <span className="text-ink-3">Risk</span>
                    <span className="text-right text-ink-title">{holding.riskState.replaceAll('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ),
    },
    {
      id: 'compact-feed',
      node: (
        <Suspense fallback={<div className="terminal-panel rounded-panel p-4 text-sm text-ink-3">Loading compact ticker feed...</div>}>
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
        <section className="terminal-panel overflow-hidden rounded-panel">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Strongest setups</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-2">
                {hasStrong ? 'Ranked backend signal outputs' : 'No strong setups right now - showing the top-scored radar names'}
              </p>
            </div>
            <Link href="/radar" className="inline-flex items-center gap-1 rounded border border-line-strong bg-panel px-2 py-1 text-xs text-ink-2 transition hover:text-ink">
              Radar <ArrowUpRight size={12} />
            </Link>
          </div>
          {/* Mobile cards - this was the one table in the app with no card fallback,
              forcing sideways scrolling at 375px. Mirrors the SignalTable card shape. */}
          <div className="divide-y divide-line md:hidden">
            {strongSignals.map((signal) => (
              <Link href={`/tickers/${signal.symbol}`} className="block px-3 py-2.5" key={signal.symbol}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-ink">{signal.symbol}</span>
                      <StatusBadge status={signal.status} />
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-ink-2">
                      RSI {formatNumber(signal.rsi)}{trendArrow(signal.rsiDelta)} | Hist {formatNumber(signal.macdHistogram, 2)}{trendArrow(signal.histDelta)} | Vol {formatNumber(signal.volumeRatio, 2)}x | Low {formatPercent(signal.distanceFromLow)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-mono">
                    <p className="text-base font-semibold leading-none text-ink">{signal.score}</p>
                    <p className={`text-[11px] ${toneClass(signal.scoreDelta)}`}>{formatSignedNumber(signal.scoreDelta, 0)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="no-scrollbar hidden overflow-x-auto md:block">
            <table className="min-w-[640px] text-left text-xs md:min-w-full">
              <thead className="bg-chrome font-mono uppercase text-ink-3">
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
              <tbody className="divide-y divide-line">
                {strongSignals.map((signal) => (
                  <tr className="font-mono text-ink-title hover:bg-line/30" key={signal.symbol}>
                    <td className="px-3 py-2 font-semibold text-ink">
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

        {soloMode ? (
          <SoloCommandLayout
            sourceData={data}
            market={marketContext}
            sections={sections}
            leading={<LocalContextBar />}
          />
        ) : (
          <CommandLayout sections={sections} leading={<LocalContextBar />} />
        )}
      </div>
    </AppShell>
  );
}
