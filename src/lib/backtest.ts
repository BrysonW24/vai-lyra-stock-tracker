/**
 * Backtest + Paper Trading Types and Demo Data
 *
 * RESEARCH SOFTWARE ONLY. No broker integration, no real orders, no credentials.
 * All backtests and paper trades are hypothetical simulations for research purposes.
 *
 * This library provides TypeScript types and deterministic demo data for:
 * - Backtest results (win rate, drawdown, profit factor, etc.)
 * - Paper trade ledgers (open/closed positions, P/L)
 * - Portfolio snapshots (equity, unrealized P/L)
 *
 * Demo data is generated deterministically and is safe for UI rendering.
 */

/**
 * A single hypothetical trade outcome.
 */
export interface BacktestTrade {
  sequenceNum: number;
  symbol: string;
  entrySignalTime: string; // ISO 8601
  entryTime: string; // ISO 8601
  entryPrice: number;
  quantity: number;
  exitSignalTime: string | null;
  exitTime: string | null;
  exitPrice: number | null;
  exitReason: string;
  realisedPl: number | null;
  realisedPlPct: number | null;
  barsHeld: number | null;
}

/**
 * Aggregate performance metrics from a backtest run.
 */
export interface BacktestResults {
  symbol: string;
  winRate: number;
  winCount: number;
  lossCount: number;
  avgReturn: number | null;
  medianReturn: number | null;
  maxReturn: number | null;
  minReturn: number | null;
  maxDrawdown: number;
  profitFactor: number;
  expectancy: number | null;
  sampleSize: number;
  trades: BacktestTrade[];
}

/**
 * A single paper trade record.
 */
export interface PaperTrade {
  id: string;
  symbol: string;
  openedAt: string; // ISO 8601
  entryPrice: number;
  quantity: number;
  stopPrice: number | null;
  targetPrice: number | null;
  closedAt: string | null;
  exitPrice: number | null;
  exitReason: string | null;
  realisedPl: number | null;
  realisedPlPct: number | null;
  status: "open" | "closed";
  notes: string | null;
}

/**
 * Snapshot of total portfolio P/L and position state.
 */
export interface PortfolioState {
  initialCapital: number;
  currentEquity: number;
  realisedPl: number;
  unrealisedPl: number;
  totalPl: number;
  totalPlPct: number;
  openPositionsCount: number;
  closedTradesCount: number;
  openTrades: PaperTrade[];
  closedTrades: PaperTrade[];
}

/**
 * Backtest run metadata and results.
 */
export interface BacktestRun {
  id: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  params: Record<string, unknown>;
  startedAt: string; // ISO 8601
  finishedAt: string | null;
  status: "running" | "completed" | "failed";
  errorMessage: string | null;
  results: BacktestResults | null;
}

/**
 * Paper trading session with portfolio state over time.
 */
export interface PaperTradingSession {
  id: string;
  name: string;
  createdAt: string; // ISO 8601
  initialCapital: number;
  currentPortfolioState: PortfolioState;
  trades: PaperTrade[];
  snapshots: PortfolioSnapshot[];
}

/**
 * Historical snapshot of portfolio state.
 */
export interface PortfolioSnapshot {
  snapshotTime: string; // ISO 8601
  initialCapital: number;
  currentValue: number;
  realisedPl: number;
  unrealisedPl: number;
  totalPl: number;
  openPositionCount: number;
  closedTradeCount: number;
}

/**
 * Demo backtest result for NVDA over a 30-day period with strong setup entries.
 * This is synthetic deterministic data suitable for UI testing.
 */
export function getDemoBacktest(strategyId: string): BacktestRun {
  const now = new Date("2026-06-03T16:00:00Z");
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const demoTrades: BacktestTrade[] = [
    {
      sequenceNum: 1,
      symbol: "NVDA",
      entrySignalTime: thirtyDaysAgo.toISOString(),
      entryTime: new Date(thirtyDaysAgo.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      entryPrice: 120.5,
      quantity: 100,
      exitSignalTime: new Date(thirtyDaysAgo.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      exitTime: new Date(thirtyDaysAgo.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      exitPrice: 128.3,
      exitReason: "take_profit",
      realisedPl: 780.0,
      realisedPlPct: 6.47,
      barsHeld: 5,
    },
    {
      sequenceNum: 2,
      symbol: "NVDA",
      entrySignalTime: new Date(thirtyDaysAgo.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      entryTime: new Date(thirtyDaysAgo.getTime() + 8 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
      entryPrice: 125.2,
      quantity: 100,
      exitSignalTime: new Date(thirtyDaysAgo.getTime() + 13 * 24 * 60 * 60 * 1000).toISOString(),
      exitTime: new Date(thirtyDaysAgo.getTime() + 13 * 24 * 60 * 60 * 1000).toISOString(),
      exitPrice: 122.8,
      exitReason: "stop_loss",
      realisedPl: -240.0,
      realisedPlPct: -2.42,
      barsHeld: 5,
    },
    {
      sequenceNum: 3,
      symbol: "NVDA",
      entrySignalTime: new Date(thirtyDaysAgo.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      entryTime: new Date(thirtyDaysAgo.getTime() + 15 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
      entryPrice: 123.4,
      quantity: 100,
      exitSignalTime: new Date(thirtyDaysAgo.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      exitTime: new Date(thirtyDaysAgo.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      exitPrice: 131.6,
      exitReason: "take_profit",
      realisedPl: 820.0,
      realisedPlPct: 6.65,
      barsHeld: 5,
    },
    {
      sequenceNum: 4,
      symbol: "NVDA",
      entrySignalTime: new Date(thirtyDaysAgo.getTime() + 22 * 24 * 60 * 60 * 1000).toISOString(),
      entryTime: new Date(thirtyDaysAgo.getTime() + 22 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
      entryPrice: 129.7,
      quantity: 100,
      exitSignalTime: new Date(thirtyDaysAgo.getTime() + 27 * 24 * 60 * 60 * 1000).toISOString(),
      exitTime: new Date(thirtyDaysAgo.getTime() + 27 * 24 * 60 * 60 * 1000).toISOString(),
      exitPrice: 134.5,
      exitReason: "horizon_exit",
      realisedPl: 480.0,
      realisedPlPct: 3.7,
      barsHeld: 5,
    },
  ];

  const demoResults: BacktestResults = {
    symbol: "NVDA",
    winRate: 75.0,
    winCount: 3,
    lossCount: 1,
    avgReturn: 3.6,
    medianReturn: 5.06,
    maxReturn: 6.65,
    minReturn: -2.42,
    maxDrawdown: 8.2,
    profitFactor: 2.71,
    expectancy: 3.6,
    sampleSize: 4,
    trades: demoTrades,
  };

  return {
    id: `backtest_${Date.now()}`,
    strategyName: strategyId || "momentum_recovery_v1",
    symbol: "NVDA",
    timeframe: "1h",
    params: {
      entryRule: "strong_setup",
      horizonBars: 5,
      stopLossPct: 3.0,
      takeProfitPct: 7.0,
    },
    startedAt: thirtyDaysAgo.toISOString(),
    finishedAt: now.toISOString(),
    status: "completed",
    errorMessage: null,
    results: demoResults,
  };
}

/**
 * Demo paper trading session with mixed open and closed positions.
 * This is synthetic deterministic data suitable for UI testing.
 */
export function getDemoPaperTradingSession(): PaperTradingSession {
  const now = new Date("2026-06-03T16:00:00Z");
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const closedTrades: PaperTrade[] = [
    {
      id: "pt_001",
      symbol: "NVDA",
      openedAt: fiveDaysAgo.toISOString(),
      entryPrice: 120.5,
      quantity: 100,
      stopPrice: 117.0,
      targetPrice: 128.0,
      closedAt: new Date(fiveDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      exitPrice: 128.3,
      exitReason: "take_profit",
      realisedPl: 780.0,
      realisedPlPct: 6.47,
      status: "closed",
      notes: "Hit target in 2 days",
    },
  ];

  const openTrades: PaperTrade[] = [
    {
      id: "pt_002",
      symbol: "AMD",
      openedAt: twoDaysAgo.toISOString(),
      entryPrice: 169.5,
      quantity: 80,
      stopPrice: 164.0,
      targetPrice: 180.0,
      closedAt: null,
      exitPrice: null,
      exitReason: null,
      realisedPl: null,
      realisedPlPct: null,
      status: "open",
      notes: "Recovery setup triggered",
    },
    {
      id: "pt_003",
      symbol: "CRM",
      openedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      entryPrice: 271.2,
      quantity: 50,
      stopPrice: 263.0,
      targetPrice: 285.0,
      closedAt: null,
      exitPrice: null,
      exitReason: null,
      realisedPl: null,
      realisedPlPct: null,
      status: "open",
      notes: "Watchlist trigger entry",
    },
  ];

  const allTrades = [...closedTrades, ...openTrades];

  const currentPrices: Record<string, number> = {
    NVDA: 128.3,
    AMD: 175.2,
    CRM: 278.5,
  };

  const unrealizedPl =
    (175.2 - 169.5) * 80 +
    (278.5 - 271.2) * 50;
  const realizedPl = 780.0;
  const totalPl = realizedPl + unrealizedPl;
  const initialCapital = 100000.0;

  const portfolioState: PortfolioState = {
    initialCapital: initialCapital,
    currentEquity: initialCapital + totalPl,
    realisedPl: realizedPl,
    unrealisedPl: unrealizedPl,
    totalPl: totalPl,
    totalPlPct: (totalPl / initialCapital) * 100,
    openPositionsCount: openTrades.length,
    closedTradesCount: closedTrades.length,
    openTrades: openTrades,
    closedTrades: closedTrades,
  };

  const snapshots: PortfolioSnapshot[] = [
    {
      snapshotTime: fiveDaysAgo.toISOString(),
      initialCapital: initialCapital,
      currentValue: initialCapital + 0,
      realisedPl: 0,
      unrealisedPl: 0,
      totalPl: 0,
      openPositionCount: 0,
      closedTradeCount: 0,
    },
    {
      snapshotTime: twoDaysAgo.toISOString(),
      initialCapital: initialCapital,
      currentValue: initialCapital + 780.0,
      realisedPl: 780.0,
      unrealisedPl: 0,
      totalPl: 780.0,
      openPositionCount: 1,
      closedTradeCount: 1,
    },
    {
      snapshotTime: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      initialCapital: initialCapital,
      currentValue: initialCapital + 780.0 + (175.2 - 169.5) * 80,
      realisedPl: 780.0,
      unrealisedPl: (175.2 - 169.5) * 80,
      totalPl: 780.0 + (175.2 - 169.5) * 80,
      openPositionCount: 2,
      closedTradeCount: 1,
    },
    {
      snapshotTime: now.toISOString(),
      initialCapital: initialCapital,
      currentValue: initialCapital + totalPl,
      realisedPl: realizedPl,
      unrealisedPl: unrealizedPl,
      totalPl: totalPl,
      openPositionCount: 2,
      closedTradeCount: 1,
    },
  ];

  return {
    id: `session_${Date.now()}`,
    name: "Demo Paper Trading Session",
    createdAt: fiveDaysAgo.toISOString(),
    initialCapital: initialCapital,
    currentPortfolioState: portfolioState,
    trades: allTrades,
    snapshots: snapshots,
  };
}

/**
 * Helper to format performance metrics for display.
 */
export function formatBacktestMetrics(results: BacktestResults): string {
  return `
Backtest Results (${results.symbol}):
  Sample Size: ${results.sampleSize} trades
  Win Rate: ${results.winRate.toFixed(1)}% (${results.winCount}W / ${results.lossCount}L)
  Avg Return: ${results.avgReturn?.toFixed(2) ?? "N/A"}%
  Max Drawdown: ${results.maxDrawdown.toFixed(2)}%
  Profit Factor: ${results.profitFactor.toFixed(2)}x
  Expectancy: ${results.expectancy?.toFixed(2) ?? "N/A"}%
  `.trim();
}

/**
 * Helper to format portfolio P/L for display.
 */
export function formatPortfolioMetrics(state: PortfolioState): string {
  return `
Portfolio State:
  Capital: $${state.initialCapital.toFixed(0)}
  Current Equity: $${state.currentEquity.toFixed(2)}
  Realized P/L: $${state.realisedPl.toFixed(2)}
  Unrealized P/L: $${state.unrealisedPl.toFixed(2)}
  Total P/L: $${state.totalPl.toFixed(2)} (${state.totalPlPct.toFixed(2)}%)
  Open Positions: ${state.openPositionsCount}
  Closed Trades: ${state.closedTradesCount}
  `.trim();
}
