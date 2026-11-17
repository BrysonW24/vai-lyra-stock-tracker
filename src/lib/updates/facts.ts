/**
 * The facts a written update starts from: every scanned name's last completed US session, scored
 * by the same engine and from the same price history as the screen.
 *
 * Lyra's free updates are written on a GitHub runner (workers/stock_scanner/free_daily_read.py) -
 * but the runner does not decide what is true. It asks the app for these rows, and everything it
 * goes on to write is checked against them. The rows are in exactly the shape the worker's
 * `build_facts` already reads (the columns it used to fetch from the database), so the fact sheet,
 * the figures block and the guard are the worker's own, unchanged:
 *
 *   { symbol, category,
 *     stock_signals: [{ candle_time, signal_score, signal_status, volume_ratio }, <the session before>],
 *     stock_candles: [{ candle_time, close }, <the session before>] }
 *
 * Three rules:
 *   * ONLY A SESSION THAT HAS CLOSED. Yahoo's daily series ends with today's moving bar while the
 *     market is open; buildLiveSession steps back to the last finished one.
 *   * ONLY WHAT WAS COMPUTED. A name whose prices could not be fetched has no row. Nothing is
 *     filled in from the authored sample the screen falls back to.
 *   * NOT FROM A HANDFUL. The names must agree on which session it is, and at least 60% of the
 *     listed names must be on it - below that the read would describe a market it did not see.
 */
import { createHash } from 'node:crypto';
import { demoDashboardData } from '@/lib/demo-data';
import { buildLiveSession, newYorkDay, type LiveSession } from '@/lib/live-signals';

export interface SessionSignal {
  candle_time: string;
  signal_score: number;
  signal_status: string;
  volume_ratio: number | null;
}

export interface SessionCandle {
  candle_time: string;
  close: number;
}

export interface SessionRow {
  symbol: string;
  category: string;
  stock_signals: SessionSignal[];
  stock_candles: SessionCandle[];
}

export interface SessionFacts {
  /** The New York day of the session these rows describe (YYYY-MM-DD). */
  session: string;
  /** How many names the scan lists; `rows` holds the ones with a computed session. */
  listed: number;
  rows: SessionRow[];
  /** sha256 of the rows: what a published update quotes to prove which facts it was written from. */
  hash: string;
  computedAt: string;
}

export type SessionFactsResult = { ok: true; facts: SessionFacts } | { ok: false; reason: 'no_prices' | 'thin'; covered: number; listed: number };

/** Below this share of the listed names on one session, there is no read (mirrors the worker's coverage rule). */
export const MIN_COVERAGE = 0.6;
const FETCH_CONCURRENCY = 10;
/** The whole fan-out is given this long; names not reached by then count as missing. */
const COMPUTE_DEADLINE_MS = 40_000;

export interface ListedName {
  symbol: string;
  category: string;
}

/** The names the scan lists, with the group each belongs to. */
export function listedNames(): ListedName[] {
  return demoDashboardData.tickers.filter((ticker) => ticker.isActive !== false).map((ticker) => ({ symbol: ticker.symbol.toUpperCase(), category: ticker.category }));
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

export function rowFor(live: LiveSession, category: string): SessionRow {
  const signal = (bar: LiveSession['session']): SessionSignal => ({
    candle_time: bar.time,
    signal_score: round(bar.score, 2),
    signal_status: bar.status,
    volume_ratio: bar.volumeRatio == null ? null : round(bar.volumeRatio, 3),
  });
  const candle = (bar: LiveSession['session']): SessionCandle => ({ candle_time: bar.time, close: round(bar.close, 4) });
  return {
    symbol: live.symbol.toUpperCase(),
    category,
    stock_signals: [signal(live.session), signal(live.prior)],
    stock_candles: [candle(live.session), candle(live.prior)],
  };
}

/** The session a row is on - the New York day of its newest bar. */
export function sessionOf(live: LiveSession): string {
  return newYorkDay(Date.parse(live.session.time) / 1000);
}

/** sha256 of the rows as JSON. The rows are built in a fixed key order and sorted by symbol, so the same facts always hash the same. */
export function hashRows(rows: SessionRow[]): string {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

/**
 * Turn what was computed into the facts for ONE session: the session most names are on (a name
 * that has not traded since - halted, or its prices lagging - is left out rather than mixed in),
 * and nothing at all when too few names are on it.
 */
export function assembleFacts(computed: Array<{ name: ListedName; live: LiveSession | null }>, computedAt: string): SessionFactsResult {
  const listed = computed.length;
  const live = computed.filter((item): item is { name: ListedName; live: LiveSession } => item.live !== null);
  if (live.length === 0) return { ok: false, reason: 'no_prices', covered: 0, listed };

  const tally = new Map<string, number>();
  for (const item of live) tally.set(sessionOf(item.live), (tally.get(sessionOf(item.live)) ?? 0) + 1);
  // The most common session; on a tie, the later one.
  const session = [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0]![0];
  const rows = live
    .filter((item) => sessionOf(item.live) === session)
    .map((item) => rowFor(item.live, item.name.category))
    .sort((a, b) => (a.symbol < b.symbol ? -1 : 1));
  if (rows.length / listed < MIN_COVERAGE) return { ok: false, reason: 'thin', covered: rows.length, listed };
  return { ok: true, facts: { session, listed, rows, hash: hashRows(rows), computedAt } };
}

/** Compute every listed name's last completed session, a bounded number at a time, inside one deadline. */
export async function computeSessionFacts(nowMs: number = Date.now()): Promise<SessionFactsResult> {
  const names = listedNames();
  const computed: Array<{ name: ListedName; live: LiveSession | null }> = names.map((name) => ({ name, live: null }));
  const deadline = Date.now() + COMPUTE_DEADLINE_MS;
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < names.length && Date.now() < deadline) {
      const index = cursor++;
      computed[index]!.live = await buildLiveSession(names[index]!.symbol, nowMs).catch(() => null);
    }
  }
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, names.length) }, worker));
  return assembleFacts(computed, new Date(nowMs).toISOString());
}

/**
 * Which session is the newest completed one, from a single name - cheap enough to ask on every
 * request, so the full fan-out runs once per session rather than once per caller.
 */
export async function currentSession(nowMs: number = Date.now()): Promise<string | null> {
  for (const probe of ['AAPL', 'MSFT', 'NVDA']) {
    const live = await buildLiveSession(probe, nowMs).catch(() => null);
    if (live) return sessionOf(live);
  }
  return null;
}
