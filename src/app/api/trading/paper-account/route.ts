import { NextResponse } from 'next/server';
import { getPaperAccountSummary } from '@/lib/trading/paper-account-store';

export const dynamic = 'force-dynamic';

/**
 * Paper account analytics - the "where do I view + analyse it" surface for the paper bot.
 * Returns open positions marked to the latest scan price, with simulated unrealised P/L.
 */
export async function GET() {
  const summary = await getPaperAccountSummary();
  return NextResponse.json(summary);
}
