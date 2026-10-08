import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, linkSecret, signatureMatches } from '@/lib/subscribe-server';
import { unsubscribeById } from '@/lib/subscribe-store';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * The unsubscribe link every briefing email carries: /api/subscribe/unsubscribe?id=<row>&sig=<hmac>.
 * GET is the footer link (lands on the subscribe page with a confirmation); POST is the one-click
 * form mail clients send for the List-Unsubscribe-Post header (RFC 8058) - same check, JSON answer.
 * Idempotent: a second visit is still "done". Telegram subscribers reply STOP instead.
 */
async function endSubscription(request: NextRequest): Promise<'done' | 'bad_link' | 'not_configured' | 'unknown' | 'error'> {
  const id = (request.nextUrl.searchParams.get('id') || '').trim();
  const sig = request.nextUrl.searchParams.get('sig');
  const secret = linkSecret();
  const client = createSupabaseServiceClient();
  if (!secret || !client) return 'not_configured';
  if (!id || !signatureMatches(secret, 'unsubscribe', id, sig)) return 'bad_link';
  return unsubscribeById(client, id, 'link');
}

export async function GET(request: NextRequest) {
  const outcome = await endSubscription(request);
  console.info(JSON.stringify({ at: 'subscribe.unsubscribe', event: outcome, method: 'GET' }));
  return NextResponse.redirect(new URL(outcome === 'done' ? '/subscribe?unsubscribed=1' : '/subscribe?unsubscribed=0', appBaseUrl(request)));
}

export async function POST(request: NextRequest) {
  const outcome = await endSubscription(request);
  console.info(JSON.stringify({ at: 'subscribe.unsubscribe', event: outcome, method: 'POST' }));
  return NextResponse.json({ ok: outcome === 'done' }, { status: outcome === 'done' ? 200 : outcome === 'bad_link' ? 400 : outcome === 'unknown' ? 404 : 503 });
}
