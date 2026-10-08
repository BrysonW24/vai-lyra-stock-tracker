import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, linkSecret, signatureMatches } from '@/lib/subscribe-server';
import { confirmEmailSubscriber } from '@/lib/subscribe-store';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * The confirmation link in the subscription email: /api/subscribe/confirm?id=<row>&sig=<hmac>.
 * Opening it proves the inbox, so the row goes active. The signature is checked in constant time
 * against the same secret the worker signs unsubscribe links with; a bad or stale link lands on
 * the subscribe page with an honest message rather than a 4xx.
 */
export async function GET(request: NextRequest) {
  const base = appBaseUrl(request);
  const id = (request.nextUrl.searchParams.get('id') || '').trim();
  const sig = request.nextUrl.searchParams.get('sig');
  const secret = linkSecret();
  const client = createSupabaseServiceClient();
  if (!secret || !client || !id || !signatureMatches(secret, 'confirm', id, sig)) {
    console.warn(JSON.stringify({ at: 'subscribe.confirm', event: 'rejected', reason: !secret || !client ? 'not_configured' : 'bad_link' }));
    return NextResponse.redirect(new URL('/subscribe?confirmed=0', base));
  }
  const outcome = await confirmEmailSubscriber(client, id);
  console.info(JSON.stringify({ at: 'subscribe.confirm', event: outcome }));
  return NextResponse.redirect(new URL(outcome === 'activated' || outcome === 'already' ? '/subscribe?confirmed=1' : '/subscribe?confirmed=0', base));
}
