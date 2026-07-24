import { NextResponse } from 'next/server';
import { getAiRuntimeStatus } from '@/lib/ai/credentials';
import { providerBreakerStatus } from '@/lib/ai/gateway';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * AI runtime status. Hosted-key presence and breaker state are for SIGNED-IN eyes only -
 * an anonymous caller learning which server keys exist is free reconnaissance. Anonymous
 * callers get the one fact the pre-auth UI needs: whether signing in unlocks a hosted mode.
 * (Demo deployments have no auth stack, and also no hosted keys worth probing.)
 */
export async function GET() {
  const status = getAiRuntimeStatus();
  const hostedAvailable = status.hostedOpenAi || status.sharedGoogle;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ hostedAvailable, authenticated: false });
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ hostedAvailable, authenticated: false });
  }

  return NextResponse.json({ ...status, hostedAvailable, authenticated: true, breakers: providerBreakerStatus() });
}
