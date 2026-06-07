import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { OperatorProfile } from '@/lib/onboarding';

/**
 * Onboarding persistence API. Saves operator profile and onboarding progress for
 * signed-in users. Uses the cookie-aware (RLS-enforced) Supabase client, so each
 * user can only write their own rows. Falls back to demo mode when Supabase isn't
 * configured.
 */

interface OnboardingRequest {
  profile: OperatorProfile;
  completionPct?: number;
}

const demoResponse = () =>
  NextResponse.json(
    {
      ok: false,
      demo: true,
      error: 'Supabase not configured - running in demo mode. Add NEXT_PUBLIC_SUPABASE_URL + anon key to enable persistence.',
    },
    { status: 200 },
  );

const unauthenticated = () =>
  NextResponse.json({ ok: false, error: 'Sign in to save your onboarding progress.' }, { status: 401 });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as OnboardingRequest;

    if (!body.profile) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: profile' },
        { status: 400 },
      );
    }

    // Upsert into operator_profiles table.
    const { error: profileError } = await supabase
      .from('operator_profiles')
      .upsert(
        {
          user_id: user.id,
          experience_level: body.profile.experienceLevel || null,
          investing_style: body.profile.investingStyle || null,
          preferred_timeframe: body.profile.preferredTimeframe || null,
          risk_comfort: body.profile.riskComfort || null,
          primary_goal: body.profile.primaryGoal || null,
          // Beginner-specific fields
          traded_before: body.profile.tradedBefore || null,
          beginner_motivation: body.profile.beginnerMotivation || null,
          beginner_knowledge: body.profile.beginnerKnowledge || null,
          beginner_involvement: body.profile.beginnerInvolvement || null,
          beginner_learning_style: body.profile.beginnerLearningStyle || null,
          beginner_horizon: body.profile.beginnerHorizon || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (profileError) {
      return NextResponse.json(
        { ok: false, error: `Failed to save operator profile: ${profileError.message}` },
        { status: 400 },
      );
    }

    // Upsert into onboarding_progress table to track completion.
    if (body.completionPct !== undefined) {
      const { error: progressError } = await supabase
        .from('onboarding_progress')
        .upsert(
          {
            user_id: user.id,
            profile_completed: Boolean(body.profile.tradedBefore),
            completion_pct: Math.min(Math.max(body.completionPct, 0), 100),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (progressError) {
        // Log the error but don't fail the whole request - progress tracking is optional.
        console.warn('Failed to update onboarding progress:', progressError.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
