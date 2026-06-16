import { type NextRequest, NextResponse } from 'next/server';
import { lookupMarketQuote } from '@/lib/market/quote';

/**
 * On-demand ticker lookup. Validates a symbol against Yahoo Finance and returns
 * its live name + price, so the watchlist / portfolio builders can accept ANY
 * ticker the user types (US or ASX) instead of a curated list. ASX support is
 * automatic: a bare symbol that misses is retried with the `.AX` listing, so
 * "CBA" resolves to "CBA.AX". Same source (Yahoo) that powers live signals.
 */

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get('symbol') || '').toUpperCase().trim();
  return NextResponse.json(await lookupMarketQuote(raw));
}
