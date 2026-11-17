/**
 * Reading the world board: Yahoo's daily chart for every instrument in instruments.ts - the same
 * source the live signals read - turned into a snapshot by compute.ts.
 *
 * Bounded everywhere: each symbol has its own deadline, at most eight are in flight at once, and a
 * symbol that fails is simply missing from the snapshot (and named as missing), never retried into
 * a slow page. The snapshot is the same for everyone, so it is cached for ten minutes in the shared
 * store - but only when most of the board was read: a snapshot taken while the source was failing
 * is served to the one request that took it and never pinned for everyone else.
 */
import { cacheGet, cacheSet } from '@/lib/cache';
import { buildWorldSnapshot, dayIn, describeMove, type DailyBars, type InstrumentMove, type WorldSnapshot } from './compute';
import { WORLD_INSTRUMENTS, type WorldInstrument } from './instruments';

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const SYMBOL_TIMEOUT_MS = 8_000;
const CONCURRENCY = 8;
const SNAPSHOT_TTL_SECONDS = 600;
const SNAPSHOT_KEY = 'world:v1:snapshot';
/** A snapshot is shared only when at least this share of the board was read. */
const SHAREABLE_SHARE = 0.75;

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

/** About six months of daily bars for one symbol, or null when the source did not answer usefully. */
export async function fetchDailyBars(symbol: string, fetchImpl: typeof fetch = fetch): Promise<DailyBars | null> {
  try {
    const res = await fetchImpl(`${YAHOO_CHART}${encodeURIComponent(symbol)}?range=6mo&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(SYMBOL_TIMEOUT_MS),
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

/** Read the whole board now, uncached. */
export async function readWorldSnapshot(nowMs: number = Date.now(), fetchImpl: typeof fetch = fetch): Promise<WorldSnapshot> {
  const series = await inBatches(WORLD_INSTRUMENTS, CONCURRENCY, (instrument) => fetchDailyBars(instrument.symbol, fetchImpl));
  const bars = new Map<string, DailyBars>();
  WORLD_INSTRUMENTS.forEach((instrument, index) => {
    const found = series[index];
    if (found) bars.set(instrument.symbol, found);
  });
  return buildWorldSnapshot(bars, nowMs);
}

/** The world snapshot, shared for ten minutes when it is complete enough to share. */
export async function getWorldSnapshot(nowMs: number = Date.now()): Promise<WorldSnapshot> {
  const hit = await cacheGet<WorldSnapshot>(SNAPSHOT_KEY);
  if (hit && Date.now() - Date.parse(hit.asOf) < SNAPSHOT_TTL_SECONDS * 1000) return hit;
  const snapshot = await readWorldSnapshot(nowMs);
  if (snapshot.moves.length >= Math.ceil(WORLD_INSTRUMENTS.length * SHAREABLE_SHARE)) await cacheSet(SNAPSHOT_KEY, snapshot, SNAPSHOT_TTL_SECONDS);
  return snapshot;
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
