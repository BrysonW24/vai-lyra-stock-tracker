/**
 * Supabase persistence for the paper bot - the "survives restarts + has a track record" layer.
 *
 * This binds the paper bot to the migration-020 tables (paper_accounts / paper_orders / paper_trades
 * / paper_positions) + migration-021 paper_equity_snapshots, all owner-scoped by RLS
 * (auth.uid() = user_id). It uses the SAME cookie-aware, RLS-enforced server client the
 * portfolio/watchlist routes use - never the service role - so a user can only ever touch their own
 * rows. When Supabase is not configured, or no user is signed in, callers fall back to the in-memory
 * store (demo mode): nothing here throws into the request path.
 *
 * Verification boundary: the pure mapping (averaging, rollup) is unit-tested; the live round-trip
 * requires a configured Supabase project + an authenticated session (the demo/sim has neither).
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDashboardData } from '@/lib/data';
import { getPaperAccountSummary as getInMemorySummary, computeTradeAnalytics, type PaperAccountSummary } from './paper-account-store';
import type { OrderIntent } from './types';
import type { PaperFill } from './paper-bot';

type ServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const PAPER_ACCOUNT_NAME = 'Lyra Paper';

// ---- Pure mapping (unit-tested, no I/O) -----------------------------------

export interface DbPosition {
  symbol: string;
  quantity: number;
  average_price: number;
}

/** Weighted-average a buy into an existing position (pure). Sells reduce quantity. */
export function averageIn(
  existing: { quantity: number; average_price: number } | null,
  add: { side: string; quantity: number; fillPrice: number },
): { quantity: number; average_price: number } {
  if (add.side !== 'buy') {
    const remaining = (existing?.quantity ?? 0) - add.quantity;
    return { quantity: Math.max(0, remaining), average_price: existing?.average_price ?? add.fillPrice };
  }
  if (!existing || existing.quantity <= 0) return { quantity: add.quantity, average_price: round2(add.fillPrice) };
  const totalQty = existing.quantity + add.quantity;
  const avg = (existing.average_price * existing.quantity + add.fillPrice * add.quantity) / totalQty;
  return { quantity: totalQty, average_price: round2(avg) };
}

/** Roll persisted rows up into the shared PaperAccountSummary shape (pure). */
export function rollupPersisted(input: {
  positions: DbPosition[];
  feesBySymbol: Record<string, number>;
  priceOf: (symbol: string) => number;
  startingCash: number;
  equityCurve: number[];
  fillCount: number;
  closedRealisedPnls?: number[];
}): PaperAccountSummary {
  let totalInvested = 0;
  let marketValue = 0;
  let totalPnl = 0;
  const positions = input.positions
    .filter((p) => p.quantity > 0)
    .map((p) => {
      const currentPrice = input.priceOf(p.symbol) || p.average_price;
      const cost = p.average_price * p.quantity;
      const mv = currentPrice * p.quantity;
      const fees = input.feesBySymbol[p.symbol] ?? 0;
      totalInvested += cost;
      marketValue += mv;
      const unrealisedPnl = round2(mv - cost - fees);
      totalPnl += unrealisedPnl;
      return {
        symbol: p.symbol,
        quantity: p.quantity,
        avgEntryPrice: round2(p.average_price),
        totalFees: round2(fees),
        openedAt: '',
        currentPrice: round2(currentPrice),
        marketValue: round2(mv),
        unrealisedPnl,
        unrealisedPnlPct: cost > 0 ? round2((unrealisedPnl / cost) * 100) : 0,
      };
    });
  const unrealisedPnl = round2(totalPnl);
  const analytics = computeTradeAnalytics(input.closedRealisedPnls ?? []);
  const equity = round2(input.startingCash + analytics.realisedPnl + unrealisedPnl);
  return {
    positions: positions.sort((a, b) => b.marketValue - a.marketValue),
    totalInvested: round2(totalInvested),
    marketValue: round2(marketValue),
    unrealisedPnl,
    unrealisedPnlPct: totalInvested > 0 ? round2((unrealisedPnl / totalInvested) * 100) : 0,
    openPositions: positions.length,
    fillCount: input.fillCount,
    startingEquity: input.startingCash,
    equity,
    equityCurve: input.equityCurve.length >= 1 ? input.equityCurve : [input.startingCash, equity],
    realisedPnl: analytics.realisedPnl,
    closedTrades: analytics.closedTrades,
    winRate: analytics.winRate,
    avgWin: analytics.avgWin,
    avgLoss: analytics.avgLoss,
    expectancy: analytics.expectancy,
    dataSource: 'persisted',
  };
}

// ---- Auth resolution ------------------------------------------------------

/** The signed-in user + RLS client, or null when Supabase is unconfigured / no session (demo mode). */
async function resolveAuthed(): Promise<{ supabase: ServerClient; userId: string } | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { supabase, userId: data.user.id };
}

async function getOrCreateAccount(supabase: ServerClient, userId: string): Promise<{ id: string; starting_cash: number } | null> {
  const { data: existing } = await supabase
    .from('paper_accounts')
    .select('id, starting_cash')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as { id: string; starting_cash: number };
  const { data: created, error } = await supabase
    .from('paper_accounts')
    .insert([{ user_id: userId, name: PAPER_ACCOUNT_NAME, starting_cash: 100000, current_cash: 100000, currency: 'USD' }])
    .select('id, starting_cash')
    .single();
  if (error || !created) return null;
  return created as { id: string; starting_cash: number };
}

// ---- Public API (auth-aware; safe to call from any request) ----------------

/**
 * Persist a simulated fill if the caller is an authenticated Supabase user. Records the order +
 * trade, updates the averaged position, and snapshots equity. No-op (returns false) in demo mode.
 * Best-effort: never throws into the caller.
 */
export async function persistFillIfAuthed(fill: PaperFill, intent: OrderIntent): Promise<boolean> {
  try {
    const auth = await resolveAuthed();
    if (!auth) return false;
    const { supabase, userId } = auth;
    const account = await getOrCreateAccount(supabase, userId);
    if (!account) return false;
    const now = new Date().toISOString();

    await supabase.from('paper_orders').insert([
      {
        user_id: userId,
        paper_account_id: account.id,
        symbol: fill.symbol,
        side: fill.side,
        order_type: 'market',
        quantity: fill.quantity,
        status: 'filled',
        reason_code: intent.reasonCode,
        filled_at: now,
      },
    ]);

    // The trade row is the canonical fill record; if it fails, do not write a position/snapshot
    // that would misrepresent the account.
    const { error: tradeErr } = await supabase.from('paper_trades').insert([
      {
        user_id: userId,
        paper_account_id: account.id,
        symbol: fill.symbol,
        entry_time: now,
        entry_price: fill.fillPrice,
        quantity: fill.quantity,
        fees: fill.simulatedFee,
        slippage: fill.simulatedSlippage,
        signal_snapshot: intent.signalSnapshot ?? null,
        risk_snapshot: intent.riskSnapshot ?? null,
        thesis_snapshot: intent.aiExplanation ? { ai_explanation: intent.aiExplanation } : null,
      },
    ]);
    if (tradeErr) return false;

    const { data: existing } = await supabase
      .from('paper_positions')
      .select('quantity, average_price')
      .eq('paper_account_id', account.id)
      .eq('symbol', fill.symbol)
      .maybeSingle();
    const existingPos = existing as { quantity: number; average_price: number } | null;
    const next = averageIn(existingPos, fill);
    // Only preserve opened_at when updating a still-OPEN position; reset it on re-entry after a close-out.
    const isReentry = !existingPos || Number(existingPos.quantity) <= 0;
    const { error: posErr } = await supabase.from('paper_positions').upsert(
      [
        {
          user_id: userId,
          paper_account_id: account.id,
          symbol: fill.symbol,
          quantity: next.quantity,
          average_price: next.average_price,
          opened_at: isReentry ? now : undefined,
          updated_at: now,
        },
      ],
      { onConflict: 'paper_account_id,symbol' },
    );
    if (posErr) return false; // a failed position write must not produce a misleading equity snapshot

    // Snapshot equity from the freshly-marked summary so the durable curve is accurate.
    const summary = await readPersistedSummary(supabase, userId, account);
    if (summary) {
      await supabase.from('paper_equity_snapshots').insert([
        { user_id: userId, paper_account_id: account.id, equity: summary.equity, unrealised_pnl: summary.unrealisedPnl },
      ]);
    }
    return true;
  } catch {
    return false; // persistence is best-effort; the in-memory record already succeeded
  }
}

/**
 * Persist a full close for a symbol if authed: mark the open trade rows closed (with realised P/L),
 * record the sell order, delete the position, snapshot equity. No-op in demo mode; best-effort.
 */
export async function persistCloseIfAuthed(symbol: string, exitPrice: number, exitFee: number): Promise<boolean> {
  try {
    const auth = await resolveAuthed();
    if (!auth) return false;
    const { supabase, userId } = auth;
    const account = await getOrCreateAccount(supabase, userId);
    if (!account) return false;
    const sym = symbol.toUpperCase();
    const now = new Date().toISOString();

    const { data: openTrades, error } = await supabase
      .from('paper_trades')
      .select('id, entry_price, quantity, fees')
      .eq('paper_account_id', account.id)
      .eq('symbol', sym)
      .is('exit_time', null);
    if (error) return false;

    let totalQty = 0;
    for (const t of (openTrades ?? []) as Array<{ id: string; entry_price: number; quantity: number; fees: number | null }>) {
      const qty = Number(t.quantity);
      totalQty += qty;
      const realised = round2((exitPrice - Number(t.entry_price)) * qty - Number(t.fees ?? 0));
      await supabase
        .from('paper_trades')
        .update({ exit_time: now, exit_price: exitPrice, realised_pnl: realised, exit_reason: 'manual_close' })
        .eq('id', t.id);
    }

    await supabase.from('paper_orders').insert([
      { user_id: userId, paper_account_id: account.id, symbol: sym, side: 'sell', order_type: 'market', quantity: totalQty, status: 'filled', reason_code: 'manual_close', filled_at: now },
    ]);
    await supabase.from('paper_positions').delete().eq('paper_account_id', account.id).eq('symbol', sym);

    const summary = await readPersistedSummary(supabase, userId, account);
    if (summary) {
      await supabase.from('paper_equity_snapshots').insert([
        { user_id: userId, paper_account_id: account.id, equity: summary.equity, unrealised_pnl: summary.unrealisedPnl },
      ]);
    }
    return true;
  } catch {
    return false;
  }
}

async function readPersistedSummary(
  supabase: ServerClient,
  userId: string,
  account: { id: string; starting_cash: number },
): Promise<PaperAccountSummary | null> {
  const data = await getDashboardData();
  const priceOf = (symbol: string) => data.signals.find((s) => s.symbol === symbol)?.close ?? 0;

  const [posRes, tradeRes, snapRes] = await Promise.all([
    supabase.from('paper_positions').select('symbol, quantity, average_price').eq('paper_account_id', account.id),
    supabase.from('paper_trades').select('symbol, fees, exit_time, realised_pnl').eq('paper_account_id', account.id),
    supabase
      .from('paper_equity_snapshots')
      .select('equity, captured_at')
      .eq('paper_account_id', account.id)
      .order('captured_at', { ascending: true })
      .limit(120),
  ]);
  // If the core reads errored (RLS/network), return null so the caller falls back to in-memory
  // rather than rendering an empty account that looks like data loss.
  if (posRes.error || tradeRes.error) return null;
  const posRows = posRes.data;
  const tradeRows = (tradeRes.data ?? []) as Array<{ symbol: string; fees: number | null; exit_time: string | null; realised_pnl: number | null }>;
  const snapRows = snapRes.data;

  // Fees on still-OPEN entries reduce unrealised P/L; closed entries' fees are already in realised_pnl.
  const feesBySymbol: Record<string, number> = {};
  const closedRealisedPnls: number[] = [];
  for (const t of tradeRows) {
    if (t.exit_time) closedRealisedPnls.push(Number(t.realised_pnl ?? 0));
    else feesBySymbol[t.symbol] = round2((feesBySymbol[t.symbol] ?? 0) + (t.fees ?? 0));
  }

  return rollupPersisted({
    positions: ((posRows ?? []) as DbPosition[]).map((p) => ({ symbol: p.symbol, quantity: Number(p.quantity), average_price: Number(p.average_price) })),
    feesBySymbol,
    priceOf,
    startingCash: Number(account.starting_cash) || 100000,
    equityCurve: ((snapRows ?? []) as Array<{ equity: number }>).map((s) => Number(s.equity)),
    fillCount: tradeRows.length,
    closedRealisedPnls,
  });
}

/**
 * Auth-aware account summary: persisted (durable, per-user) for a signed-in user, else the in-memory
 * session summary (demo). This is what the /api/trading/paper-account endpoint + the CLI should read.
 */
export async function getPaperAccountSummaryAuthAware(): Promise<PaperAccountSummary> {
  try {
    const auth = await resolveAuthed();
    if (auth) {
      const account = await getOrCreateAccount(auth.supabase, auth.userId);
      if (account) {
        const summary = await readPersistedSummary(auth.supabase, auth.userId, account);
        if (summary) return summary;
      }
    }
  } catch {
    /* fall through to in-memory */
  }
  return getInMemorySummary();
}
