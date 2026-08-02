'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Star } from 'lucide-react';
import {
  CommandLayout,
  type CommandSectionNode,
} from '@/components/CommandLayout';
import { DailyBriefCard } from '@/components/DailyBriefCard';
import { ExecutiveStrip, type StripPanel } from '@/components/ExecutiveStrip';
import { GoalCockpit } from '@/components/GoalCockpit';
import { HoldingsMomentumBoard } from '@/components/HoldingsMomentumBoard';
import { MetricStrip } from '@/components/MetricStrip';
import { NextBestActions } from '@/components/NextBestActions';
import { SignalTable } from '@/components/SignalTable';
import { WatchlistTriggerBoard } from '@/components/WatchlistTriggerBoard';
import {
  loadLocalHoldings,
  PORTFOLIO_CHANGED_EVENT,
} from '@/lib/local-portfolio';
import {
  loadLocalWatchlist,
  WATCHLIST_CHANGED_EVENT,
  type LocalWatchItem,
} from '@/lib/local-watchlist';
import {
  buildLocalPortfolioHoldings,
  buildLocalWatchlistRows,
} from '@/lib/local-dashboard';
import {
  loadOnboardingSummary,
  ONBOARDING_SUMMARY_CHANGED_EVENT,
  type OnboardingSummary,
} from '@/lib/onboarding-summary';
import { computeGoalProgress } from '@/lib/goal';
import { computePortfolioActions } from '@/lib/portfolio-actions';
import { computeOrientation } from '@/lib/orientation';
import { demoIntelligenceFeed } from '@/lib/intelligence';
import {
  formatCurrency,
  formatPercent,
  formatSignedNumber,
  toneClass,
} from '@/lib/format';
import type { MarketContextSnapshot } from '@/lib/market-context';
import type {
  DashboardData,
  PortfolioHolding,
  SignalRow,
} from '@/types/scanner';

interface Props {
  sourceData: DashboardData;
  market: MarketContextSnapshot;
  sections: CommandSectionNode[];
  leading?: ReactNode;
}

function buildStripPanels(
  data: DashboardData,
  localWatchlist: LocalWatchItem[],
): StripPanel[] {
  const signalBySymbol = new Map(
    data.signals.map((signal) => [signal.symbol, signal]),
  );
  const bookSignals =
    data.portfolio.length > 0
      ? data.portfolio
          .map((holding) => signalBySymbol.get(holding.symbol))
          .filter((signal): signal is SignalRow => Boolean(signal))
      : [...data.signals].sort((a, b) => b.score - a.score).slice(0, 4);
  const watchedSignals = localWatchlist
    .map((item) => signalBySymbol.get(item.symbol))
    .filter((signal): signal is SignalRow => Boolean(signal));

  return [
    {
      label: data.portfolio.length > 0 ? 'Your book' : 'Top market signals',
      signals: bookSignals,
    },
    { label: 'Your watchlist', signals: watchedSignals },
  ];
}

function SoloWatchlistSection({
  rows,
  items,
}: {
  rows: DashboardData['watchlist'];
  items: LocalWatchItem[];
}) {
  const targetless = items.filter(
    (item) =>
      typeof item.targetBuyPrice !== 'number' || item.targetBuyPrice <= 0,
  );

  return (
    <div className="space-y-2">
      {rows.length > 0 && <WatchlistTriggerBoard rows={rows} />}
      {targetless.length > 0 && (
        <section className="terminal-panel overflow-hidden rounded-panel">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                Your watchlist
              </p>
              <p className="mt-0.5 text-[10px] text-ink-2">
                Tracked on this device. Add a target price to enable proximity
                triggers.
              </p>
            </div>
            <Link
              href="/watchlist"
              className="inline-flex items-center gap-1 rounded border border-line-strong bg-panel px-2 py-1 text-xs text-ink-2 transition hover:text-ink"
            >
              Edit <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
            {targetless.map((item) => (
              <Link
                key={item.symbol}
                href={`/tickers/${item.symbol}`}
                className="flex items-center gap-2 bg-panel-deep px-3 py-2.5 transition hover:bg-line/30"
              >
                <Star size={13} className="text-accent" />
                <span className="font-mono text-sm font-semibold text-ink">
                  {item.symbol}
                </span>
                <span className="ml-auto text-[10px] text-ink-3">
                  No target
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {items.length === 0 && (
        <section className="terminal-panel rounded-panel p-4 text-center">
          <p className="text-sm font-semibold text-ink-title">
            Your watchlist is empty
          </p>
          <p className="mt-1 text-xs text-ink-3">
            Add a ticker to track it on this device.
          </p>
          <Link
            href="/watchlist"
            className="mt-3 inline-flex items-center gap-1 rounded border border-line-strong bg-panel px-3 py-1.5 text-xs text-ink-2"
          >
            Open watchlist <ArrowUpRight size={12} />
          </Link>
        </section>
      )}
    </div>
  );
}

function SoloPortfolioExposure({
  holdings,
}: {
  holdings: PortfolioHolding[];
}) {
  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Your device-local holdings
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-ink-2">
            Your quantities and cost basis, priced from the latest available scan
          </p>
        </div>
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-1 rounded border border-line-strong bg-panel px-2 py-1 text-xs text-ink-2 transition hover:text-ink"
        >
          Portfolio <ArrowUpRight size={12} />
        </Link>
      </div>
      {holdings.length === 0 ? (
        <p className="px-3 py-6 text-center font-mono text-xs text-ink-3">
          No holdings on this device yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-line xl:grid-cols-4">
          {holdings.slice(0, 4).map((holding) => (
            <div className="bg-panel-deep p-2" key={holding.symbol}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-ink">
                    {holding.symbol}
                  </p>
                  <p className="font-mono text-[10px] text-ink-3">
                    Weight {formatPercent(holding.portfolioWeight)}
                  </p>
                </div>
                <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[10px] text-accent">
                  {holding.actionState.replaceAll('_', ' ')}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                <span className="text-ink-3">Value</span>
                <span className="text-right text-ink-title">
                  {formatCurrency(holding.marketValue)}
                </span>
                <span className="text-ink-3">P/L</span>
                <span
                  className={`text-right ${toneClass(holding.unrealisedPnl)}`}
                >
                  {formatCurrency(holding.unrealisedPnl)}
                </span>
                <span className="text-ink-3">Signal</span>
                <span className="text-right text-ink-title">
                  {holding.signalScore}{' '}
                  {formatSignedNumber(holding.scoreDelta, 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Solo's personal data lives in the browser, while the market scan comes from the
 * server. This boundary merges those two planes and replaces every personal command
 * section before it renders, preventing sample holdings from being labelled as the
 * user's book.
 */
export function SoloCommandLayout({
  sourceData,
  market,
  sections,
  leading,
}: Props) {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [localWatchlist, setLocalWatchlist] = useState<LocalWatchItem[]>([]);
  const [summary, setSummary] = useState<OnboardingSummary | null>(null);

  useEffect(() => {
    const syncPortfolio = () =>
      setHoldings(
        buildLocalPortfolioHoldings(loadLocalHoldings(), sourceData.signals),
      );
    const syncWatchlist = () => setLocalWatchlist(loadLocalWatchlist());
    const syncSummary = () => setSummary(loadOnboardingSummary());

    syncPortfolio();
    syncWatchlist();
    syncSummary();
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, syncPortfolio);
    window.addEventListener(WATCHLIST_CHANGED_EVENT, syncWatchlist);
    window.addEventListener(
      ONBOARDING_SUMMARY_CHANGED_EVENT,
      syncSummary,
    );
    return () => {
      window.removeEventListener(PORTFOLIO_CHANGED_EVENT, syncPortfolio);
      window.removeEventListener(WATCHLIST_CHANGED_EVENT, syncWatchlist);
      window.removeEventListener(
        ONBOARDING_SUMMARY_CHANGED_EVENT,
        syncSummary,
      );
    };
  }, [sourceData.signals]);

  const watchRows = useMemo(
    () => buildLocalWatchlistRows(localWatchlist, sourceData.signals),
    [localWatchlist, sourceData.signals],
  );
  const personalData = useMemo<DashboardData>(
    () => ({ ...sourceData, portfolio: holdings, watchlist: watchRows }),
    [holdings, sourceData, watchRows],
  );

  const capital = summary?.capital;
  const holdingsMarketValue = holdings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0,
  );
  const investedBasis = holdings.reduce(
    (sum, holding) => sum + holding.averagePrice * holding.quantity,
    0,
  );
  const cashAvailable =
    typeof capital?.cashAvailable === 'number' ? capital.cashAvailable : 0;
  const equity = holdingsMarketValue + cashAvailable;
  const goal = computeGoalProgress({
    equity,
    investedBasis,
    cashAvailable,
    monthlyContribution: capital?.monthlyContribution ?? null,
    targetAmount: null,
    primaryGoal: capital?.primaryOutcome ?? null,
  });
  const portfolioActions = computePortfolioActions({
    holdings,
    cashAvailable,
    equity,
    riskComfort: summary?.riskComfort ?? null,
    maxPositionPct: capital?.maxPositionSizePct ?? null,
    goalBehind: goal.pace === 'behind',
  });
  const orientation = computeOrientation({
    news: demoIntelligenceFeed,
    heldSymbols: holdings.map((holding) => holding.symbol),
    watchedSymbols: localWatchlist.map((item) => item.symbol),
  });
  const stripPanels = buildStripPanels(personalData, localWatchlist);
  const allWatchItems = localWatchlist.map((item) => {
    const row = watchRows.find((candidate) => candidate.symbol === item.symbol);
    return row ?? { symbol: item.symbol };
  });

  const replacements = new Map<string, ReactNode>([
    [
      'goal-cockpit',
      <GoalCockpit
        key="solo-goal"
        goal={goal}
        actions={portfolioActions}
        orientation={orientation}
        baseCurrency={capital?.baseCurrency ?? 'USD'}
        currentTarget={null}
        canSetTarget={false}
        isEmptyState={holdings.length === 0 && cashAvailable <= 0}
      />,
    ],
    ['runners', <ExecutiveStrip key="solo-runners" panels={stripPanels} />],
    [
      'metrics',
      <MetricStrip key="solo-metrics" data={personalData} soloMode />,
    ],
    [
      'daily-brief',
      <DailyBriefCard key="solo-brief" data={personalData} market={market} />,
    ],
    [
      'next-best',
      <NextBestActions
        key="solo-next"
        signals={sourceData.signals}
        portfolio={holdings}
        watchlist={allWatchItems}
      />,
    ],
    [
      'charts',
      <HoldingsMomentumBoard
        key="solo-charts"
        holdings={holdings}
        signals={sourceData.signals}
        tickers={sourceData.tickers}
      />,
    ],
    [
      'watchlist',
      <SoloWatchlistSection
        key="solo-watchlist"
        rows={watchRows}
        items={localWatchlist}
      />,
    ],
    [
      'portfolio-exposure',
      <SoloPortfolioExposure key="solo-portfolio" holdings={holdings} />,
    ],
    [
      'compact-feed',
      <SignalTable
        key="solo-compact"
        signals={sourceData.signals.slice(0, 5)}
        compact
        portfolioSymbols={holdings.map((holding) => holding.symbol)}
        watchlistSymbols={localWatchlist.map((item) => item.symbol)}
        title="Compact ticker feed"
      />,
    ],
  ]);

  const personalisedSections = sections.map((section) => ({
    ...section,
    node: replacements.get(section.id) ?? section.node,
  }));

  return (
    <CommandLayout sections={personalisedSections} leading={leading} />
  );
}
