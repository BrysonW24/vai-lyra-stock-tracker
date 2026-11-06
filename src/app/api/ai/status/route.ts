import { NextResponse } from 'next/server';
import { getAiRuntimeStatus } from '@/lib/ai/credentials';
import { providerBreakerStatus } from '@/lib/ai/gateway';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolveHostedEntitlement } from '@/lib/ai/entitlement';

export const dynamic = 'force-dynamic';

/**
 * AI runtime status. Hosted-key presence and breaker state are for SIGNED-IN eyes only -
 * an anonymous caller learning which server keys exist is free reconnaissance. Anonymous
 * callers get the two facts the pre-auth UI needs: whether a hosted mode exists to unlock, and
 * whether the free pool of open models is on (`freeAvailable`) - that one is no secret, it is
 * what lets anyone chat without a key.
 *
 * For a SIGNED-IN user, `hostedAvailable` is now PER-USER: the deployment must have a hosted key
 * AND this user must be entitled (inside their free trial, or granted). A user past their trial
 * reads as BYOK - the same honest copy Solo gets - even on a deployment that pays for other users.
 *
 * Who would answer THIS caller is not reported here, because it depends on the provider they have
 * selected in the browser (the house may hold a key for one provider and not the other). The UI
 * works it out from these facts with whoAnswers() in src/lib/ai/who-answers.ts.
 */
export async function GET() {
  const status = getAiRuntimeStatus();
  const deploymentHasKey = status.hostedOpenAi || status.sharedGoogle;

  const freeAvailable = status.freePool === true;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ hostedAvailable: deploymentHasKey, freeAvailable, authenticated: false });
  }

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    return NextResponse.json({ hostedAvailable: deploymentHasKey, freeAvailable, authenticated: false });
  }

  // Per-user entitlement (trial or env-granted), from the verified session and the server env only.
  const { included, granted, trialDaysLeft } = resolveHostedEntitlement(user, Date.now());

  return NextResponse.json({
    ...status,
    hostedAvailable: deploymentHasKey && included,
    freeAvailable,
    hostedKeyOnDeployment: deploymentHasKey,
    aiIncluded: included,
    granted,
    trialDaysLeft,
    authenticated: true,
    breakers: providerBreakerStatus(),
  });
}
