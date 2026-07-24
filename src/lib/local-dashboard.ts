import type {
  ActionState,
  DashboardData,
  PortfolioHolding,
  SignalRow,
  SignalStatus,
  WatchlistRow,
} from '@/types/scanner';
import type { LocalHolding } from '@/lib/local-portfolio';
import type { LocalWatchItem } from '@/lib/local-watchlist';

/**
 * Keep the shared market scan while removing every private-looking sample field.
 * Solo client views then add only the holdings/watchlist that actually exist in
 * this browser. This prevents a seeded demo book from impersonating a new user.
 */
export function buildSoloMarketDashboard(
  source: DashboardData,
  signals: SignalRow[],
): DashboardData {
  return {
    ...source,
    signals,
    portfolio: [],
    watchlist: [],
    alerts: [],
    latestRun: {
      ...source.latestRun,
      portfolioOverlaysCreated: 0,
      watchlistOverlaysCreated: 0,
      alertsSent: 0,
    },
  };
}

/**
 * Convert Solo's browser-local holdings into the same display model used by the
 * account-backed dashboard. Prices and signal fields come from the current scan;
 * the user's quantities and cost basis remain the source of truth.
 */
export function buildLocalPortfolioHoldings(
  local: LocalHolding[],
  signals: SignalRow[],
): PortfolioHolding[] {
  const signalBySymbol = new Map(signals.map((signal) => [signal.symbol, signal]));
  const rows = local.map((holding) => {
    const signal = signalBySymbol.get(holding.symbol);
    const currentPrice =
      signal && signal.close > 0 ? signal.close : holding.averageBuyPrice;
    const cost = holding.averageBuyPrice * holding.quantity;
    const marketValue = currentPrice * holding.quantity;
    const unrealisedPnl = marketValue - cost;
    const unrealisedPnlPercent =
      cost > 0 ? (unrealisedPnl / cost) * 100 : 0;
    return {
      holding,
      signal,
      currentPrice,
      marketValue,
      unrealisedPnl,
      unrealisedPnlPercent,
    };
  });
  const totalValue = rows.reduce((sum, row) => sum + row.marketValue, 0);

  return rows.map(
    ({
      holding,
      signal,
      currentPrice,
      marketValue,
      unrealisedPnl,
      unrealisedPnlPercent,
    }) => ({
      symbol: holding.symbol,
      quantity: holding.quantity,
      averagePrice: holding.averageBuyPrice,
      currentPrice,
      marketValue,
      unrealisedPnl,
      unrealisedPnlPercent,
      portfolioWeight:
        totalValue > 0 ? (marketValue / totalValue) * 100 : 0,
      signalScore: signal?.score ?? 0,
      scoreDelta: signal?.scoreDelta ?? 0,
      signalStatus: (signal?.status ?? 'no_signal') as SignalStatus,
      actionState: (signal?.actionState ?? 'hold') as ActionState,
      rsi: signal?.rsi ?? 0,
      macdState: signal?.macdState ?? 'Tracked',
      riskState: 'neutral' as PortfolioHolding['riskState'],
      suggestedAction: 'Review',
      explanation: signal?.explanation ?? {
        action: 'hold',
        triggeredBecause: [],
        missingConfirmation: [],
        riskNotes: [],
      },
      purchaseDate: holding.purchaseDate,
      notes: holding.notes,
    }),
  );
}

/**
 * Build trigger rows only for local watchlist items that have an explicit target.
 * A missing target is not silently replaced with a fabricated price; the UI renders
 * those names as tracked-only and invites the user to set one.
 */
export function buildLocalWatchlistRows(
  local: LocalWatchItem[],
  signals: SignalRow[],
): WatchlistRow[] {
  const signalBySymbol = new Map(signals.map((signal) => [signal.symbol, signal]));
  const targetSignalScore = 70;

  return local.flatMap((item) => {
    if (
      typeof item.targetBuyPrice !== 'number' ||
      !Number.isFinite(item.targetBuyPrice) ||
      item.targetBuyPrice <= 0
    ) {
      return [];
    }

    const signal = signalBySymbol.get(item.symbol);
    const currentPrice =
      signal && signal.close > 0 ? signal.close : item.targetBuyPrice;
    const distanceToTarget =
      ((currentPrice - item.targetBuyPrice) / item.targetBuyPrice) * 100;
    const invalidated =
      signal?.status === 'invalidated' || signal?.status === 'weakening';
    const priceGateMet = currentPrice <= item.targetBuyPrice;
    const scoreGateMet = (signal?.score ?? 0) >= targetSignalScore;
    const triggerState: WatchlistRow['triggerState'] = invalidated
      ? 'invalidated'
      : priceGateMet && scoreGateMet
        ? 'triggered'
        : distanceToTarget > 0 && distanceToTarget <= 5
          ? 'approaching'
          : 'not_ready';

    return [
      {
        symbol: item.symbol,
        companyName: signal?.companyName ?? item.symbol,
        category: 'Local watchlist',
        targetBuyZone: item.targetBuyPrice,
        currentPrice,
        distanceToTarget,
        signalScore: signal?.score ?? 0,
        scoreDelta: signal?.scoreDelta ?? 0,
        signalStatus: (signal?.status ?? 'no_signal') as SignalStatus,
        triggerState,
        targetSignalScore,
        rsi: signal?.rsi ?? 0,
        macdHistogram: signal?.macdHistogram ?? 0,
        volumeRatio: signal?.volumeRatio ?? 0,
        alertStatus: 'Device only',
        notes: item.notes ?? '',
        explanation: signal?.explanation ?? {
          action: 'hold',
          triggeredBecause: [],
          missingConfirmation: [],
          riskNotes: [],
        },
      },
    ];
  });
}
