/**
 * Demo-mode trade-log persistence - completes the local-twin family
 * (local-portfolio.ts, local-watchlist.ts).
 *
 * When Supabase isn't configured, `/api/trades` answers {demo:true} and the logged trade
 * used to vanish - the chat said "sign in to save" on a deployment with no accounts to
 * sign into. This stores the log in the browser instead, with the same row shape and the
 * same undo rule the server enforces (reverse-chronological per symbol), so the Trade Log
 * surface renders local rows unchanged. In live (Supabase) mode this is ignored - the DB
 * is the source of truth. Browser-local only; never a secret, never synced.
 */

export interface LocalTradeLog {
  id: string;
  symbol: string;
  side: string;
  notional_value: number;
  quantity_delta: number;
  fill_price: number;
  cash_delta: number;
  status: 'applied' | 'undone';
  source: string | null;
  created_at: string;
  undone_at: string | null;
}

import {
  addLocalHolding,
  loadLocalHoldings,
  removeLocalHolding,
  saveLocalHoldings,
} from './local-portfolio';
import {
  loadOnboardingSummary,
  saveOnboardingSummary,
} from './onboarding-summary';

const KEY = 'lyra.trades.logs';

/** Every id from this store carries this prefix - it is how callers route undo locally. */
export const LOCAL_TRADE_ID_PREFIX = 'local-';

/** Fire after any local-trade mutation so mounted views re-read without a reload. */
export const TRADES_CHANGED_EVENT = 'lyra:trades-changed';

function notify(): void {
  window.dispatchEvent(new Event(TRADES_CHANGED_EVENT));
}

/** Newest first, matching the server's ordering. */
export function loadLocalTradeLogs(): LocalTradeLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t): t is LocalTradeLog =>
          !!t && typeof (t as LocalTradeLog).id === 'string' && typeof (t as LocalTradeLog).symbol === 'string',
      )
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  } catch {
    return [];
  }
}

function persist(logs: LocalTradeLog[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(logs));
    notify();
    return true;
  } catch {
    return false;
  }
}

/**
 * Mirror the server's log_buy_trade/undo_trade_log RPCs against the LOCAL holdings book,
 * so a chat-logged trade actually moves the portfolio the user sees. direction 1 applies
 * the trade; -1 reverses it exactly (the averaging maths inverts cleanly because the log
 * row keeps the original notional). Without this, the chat's "holdings updated"
 * confirmation would be untrue in Solo mode.
 */
function applyTradeToLocalHoldings(log: LocalTradeLog, direction: 1 | -1): boolean {
  const existing = loadLocalHoldings().find((h) => h.symbol === log.symbol);
  const q0 = existing?.quantity ?? 0;
  const a0 = existing?.averageBuyPrice ?? 0;
  const q1 = q0 + log.quantity_delta * direction;
  if (q1 <= 1e-9) {
    // Sold (or reversed) down to nothing - clamp rather than hold a negative position.
    return removeLocalHolding(log.symbol);
  }
  let a1 = a0;
  if (log.side === 'buy') {
    // Buys move the average; sells keep it (realised P&L is the log's own story).
    a1 = (q0 * a0 + log.notional_value * direction) / q1;
    if (!Number.isFinite(a1) || a1 < 0) a1 = log.fill_price;
  }
  return addLocalHolding({ symbol: log.symbol, quantity: q1, averageBuyPrice: a1, notes: existing?.notes });
}

/**
 * Keep Solo's optional onboarding cash balance coherent with the trade log. When the user never
 * supplied cash, there is no ledger to mutate. When they did, a buy cannot take it negative and
 * both apply/undo persist through the same fail-closed storage path as holdings.
 */
function applyTradeToLocalCash(
  log: LocalTradeLog,
  direction: 1 | -1,
): boolean {
  const summary = loadOnboardingSummary();
  const current = summary?.capital?.cashAvailable;
  if (!summary || typeof current !== 'number') return true;
  const next = Math.round((current + log.cash_delta * direction) * 100) / 100;
  if (!Number.isFinite(next) || next < 0) return false;
  return saveOnboardingSummary({
    ...summary,
    capital: {
      ...summary.capital,
      cashAvailable: next,
    },
  });
}

/**
 * Log a trade locally, pricing the fill off the same Yahoo lookup the server uses
 * (`/api/ticker-lookup`, cache-bypassing is the server's concern; for a browser-local
 * research log the 5-minute quote window is honest enough). Returns null when the input
 * cannot make a truthful row - a zero/negative notional or an unknown symbol.
 */
export async function addLocalTradeLog(input: {
  side: string;
  symbol: string;
  notional: number;
  source?: string;
}): Promise<LocalTradeLog | null> {
  const symbol = String(input.symbol).toUpperCase().trim();
  const notional = Number(input.notional);
  if (!symbol || !Number.isFinite(notional) || notional <= 0) return null;

  let price = 0;
  try {
    const res = await fetch(`/api/ticker-lookup?symbol=${encodeURIComponent(symbol)}`);
    const quote = (await res.json()) as { valid?: boolean; price?: number | null };
    if (quote.valid && typeof quote.price === 'number' && quote.price > 0) price = quote.price;
  } catch {
    /* lookup unavailable - refuse below rather than log a made-up fill */
  }
  // No price means no honest quantity or fill - refuse rather than fabricate. The chat
  // surfaces this as a failed action, which is truer than a row claiming a $0 fill.
  if (price <= 0) return null;

  const side = input.side === 'sell' ? 'sell' : 'buy';
  const now = new Date().toISOString();
  const log: LocalTradeLog = {
    id: `${LOCAL_TRADE_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    symbol,
    side,
    notional_value: notional,
    quantity_delta: (side === 'buy' ? 1 : -1) * (notional / price),
    fill_price: price,
    cash_delta: (side === 'buy' ? -1 : 1) * notional,
    status: 'applied',
    source: input.source ?? null,
    created_at: now,
    undone_at: null,
  };
  const previousLogs = loadLocalTradeLogs();
  const previousHoldings = loadLocalHoldings();
  if (!persist([log, ...previousLogs])) return null;
  if (!applyTradeToLocalHoldings(log, 1)) {
    // Keep the two local stores coherent. Rolling back to a smaller payload should succeed even
    // after a quota failure; either way, never report a successful trade with stale holdings.
    persist(previousLogs);
    return null;
  }
  if (!applyTradeToLocalCash(log, 1)) {
    // All three stores are one user-visible transaction. If cash cannot move, restore the
    // holdings and log too so no surface can claim a partially-applied trade.
    saveLocalHoldings(previousHoldings);
    persist(previousLogs);
    return null;
  }
  return log;
}

/**
 * Undo a locally-logged trade. Mirrors the server rule: only the newest APPLIED row for
 * that symbol may be undone, so positions unwind in reverse order.
 */
export function undoLocalTradeLog(id: string): { ok: boolean; error?: string } {
  const logs = loadLocalTradeLogs();
  const target = logs.find((t) => t.id === id);
  if (!target) return { ok: false, error: 'Trade not found on this device.' };
  if (target.status !== 'applied') return { ok: false, error: 'Already undone.' };
  const newestApplied = logs.find((t) => t.symbol === target.symbol && t.status === 'applied');
  if (newestApplied && newestApplied.id !== id) {
    return { ok: false, error: `Undo ${target.symbol} trades in reverse order - newest first.` };
  }
  const nextLogs = logs.map((t) =>
    t.id === id ? { ...t, status: 'undone' as const, undone_at: new Date().toISOString() } : t,
  );
  const previousHoldings = loadLocalHoldings();
  if (!persist(nextLogs)) return { ok: false, error: 'Could not save the undo on this device.' };
  if (!applyTradeToLocalHoldings(target, -1)) {
    persist(logs);
    return { ok: false, error: 'Could not update holdings on this device.' };
  }
  if (!applyTradeToLocalCash(target, -1)) {
    saveLocalHoldings(previousHoldings);
    persist(logs);
    return { ok: false, error: 'Could not update cash on this device.' };
  }
  return { ok: true };
}
