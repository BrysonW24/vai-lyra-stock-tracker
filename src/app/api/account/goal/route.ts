import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Persist the user's OWN money goal (goal_target_amount on operator_profiles). RLS-enforced via the
 * cookie-aware server client, so a user can only ever write their own row. POST { targetAmount:
 * number | null } - a positive number sets the target, null clears it back to the milestone ladder.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, demo: true, error: 'Supabase not configured - sign-in required to save a target.' }, { status: 200 });
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Sign in to set your goal target.' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { targetAmount?: number | null };

    let target: number | null = null;
    if (body.targetAmount !== null && body.targetAmount !== undefined) {
      const n = Number(body.targetAmount);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ ok: false, error: 'Target must be a positive number, or null to clear it.' }, { status: 400 });
      }
      if (n > 1e12) return NextResponse.json({ ok: false, error: 'That target is unrealistically large.' }, { status: 400 });
      target = Math.round(n);
    }

    const { error } = await supabase
      .from('operator_profiles')
      .upsert({ user_id: user.id, goal_target_amount: target }, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, targetAmount: target });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not save your target.' }, { status: 500 });
  }
}
