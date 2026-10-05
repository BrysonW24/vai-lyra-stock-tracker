import { NextResponse } from 'next/server';
import { getAiRuntimeStatus } from '@/lib/ai/credentials';
import { providerBreakerStatus } from '@/lib/ai/gateway';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolveHostedEntitlement } from '@/lib/ai/entitlement';

export const dynamic = 'force-dynamic';

/**
 * AI runtime status. Hosted-key presence and breaker state are for SIGNED-IN eyes only -
 * an anonymous caller learning which server keys exist is free reconnaissance. Anonymous
 * callers get the one fact the pre-auth UI needs: whether a hosted mode exists to unlock.
 *
 * For a SIGNED-IN user, `hostedAvailable` is now PER-USER: the deployment must have a hosted key
 * AND this user must be entitled (inside their free trial, or granted). A user past their trial
 * reads as BYOK - the same honest copy Solo gets - even on a deployment that pays for other users.
 */
export async function GET() {
  const status = getAiRuntimeStatus();
  const deploymentHasKey = status.hostedOpenAi || status.sharedGoogle;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ hostedAvailable: deploymentHasKey, authenticated: false });
  }

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    return NextResponse.json({ hostedAvailable: deploymentHasKey, authenticated: false });
  }

  // Per-user entitlement (trial or env-granted), from the verified session and the server env only.
  const { included, granted, trialDaysLeft } = resolveHostedEntitlement(user, Date.now());

  return NextResponse.json({
    ...status,
    hostedAvailable: deploymentHasKey && included,
    hostedKeyOnDeployment: deploymentHasKey,
    aiIncluded: included,
    granted,
    trialDaysLeft,
    authenticated: true,
    breakers: providerBreakerStatus(),
  });
}
