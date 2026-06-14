import { NextResponse } from 'next/server';
import { getPaperAccountSummaryAuthAware } from '@/lib/trading/paper-account-repo';

export const dynamic = 'force-dynamic';

/**
 * Paper account analytics - the "where do I view + analyse it" surface for the paper bot.
 * Persisted + durable (per-user, RLS) for a signed-in user; in-memory session summary in demo mode.
 * Returns open positions marked to the latest scan price, with simulated unrealised P/L.
 */
export async function GET() {
  const summary = await getPaperAccountSummaryAuthAware();
  return NextResponse.json(summary);
}
