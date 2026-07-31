import { type NextRequest, NextResponse } from 'next/server';
import { rateLimitShared } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';
import { loadEmergingWinnerQueue } from '@/lib/emerging-winner/load';

/**
 * Public, read-only Emerging Winner Engine research queue (shadow-live). Returns the latest run's
 * ranked, risk-gated predictions from the immutable ledger (migration 056), or the demo queue when
 * Supabase is not configured. The deterministic engine owns every number; this route only reads.
 * Research only - the payload never contains a buy/sell instruction or a price target.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limited = await rateLimitShared(clientIp(request), {
    scope: 'emerging-winners',
    capacity: 30,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded.' }, { status: 429 });
  }

  const queue = await loadEmergingWinnerQueue();
  return NextResponse.json({ ok: true, ...queue });
}
