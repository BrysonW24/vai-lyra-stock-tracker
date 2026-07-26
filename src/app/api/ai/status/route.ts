import { NextResponse } from 'next/server';
import { getAiRuntimeStatus } from '@/lib/ai/credentials';
import { providerBreakerStatus } from '@/lib/ai/gateway';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAiIncluded, aiTrialDaysLeft } from '@/lib/ai/entitlement';

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

  // Per-user entitlement (trial or granted). Profile read is best-effort: absent column (pre-055)
  // or a read failure falls back to trial-only, so this is safe before or after the migration.
  let granted = false;
  try {
    const { data: profile } = await supabase.from('profiles').select('ai_included').eq('id', user.id).maybeSingle();
    granted = (profile as { ai_included?: boolean } | null)?.ai_included === true;
  } catch {
    // pre-055 -> trial only
  }
  const now = Date.now();
  const included = isAiIncluded({ accountCreatedAt: user.created_at, granted, now });
  const trialDaysLeft = granted ? 0 : aiTrialDaysLeft({ accountCreatedAt: user.created_at, now });

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
