import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadTwinReflection } from '@/lib/twin/repo';

/**
 * Portable, versioned account + twin export. Returns everything Lyra holds about the signed-in user
 * server-side as one downloadable JSON snapshot - the "take it with you" half of the privacy contract
 * and the seed of the portable-twin roadmap (inherit-a-posture onboarding). RLS-scoped to the caller;
 * the twin block is the deterministic reflection, not raw event logs. No secrets, no other user's data.
 */
export const dynamic = 'force-dynamic';

const EXPORT_VERSION = 1;

const demoResponse = () =>
  NextResponse.json({ ok: false, demo: true, error: 'Supabase not configured - running in demo mode.' }, { status: 200 });

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Sign in to export your data.' }, { status: 401 });

    const [profile, settings, operator, twin] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('operator_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      loadTwinReflection().catch(() => null),
    ]);

    const snapshot = {
      version: EXPORT_VERSION,
      kind: 'lyra-account-export',
      exportedAt: new Date().toISOString(),
      userId: user.id,
      email: user.email ?? null,
      profile: profile.data ?? null,
      settings: settings.data ?? null,
      operatorProfile: operator.data ?? null,
      // The portable twin: deterministic reflection (interests, habits, revealed risk), not raw logs.
      twin: twin
        ? {
            hasEnoughData: twin.hasEnoughData,
            observations: twin.observations,
            reconciliation: twin.reconciliation,
            topThemes: twin.topThemes,
            topSymbols: twin.topSymbols,
            topSignalKinds: twin.topSignalKinds,
            stageLean: twin.stageLean,
          }
        : null,
    };

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="lyra-account-export.json"',
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
