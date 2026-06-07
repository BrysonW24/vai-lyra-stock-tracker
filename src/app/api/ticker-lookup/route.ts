import { type NextRequest, NextResponse } from 'next/server';

/**
 * On-demand ticker lookup. Validates a symbol against Yahoo Finance and returns
 * its live name + price, so the watchlist / portfolio builders can accept ANY
 * ticker the user types (US or ASX) instead of a curated list. ASX support is
 * automatic: a bare symbol that misses is retried with the `.AX` listing, so
 * "CBA" resolves to "CBA.AX". Same source (Yahoo) that powers live signals.
 */

interface YahooMeta {
  symbol?: string;
  currency?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  shortName?: string;
  longName?: string;
  instrumentType?: string;
}

async function lookup(symbol: string): Promise<YahooMeta | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 }, // cache 5 min per symbol
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { chart?: { result?: Array<{ meta?: YahooMeta }> } };
    const meta = json?.chart?.result?.[0]?.meta;
    return meta && meta.regularMarketPrice != null ? meta : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get('symbol') || '').toUpperCase().trim();
  if (!raw || !/^[A-Z0-9.\-]{1,12}$/.test(raw)) {
    return NextResponse.json({ valid: false, error: 'Enter a ticker symbol.' });
  }

  // Try as typed; if a bare symbol misses, retry the ASX listing (.AX).
  let resolved = raw;
  let meta = await lookup(raw);
  if (!meta && !raw.includes('.')) {
    const ax = `${raw}.AX`;
    const axMeta = await lookup(ax);
    if (axMeta) {
      meta = axMeta;
      resolved = ax;
    }
  }

  if (!meta) {
    return NextResponse.json({ valid: false, symbol: raw, error: `No market data found for ${raw}.` });
  }

  const price = meta.regularMarketPrice ?? null;
  const prev = meta.chartPreviousClose ?? null;
  const changePercent = price != null && prev != null && prev !== 0 ? ((price - prev) / prev) * 100 : null;

  return NextResponse.json({
    valid: true,
    symbol: meta.symbol ?? resolved,
    name: meta.longName ?? meta.shortName ?? null,
    price,
    currency: meta.currency ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    changePercent,
  });
}
