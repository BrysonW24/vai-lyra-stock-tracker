import { type NextRequest, NextResponse } from 'next/server';

/**
 * Fetches 30-day daily closing prices for NASDAQ (^IXIC) and ASX200 (^AXJO)
 * from Yahoo Finance, then indexes them all to 100 at day 0 so the client
 * can overlay them against a similarly-indexed portfolio equity curve.
 */

interface YahooResult {
  meta: { symbol: string; regularMarketPrice: number };
  timestamp: number[];
  indicators: { quote: [{ close: (number | null)[] }] };
}

async function fetchIndexed(symbol: string): Promise<{ label: string; symbol: string; points: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { chart?: { result?: YahooResult[] } };
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const closes = result.indicators.quote[0].close;
    // Strip nulls (e.g. weekends) and grab the clean series
    const clean = closes.filter((c): c is number => c !== null && !isNaN(c));
    if (clean.length < 2) return null;

    // Index: first day = 100, every subsequent day = relative performance %
    const base = clean[0];
    const indexed = clean.map(c => parseFloat(((c / base) * 100).toFixed(3)));

    const label = symbol === '^IXIC' ? 'NASDAQ' : symbol === '^AXJO' ? 'ASX 200' : symbol;
    return { label, symbol, points: indexed };
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const [nasdaq, asx] = await Promise.all([
    fetchIndexed('^IXIC'),
    fetchIndexed('^AXJO'),
  ]);

  return NextResponse.json({
    benchmarks: [nasdaq, asx].filter(Boolean),
    generatedAt: new Date().toISOString(),
  });
}
