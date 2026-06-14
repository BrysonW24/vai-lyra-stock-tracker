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
import { maybeFlagPositionMove } from './notifications-store';

const round2 = (n: number) => Math.round(n * 100) / 100;

// Notional starting paper cash so equity (cash + positions) reads like a real account.
const STARTING_PAPER_CASH = 100000;

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
    // Raise a flag when a position crosses a fresh ±5% band (deduped inside the store).
    maybeFlagPositionMove(p.symbol, unrealisedPnlPct);
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
  const equity = round2(STARTING_PAPER_CASH + unrealisedPnl);
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
  };
}
