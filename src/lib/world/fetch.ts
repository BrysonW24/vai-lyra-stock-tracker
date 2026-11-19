/**
 * Reading the world board: Yahoo's daily chart for every instrument in instruments.ts - the same
 * source the live signals read - turned into a snapshot by compute.ts.
 *
 * Bounded everywhere: each symbol has its own deadline, at most eight are in flight at once, and the
 * whole board has one too - a symbol not read by then is missing, like one that failed (and named as
 * missing), never retried into a slow page. A stalling source costs a reader seconds, not the forty
 * it took for eight workers to walk five symbols each through an eight-second timeout.
 *
 * The snapshot is the same for everyone, so it is kept in the shared store: for ten minutes when most
 * of the board was read, and for one minute when it was not - long enough that a failing source is
 * asked about once a minute instead of on every view, short enough that a recovered one is back
 * within the minute. One read at a time refills it: requests in the same server instance share the
 * read already running, and across instances a short lock in the shared store lets one request read
 * while the others wait for its copy - or, if none comes, serve the last one.
 */
import { cacheGet, cacheSet, sharedStoreConfigured, upstashCommand } from '@/lib/cache';
import { buildWorldSnapshot, dayIn, describeMove, type DailyBars, type InstrumentMove, type WorldSnapshot } from './compute';
import { WORLD_INSTRUMENTS, type WorldInstrument } from './instruments';

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const SYMBOL_TIMEOUT_MS = 8_000;
const CONCURRENCY = 8;
/** The whole board is read within this: a symbol not answered by then is missing. */
export const BOARD_DEADLINE_MS = 8_000;
const SNAPSHOT_KEY = 'world:v2:snapshot';
/** How long a snapshot is served before it is read again: most of the board read, or not. */
const FRESH_SECONDS = 600;
const DEGRADED_FRESH_SECONDS = 60;
/** How long the last copy stays in the store, to serve while another request reads the board. */
const KEEP_SECONDS = 1_800;
/** A raw store command, so the app's `lyra:` prefix is written here. Outlives one board read. */
const REFILL_LOCK_KEY = 'lyra:world:v2:refill';
const REFILL_LOCK_SECONDS = 15;
/** How long a request waits for another instance's read: its deadline, the store write and a margin. */
const REFILL_WAIT_MS = BOARD_DEADLINE_MS + 2_000;
const REFILL_POLL_MS = 250;
/** A snapshot is complete - served for the full ten minutes - when at least this share was read. */
const COMPLETE_SHARE = 0.75;

/** A ticker as people type it, including Yahoo's exchange suffixes: NVDA, CBA.AX, 005930.KS, ES=F, ^N225. */
export const QUOTE_SYMBOL_RE = /^\^?[A-Z0-9][A-Z0-9.=-]{0,14}$/;

interface ChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: Array<number | null>;
      meta?: {
        exchangeTimezoneName?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        currentTradingPeriod?: { regular?: { start?: number; end?: number } };
      };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
}

const isPrice = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Parse one chart response. Exported for tests; a malformed response is null, never a guess.
 *
 * Right after a session closes, Yahoo often has the day's last price (`regularMarketPrice`, traded
 * at `regularMarketTime`) before it has written the day's bar - the bar is there with a null close,
 * or not there at all. Dropping it would report the PREVIOUS session's move under today's date (the
 * Nikkei's Monday close shown as Tuesday's, found 2026-11-18). So the latest trade fills the bar of
 * the exchange day it was made on, or becomes that day's bar when the day has none yet - the same
 * rule the session facts follow since v0.138.1.
 */
export function parseChart(json: unknown): DailyBars | null {
  const result = (json as ChartResponse | null)?.chart?.result?.[0];
  const meta = result?.meta;
  const timezone = meta?.exchangeTimezoneName || 'UTC';
  const stamps = result?.timestamp ?? [];
  const rawCloses = result?.indicators?.quote?.[0]?.close ?? [];
  const closes: number[] = [];
  const times: number[] = [];
  let lastStamp: number | null = null;
  for (let i = 0; i < Math.min(stamps.length, rawCloses.length); i++) {
    const close = rawCloses[i];
    const stamp = stamps[i];
    if (typeof stamp !== 'number' || !Number.isFinite(stamp)) continue;
    lastStamp = stamp;
    if (isPrice(close)) {
      closes.push(close);
      times.push(stamp);
    }
  }
  const tradePrice = meta?.regularMarketPrice;
  const tradeTime = meta?.regularMarketTime;
  if (isPrice(tradePrice) && typeof tradeTime === 'number' && Number.isFinite(tradeTime) && closes.length > 0) {
    const tradeDay = dayIn(tradeTime, timezone);
    const lastKeptDay = dayIn(times[times.length - 1]!, timezone);
    if (tradeDay > lastKeptDay) {
      // The day's bar is missing or has no close yet: the latest trade is that day's price.
      closes.push(tradePrice);
      times.push(lastStamp !== null && dayIn(lastStamp, timezone) === tradeDay ? lastStamp : tradeTime);
    }
  }
  if (closes.length < 2) return null;
  const regular = meta?.currentTradingPeriod?.regular;
  const period =
    typeof regular?.start === 'number' && typeof regular?.end === 'number' && regular.end > regular.start ? { start: regular.start, end: regular.end } : null;
  return { closes, times, timezone, period };
}

/** About six months of daily bars for one symbol, or null when the source did not answer usefully in time. */
export async function fetchDailyBars(symbol: string, fetchImpl: typeof fetch = fetch, timeoutMs: number = SYMBOL_TIMEOUT_MS): Promise<DailyBars | null> {
  try {
    const res = await fetchImpl(`${YAHOO_CHART}${encodeURIComponent(symbol)}?range=6mo&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(Math.max(1, Math.round(timeoutMs))),
    });
    if (!res.ok) return null;
    return parseChart(await res.json());
  } catch {
    return null;
  }
}

async function inBatches<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await work(items[index]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Read the whole board now, uncached, within `budgetMs`: each symbol gets what is left of it (at
 * most its own eight seconds), and a symbol not started by then is missing rather than waited for.
 */
export async function readWorldSnapshot(nowMs: number = Date.now(), fetchImpl: typeof fetch = fetch, budgetMs: number = BOARD_DEADLINE_MS): Promise<WorldSnapshot> {
  const stopAt = Date.now() + budgetMs;
  const series = await inBatches(WORLD_INSTRUMENTS, CONCURRENCY, (instrument) => {
    const left = stopAt - Date.now();
    return left > 0 ? fetchDailyBars(instrument.symbol, fetchImpl, Math.min(SYMBOL_TIMEOUT_MS, left)) : Promise.resolve(null);
  });
  const bars = new Map<string, DailyBars>();
  WORLD_INSTRUMENTS.forEach((instrument, index) => {
    const found = series[index];
    if (found) bars.set(instrument.symbol, found);
  });
  return buildWorldSnapshot(bars, nowMs);
}

function complete(snapshot: WorldSnapshot): boolean {
  return snapshot.moves.length >= Math.ceil(WORLD_INSTRUMENTS.length * COMPLETE_SHARE);
}

/** Still good to serve at `nowMs`: ten minutes for a complete board, one for a partial one. */
function fresh(snapshot: WorldSnapshot, nowMs: number): boolean {
  const age = nowMs - Date.parse(snapshot.asOf);
  return Number.isFinite(age) && age < (complete(snapshot) ? FRESH_SECONDS : DEGRADED_FRESH_SECONDS) * 1000;
}

/** The read this server instance is running now, which every request that arrives meanwhile shares. */
let inFlight: Promise<WorldSnapshot> | null = null;

/** Test seam: forget the read in flight, so one test's never-answering source cannot reach the next. */
export function resetWorldSnapshotForTests(): void {
  inFlight = null;
}

/**
 * True when this request should read the board: it took the refill lock, or there is no shared store
 * (so no other instance to wait for), or the store did not answer - a lock is an optimisation, and
 * must never keep the board from being read.
 */
async function takeRefillLock(): Promise<boolean> {
  if (!sharedStoreConfigured()) return true;
  try {
    return (await upstashCommand(['SET', REFILL_LOCK_KEY, '1', 'NX', 'EX', REFILL_LOCK_SECONDS])) === 'OK';
  } catch {
    return true;
  }
}

/** Another instance's new copy, looked for until REFILL_WAIT_MS has passed - or null. */
async function waitForCopy(previousAsOf: string | null, nowMs: number): Promise<WorldSnapshot | null> {
  const giveUpAt = Date.now() + REFILL_WAIT_MS;
  while (Date.now() < giveUpAt) {
    await new Promise((resolve) => setTimeout(resolve, REFILL_POLL_MS));
    const copy = await cacheGet<WorldSnapshot>(SNAPSHOT_KEY);
    if (copy && copy.asOf !== previousAsOf && fresh(copy, nowMs)) return copy;
  }
  return null;
}

async function refill(nowMs: number, fetchImpl: typeof fetch, last: WorldSnapshot | null): Promise<WorldSnapshot> {
  if (!(await takeRefillLock())) {
    const landed = await waitForCopy(last?.asOf ?? null, nowMs);
    if (landed) return landed;
    if (last) return last;
    // The other read never landed and there is nothing older to show: read it here.
  }
  const snapshot = await readWorldSnapshot(nowMs, fetchImpl);
  // Kept past its freshness so it can be served while the next read runs; `fresh` decides when that is.
  await cacheSet(SNAPSHOT_KEY, snapshot, KEEP_SECONDS);
  return snapshot;
}

/**
 * The world snapshot, shared by everyone: ten minutes when most of the board was read, one minute
 * when it was not. A request that finds no fresh copy joins the read this instance is already
 * running, or takes the refill lock and reads the board, or - when another instance holds the lock -
 * waits for that instance's copy, and serves the last copy if none comes.
 */
export async function getWorldSnapshot(nowMs: number = Date.now(), fetchImpl: typeof fetch = fetch): Promise<WorldSnapshot> {
  const copy = await cacheGet<WorldSnapshot>(SNAPSHOT_KEY);
  if (copy && fresh(copy, nowMs)) return copy;
  if (!inFlight) {
    inFlight = refill(nowMs, fetchImpl, copy).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Yahoo suffix -> where a typed ticker trades, for the wording of a holding's line. */
const SUFFIX_MARKET: Record<string, { region: WorldInstrument['region']; market: string }> = {
  AX: { region: 'australia', market: 'Australia' },
  T: { region: 'asia', market: 'Japan' },
  KS: { region: 'asia', market: 'Korea' },
  KQ: { region: 'asia', market: 'Korea' },
  HK: { region: 'asia', market: 'Hong Kong' },
  SS: { region: 'asia', market: 'China' },
  SZ: { region: 'asia', market: 'China' },
  TW: { region: 'asia', market: 'Taiwan' },
  L: { region: 'europe', market: 'UK' },
  DE: { region: 'europe', market: 'Germany' },
  PA: { region: 'europe', market: 'France' },
  AS: { region: 'europe', market: 'Netherlands' },
  SW: { region: 'europe', market: 'Switzerland' },
};

/**
 * One holding's move, priced on demand - for any ticker a reader holds, not only the board's. The
 * board's own instrument is used when the symbol is on it; anything else is read as a share.
 */
export async function describeHolding(symbol: string, nowMs: number = Date.now(), fetchImpl: typeof fetch = fetch): Promise<InstrumentMove | null> {
  const upper = symbol.trim().toUpperCase();
  if (!QUOTE_SYMBOL_RE.test(upper)) return null;
  const known = WORLD_INSTRUMENTS.find((instrument) => instrument.symbol === upper);
  const suffix = upper.includes('.') ? upper.split('.').pop() ?? '' : '';
  const where = SUFFIX_MARKET[suffix] ?? { region: 'us' as const, market: 'US' };
  const instrument: WorldInstrument = known ?? { symbol: upper, label: upper, region: where.region, market: where.market, kind: 'stock' };
  const bars = await fetchDailyBars(upper, fetchImpl);
  return bars ? describeMove(instrument, bars, nowMs) : null;
}

/** Several holdings at once, bounded like the board. Unreadable symbols come back as null in place. */
export async function describeHoldings(symbols: readonly string[], nowMs: number = Date.now(), fetchImpl: typeof fetch = fetch): Promise<Array<InstrumentMove | null>> {
  return inBatches(symbols, CONCURRENCY, (symbol) => describeHolding(symbol, nowMs, fetchImpl));
}
