import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { OperatorProfile, CapitalContext, AlertPreferences, StrategySelection } from '@/lib/onboarding';

/**
 * Onboarding persistence API. Saves operator profile, capital context, strategy, alert
 * preferences and onboarding progress for signed-in users. Uses the cookie-aware
 * (RLS-enforced) Supabase client, so each user can only write their own rows.
 */

interface OnboardingRequest {
  profile: OperatorProfile;
  completionPct?: number;
  capital?: CapitalContext;
  alerts?: AlertPreferences;
  strategy?: StrategySelection;
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
          cash_available: body.capital?.cashAvailable ?? null,
          monthly_contribution: body.capital?.monthlyContribution ?? null,
          max_position_size_pct: body.capital?.maxPositionSizePct ?? null,
          default_trade_amount: body.capital?.defaultTradeAmount ?? null,
          primary_outcome: body.capital?.primaryOutcome ?? null,
          simulation_enabled: body.capital?.simulationEnabled ?? null,
          strategy_id: body.strategy?.strategyId ?? null,
          strategy_overrides: body.strategy?.overrides ?? null,
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

    // Base currency lives in profiles (the table the cross-currency trade guard reads). Capturing it
    // here means a new AU user's AUD trades work without first visiting Account settings. Best-effort:
    // the profiles row exists from the signup trigger, so this only updates the one column.
    if (body.capital?.baseCurrency) {
      const { error: currencyError } = await supabase
        .from('profiles')
        .update({ base_currency: body.capital.baseCurrency, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (currencyError) console.warn('Failed to save base currency:', currencyError.message);
    }

    if (body.alerts) {
      const { error: alertsError } = await supabase
        .from('user_alert_preferences')
        .upsert(
          {
            user_id: user.id,
            strong_setup_enabled: body.alerts.strongSetupAlerts,
            portfolio_risk_enabled: body.alerts.portfolioRiskAlerts,
            watchlist_trigger_enabled: body.alerts.watchlistTriggerAlerts,
            invalidation_enabled: body.alerts.signalInvalidationAlerts,
            push_enabled: body.alerts.pushEnabled,
            min_signal_score: body.alerts.minSignalScore ?? 75,
            paper_bot_alerts: body.alerts.paperBotAlerts,
            order_approval_alerts: body.alerts.orderApprovalAlerts,
            macro_alerts: body.alerts.macroAlerts,
            theme_alerts: body.alerts.themeAlerts,
            watchlist_movement_alerts: body.alerts.watchlistMovementAlerts,
            portfolio_movement_alerts: body.alerts.portfolioMovementAlerts,
            digest_enabled: Boolean(body.alerts.dailyDigest || body.alerts.hourlyDigest),
            frequency: body.alerts.hourlyDigest ? 'hourly' : 'daily',
            hourly_digest_enabled: body.alerts.hourlyDigest,
            weekly_digest_enabled: true,
            digest_time: body.alerts.digestTime || '08:00',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      if (alertsError) console.warn('Failed to save alert preferences:', alertsError.message);
    }

    // Upsert into onboarding_progress table to track completion.
    if (body.completionPct !== undefined) {
      const { error: progressError } = await supabase
        .from('onboarding_progress')
        .upsert(
          {
            user_id: user.id,
            operator_profile_completed: true,
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
