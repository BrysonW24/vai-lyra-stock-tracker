/**
 * Paper account - where the bot's simulated fills LIVE so they can be viewed and analysed. Each
 * approved+filled paper order accrues into a position (averaged on adds, reduced on sells); the
 * summary marks positions to the latest scan price so you can see simulated P/L, win signal, and a
 * growing track record. In-memory per server process today (the demo path); a Supabase
 * paper_positions/paper_trades table backs it durably once configured (migration 020 exists).
 *
 * This is the "why" of the paper bot: practise the exact AI-explained, risk-gated, deterministic
 * pipeline with fake money + real prices, building an auditable track record before any real money.
 */
import { getDashboardData } from '@/lib/data';
import { DEFAULT_PAPER_STARTING_CASH } from '@/lib/edge/costs';
import { maybeFlagPositionMove, DEMO_OWNER } from './notifications-store';

const round2 = (n: number) => Math.round(n * 100) / 100;

// Starting paper cash for the in-memory (demo) account. Defaults to a realistic small-account
// balance, NOT a $100k fantasy - a beginner should practise the position sizes they can actually
// take. setPaperStartingCash lets a caller align it to the user's real cash on file.
let STARTING_PAPER_CASH = DEFAULT_PAPER_STARTING_CASH;

/** Align the demo paper account's starting balance to the user's real available cash. */
export function setPaperStartingCash(cash: number): void {
  if (Number.isFinite(cash) && cash > 0) STARTING_PAPER_CASH = round2(cash);
}

// A live, session-scoped equity curve: equity = starting cash + cumulative unrealised P/L, sampled
// each time the account is marked. Durable cross-restart history lands with Supabase persistence.
interface EquityPoint { t: string; equity: number; }
const EQUITY_SERIES: EquityPoint[] = [];
const MAX_POINTS = 120;
let lastSnapshotMs = 0;

function snapshotEquity(equity: number): void {
  const now = Date.now();
  // Seed a baseline point so the curve renders immediately once there's any activity.
  if (EQUITY_SERIES.length === 0) {
    EQUITY_SERIES.unshift({ t: new Date().toISOString(), equity: STARTING_PAPER_CASH });
  }
  // Throttle to >=3s between points; within the window just refresh the latest so the curve stays current.
  if (now - lastSnapshotMs < 3000) {
    EQUITY_SERIES[0] = { t: new Date().toISOString(), equity };
    return;
  }
  EQUITY_SERIES.unshift({ t: new Date().toISOString(), equity });
  lastSnapshotMs = now;
  if (EQUITY_SERIES.length > MAX_POINTS) EQUITY_SERIES.length = MAX_POINTS;
}

export interface PaperPosition {
  symbol: string;
  quantity: number;
  avgEntryPrice: number;
  totalFees: number;
  openedAt: string;
}

export interface RecordedFill {
  symbol: string;
  side: string;
  quantity: number;
  fillPrice: number;
  simulatedFee: number;
}

const POSITIONS = new Map<string, PaperPosition>();
let fillCount = 0;

export interface ClosedTrade {
  symbol: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  realisedPnl: number;
  openedAt: string;
  closedAt: string;
}
const CLOSED: ClosedTrade[] = [];
let realisedTotal = 0;

/**
 * Close a position at the exit price (full close). Computes realised P/L net of entry + exit fees,
 * records a closed round-trip trade, and removes the position. Returns the closed trade, or null when
 * there is nothing to close.
 */
export function closePaperPosition(symbol: string, exitPrice: number, exitFee: number): ClosedTrade | null {
  const key = symbol.toUpperCase();
  const p = POSITIONS.get(key);
  if (!p || p.quantity <= 0) return null;
  const gross = (exitPrice - p.avgEntryPrice) * p.quantity;
  const realised = round2(gross - p.totalFees - exitFee);
  const trade: ClosedTrade = {
    symbol: p.symbol,
    quantity: p.quantity,
    entryPrice: round2(p.avgEntryPrice),
    exitPrice: round2(exitPrice),
    realisedPnl: realised,
    openedAt: p.openedAt,
    closedAt: new Date().toISOString(),
  };
  CLOSED.unshift(trade);
  realisedTotal = round2(realisedTotal + realised);
  POSITIONS.delete(key);
  fillCount += 1;
  return trade;
}

export interface TradeAnalytics {
  realisedPnl: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
}

/** Win rate / expectancy / avg win-loss from an array of realised P/L values (pure, reusable). */
export function computeTradeAnalytics(realisedPnls: number[]): TradeAnalytics {
  const closedTrades = realisedPnls.length;
  const wins = realisedPnls.filter((p) => p > 0);
  const losses = realisedPnls.filter((p) => p <= 0);
  const realisedPnl = round2(realisedPnls.reduce((a, b) => a + b, 0));
  const avgWin = wins.length ? round2(wins.reduce((a, b) => a + b, 0) / wins.length) : 0;
  const avgLoss = losses.length ? round2(Math.abs(losses.reduce((a, b) => a + b, 0)) / losses.length) : 0;
  const winRate = closedTrades ? round2((wins.length / closedTrades) * 100) : 0;
  // Per-trade expected value: p(win)*avgWin - p(loss)*avgLoss.
  const expectancy = closedTrades ? round2((winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss) : 0;
  return { realisedPnl, closedTrades, wins: wins.length, losses: losses.length, winRate, avgWin, avgLoss, expectancy };
}

/** Accrue a simulated fill into the paper account. Buys open/average; sells reduce/close. */
export function recordPaperFill(fill: RecordedFill): void {
  fillCount += 1;
  const key = fill.symbol.toUpperCase();
  const existing = POSITIONS.get(key);
  if (fill.side === 'buy') {
    if (existing) {
      const totalQty = existing.quantity + fill.quantity;
      const avg = (existing.avgEntryPrice * existing.quantity + fill.fillPrice * fill.quantity) / totalQty;
      POSITIONS.set(key, { ...existing, quantity: totalQty, avgEntryPrice: round2(avg), totalFees: round2(existing.totalFees + fill.simulatedFee) });
    } else {
      POSITIONS.set(key, { symbol: key, quantity: fill.quantity, avgEntryPrice: fill.fillPrice, totalFees: fill.simulatedFee, openedAt: new Date().toISOString() });
    }
  } else if (existing) {
    const remaining = existing.quantity - fill.quantity;
    if (remaining <= 0) POSITIONS.delete(key);
    else POSITIONS.set(key, { ...existing, quantity: remaining, totalFees: round2(existing.totalFees + fill.simulatedFee) });
  }
}

export interface PaperAccountSummary {
  positions: Array<PaperPosition & { currentPrice: number; marketValue: number; unrealisedPnl: number; unrealisedPnlPct: number }>;
  totalInvested: number;
  marketValue: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  openPositions: number;
  fillCount: number;
  startingEquity: number;
  equity: number;
  equityCurve: number[];
  // Realised performance from closed round-trip trades.
  realisedPnl: number;
  closedTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  // 'persisted' = durable per-user Supabase data; 'demo' = in-memory session (no auth / not configured).
  dataSource: 'persisted' | 'demo';
}

/** Mark the open positions to the latest scan price and roll up the account analytics. */
export async function getPaperAccountSummary(): Promise<PaperAccountSummary> {
  const data = await getDashboardData();
  const priceOf = (symbol: string) => data.signals.find((s) => s.symbol === symbol)?.close ?? 0;

  let totalInvested = 0;
  let marketValue = 0;
  let totalPnl = 0;
  const positions = [...POSITIONS.values()].map((p) => {
    const currentPrice = priceOf(p.symbol) || p.avgEntryPrice;
    const cost = p.avgEntryPrice * p.quantity;
    const mv = currentPrice * p.quantity;
    totalInvested += cost;
    marketValue += mv;
    const unrealisedPnl = round2(mv - cost - p.totalFees);
    totalPnl += unrealisedPnl;
    const unrealisedPnlPct = cost > 0 ? round2((unrealisedPnl / cost) * 100) : 0;
    // Raise a flag when a position crosses a fresh ±5% band (deduped inside the store). The in-memory
    // store is the demo/single-user path (authed users read the persisted summary), so its flags
    // belong to the shared demo feed.
    maybeFlagPositionMove(DEMO_OWNER, p.symbol, unrealisedPnlPct);
    return {
      ...p,
      currentPrice: round2(currentPrice),
      marketValue: round2(mv),
      unrealisedPnl,
      unrealisedPnlPct,
    };
  });

  // Account P/L sums the fee-inclusive position P/L so the rollup reconciles with the rows.
  const unrealisedPnl = round2(totalPnl);
  const analytics = computeTradeAnalytics(CLOSED.map((t) => t.realisedPnl));
  // Equity = starting cash + locked-in realised P/L + open unrealised P/L.
  const equity = round2(STARTING_PAPER_CASH + analytics.realisedPnl + unrealisedPnl);
  snapshotEquity(equity);
  return {
    positions: positions.sort((a, b) => b.marketValue - a.marketValue),
    totalInvested: round2(totalInvested),
    marketValue: round2(marketValue),
    unrealisedPnl,
    unrealisedPnlPct: totalInvested > 0 ? round2((unrealisedPnl / totalInvested) * 100) : 0,
    openPositions: positions.length,
    fillCount,
    startingEquity: STARTING_PAPER_CASH,
    equity,
    // Oldest -> newest for the sparkline (series stored newest-first).
    equityCurve: [...EQUITY_SERIES].reverse().map((p) => p.equity),
    realisedPnl: analytics.realisedPnl,
    closedTrades: analytics.closedTrades,
    winRate: analytics.winRate,
    avgWin: analytics.avgWin,
    avgLoss: analytics.avgLoss,
    expectancy: analytics.expectancy,
    dataSource: 'demo',
  };
}

/**
 * A zero-state summary. Used when Supabase IS configured but the caller has no session: the
 * process-global in-memory store aggregates every operator's fills, so an anonymous caller in
 * a live deploy must get an empty account, never the shared store (cross-tenant leak).
 */
export function emptyPaperAccountSummary(): PaperAccountSummary {
  return {
    positions: [],
    totalInvested: 0,
    marketValue: 0,
    unrealisedPnl: 0,
    unrealisedPnlPct: 0,
    openPositions: 0,
    fillCount: 0,
    startingEquity: STARTING_PAPER_CASH,
    equity: STARTING_PAPER_CASH,
    equityCurve: [STARTING_PAPER_CASH],
    realisedPnl: 0,
    closedTrades: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    expectancy: 0,
    dataSource: 'demo',
  };
}
