import { cacheGet, cacheSet } from '@/lib/cache';

export interface MarketQuote {
  valid: boolean;
  symbol: string;
  name: string | null;
  price: number | null;
  currency: string | null;
  exchange: string | null;
  changePercent: number | null;
  error?: string;
}

interface YahooMeta {
  symbol?: string;
  currency?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  shortName?: string;
  longName?: string;
}

async function lookupYahoo(symbol: string): Promise<YahooMeta | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { chart?: { result?: Array<{ meta?: YahooMeta }> } };
    const meta = json?.chart?.result?.[0]?.meta;
    return meta && meta.regularMarketPrice != null ? meta : null;
  } catch {
    return null;
  }
}

/** 60s bounds preview staleness. The trade-confirm leg (POST /api/trades) deliberately uses
 *  lookupMarketQuoteUncached so a logged fill price never comes from this cache - though it
 *  still rides the Yahoo fetch's pre-existing `next: { revalidate: 300 }` window above. */
const QUOTE_TTL_SECONDS = 60;

export async function lookupMarketQuote(rawSymbol: string): Promise<MarketQuote> {
  const raw = rawSymbol.toUpperCase().trim();
  if (!raw || !/^[A-Z0-9.\-]{1,12}$/.test(raw)) {
    return { valid: false, symbol: raw, name: null, price: null, currency: null, exchange: null, changePercent: null, error: 'Enter a ticker symbol.' };
  }

  // Cache (Redis when configured, in-process otherwise). Only VALID quotes are stored -
  // a transient Yahoo failure must not pin "no data" for a real ticker.
  const hit = await cacheGet<MarketQuote>(`quote:${raw}`);
  if (hit) return hit;
  const quote = await lookupMarketQuoteUncached(raw);
  // Awaited: fire-and-forget writes can be dropped when a serverless instance freezes.
  if (quote.valid) await cacheSet(`quote:${raw}`, quote, QUOTE_TTL_SECONDS);
  return quote;
}

/** Cache-bypassing lookup for the paths where staleness matters (logging a fill price). */
export async function lookupMarketQuoteUncached(rawIn: string): Promise<MarketQuote> {
  const raw = rawIn.toUpperCase().trim();
  if (!raw || !/^[A-Z0-9.\-]{1,12}$/.test(raw)) {
    return { valid: false, symbol: raw, name: null, price: null, currency: null, exchange: null, changePercent: null, error: 'Enter a ticker symbol.' };
  }
  let resolved = raw;
  let meta = await lookupYahoo(raw);
  if (!meta && !raw.includes('.')) {
    const ax = `${raw}.AX`;
    const axMeta = await lookupYahoo(ax);
    if (axMeta) {
      meta = axMeta;
      resolved = ax;
    }
  }

  if (!meta) {
    return { valid: false, symbol: raw, name: null, price: null, currency: null, exchange: null, changePercent: null, error: `No market data found for ${raw}.` };
  }

  const price = meta.regularMarketPrice ?? null;
  const prev = meta.chartPreviousClose ?? null;
  const changePercent = price != null && prev != null && prev !== 0 ? ((price - prev) / prev) * 100 : null;

  return {
    valid: true,
    symbol: meta.symbol ?? resolved,
    name: meta.longName ?? meta.shortName ?? null,
    price,
    currency: meta.currency ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    changePercent,
  };
}
