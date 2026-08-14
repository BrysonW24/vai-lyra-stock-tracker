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
    // Solo is a distinct mode from demo: Supabase is absent but the user's own holdings/watchlist
    // live in this browser. Stamping it here stops surfaces re-deriving Solo from isSupabaseConfigured().
    mode: 'solo',
    signals,
    portfolio: [],
    watchlist: [],
    alerts: [],
    // The '...source' spread used to carry the AUTHORED demo signal-change rows into
    // Solo's Live Wire (2026-08-14 audit). Solo has no recorded change history - empty
    // is the truth, same ruling as the live path in data.ts.
    signalChanges: [],
    latestRun: {
      ...source.latestRun,
      portfolioOverlaysCreated: 0,
      watchlistOverlaysCreated: 0,
      alertsSent: 0,
    },
  };
}

/**
 * Solo port of the worker's `risk_state_for` (portfolio_engine.py:6-21) - the SAME rules the
 * account-backed engine uses, so a Solo user's protect-capital exits fire identically. Deriving it
 * (rather than the old hardcoded 'neutral') is the 2026-07-27 audit V4 fix: a Solo holding the
 * scanner has marked invalidated/weakening now surfaces the exit/reduce-risk action that
 * computePortfolioActions keys off riskState, instead of being silently downgraded to neutral.
 */
function soloRiskState(
  signalStatus: SignalStatus,
  unrealisedPct: number,
  rsi: number,
): PortfolioHolding['riskState'] {
  if (signalStatus === 'invalidated') return 'invalidated';
  if (unrealisedPct > 20 && rsi > 70) return 'overextended';
  if (signalStatus === 'weakening') return 'elevated_risk';
  if (signalStatus === 'strong_setup') return 'opportunity';
  if (signalStatus === 'watchlist_setup') return 'watch';
  return 'neutral';
}

/** Plain-English action per risk state - mirrors data.ts ACTION_SUGGESTION intent for Solo rows. */
const SOLO_RISK_SUGGESTION: Record<PortfolioHolding['riskState'], string> = {
  invalidated: 'Exit review',
  elevated_risk: 'Reduce risk',
  overextended: 'Take some profit',
  opportunity: 'Add review',
  watch: 'Watch',
  neutral: 'Hold',
  low_risk: 'Hold',
};

/**
 * Convert Solo's browser-local holdings into the same display model used by the
 * account-backed dashboard. Prices and signal fields come from the current scan;
 * the user's quantities and cost basis remain the source of truth. Cost basis includes
 * the user's brokerage fee so Solo P/L matches the worker's fee-inclusive cost base
 * (portfolio_engine.py:45) rather than reading slightly higher.
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
    const fee = typeof holding.brokerageFee === 'number' && holding.brokerageFee > 0 ? holding.brokerageFee : 0;
    const cost = holding.averageBuyPrice * holding.quantity + fee;
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
    }) => {
      const signalStatus = (signal?.status ?? 'no_signal') as SignalStatus;
      const rsi = signal?.rsi ?? 0;
      const riskState = soloRiskState(signalStatus, unrealisedPnlPercent, rsi);
      return {
        // Solo rows have no DB id; the portfolio page removes them by symbol from local storage.
        id: null,
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
        signalStatus,
        actionState: (signal?.actionState ?? 'hold') as ActionState,
        rsi,
        // Outside the scanned universe there is no engine read at all - the zeros above
        // are structural placeholders and PortfolioView renders "not scanned" instead.
        scanned: signal != null,
        macdState: signal?.macdState ?? 'Not scanned',
        riskState,
        suggestedAction: SOLO_RISK_SUGGESTION[riskState],
        brokerageFee: holding.brokerageFee ?? null,
        explanation: signal?.explanation ?? {
          action: 'hold',
          triggeredBecause: [],
          missingConfirmation: [],
          riskNotes: [],
        },
        purchaseDate: holding.purchaseDate,
        notes: holding.notes,
      };
    },
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
  // The form's stated default. Rows saved before the threshold was persisted fall back to
  // it; a hardcoded 70 here used to make the board narrate a target the user never set.
  const DEFAULT_TARGET_SIGNAL_SCORE = 60;

  return local.flatMap((item) => {
    if (
      typeof item.targetBuyPrice !== 'number' ||
      !Number.isFinite(item.targetBuyPrice) ||
      item.targetBuyPrice <= 0
    ) {
      return [];
    }

    const signal = signalBySymbol.get(item.symbol);
    const targetSignalScore = item.targetSignalScore ?? DEFAULT_TARGET_SIGNAL_SCORE;
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
