import { type NextRequest, NextResponse } from 'next/server';
import { lookupMarketQuote } from '@/lib/market/quote';
import { rateLimit } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';

/**
 * On-demand ticker lookup. Validates a symbol against Yahoo Finance and returns
 * its live name + price, so the watchlist / portfolio builders can accept ANY
 * ticker the user types (US or ASX) instead of a curated list. ASX support is
 * automatic: a bare symbol that misses is retried with the `.AX` listing, so
 * "CBA" resolves to "CBA.AX". Same source (Yahoo) that powers live signals.
 */

export async function GET(request: NextRequest) {
  // Unauthenticated Yahoo proxy - dampen abuse so it cannot be used as a fetch amplifier.
  const rl = rateLimit(`ip:${clientIp(request)}`, { scope: 'lookup', capacity: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ valid: false, error: 'Too many lookups - wait a moment.' }, { status: 429 });
  }
  const raw = (request.nextUrl.searchParams.get('symbol') || '').toUpperCase().trim();
  return NextResponse.json(await lookupMarketQuote(raw));
}
