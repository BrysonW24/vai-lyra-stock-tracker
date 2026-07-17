import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Maintainer-only idea status moderation.
 * POST { ideaId, status } - moves a card on the board (open | planned | in_progress |
 * shipped | declined). Authority is enforced by RLS (migration 043): the update policy
 * matches only profiles with role='maintainer', so a non-maintainer's update simply
 * matches zero rows and returns 403 here - the server never needs its own role check
 * beyond reading the outcome.
 */

const ALLOWED = new Set(['open', 'planned', 'in_progress', 'shipped', 'declined']);

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, demo: true, error: 'Status moderation is not available in the demo.' }, { status: 200 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 401 });

  let body: { ideaId?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const ideaId = (body.ideaId ?? '').trim();
  const status = (body.status ?? '').trim();
  if (!ideaId || !ALLOWED.has(status)) {
    return NextResponse.json({ ok: false, error: 'Invalid idea or status.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('community_ideas')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', ideaId)
    .select('id, status');

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data || data.length === 0) {
    // RLS filtered the row out: not a maintainer (or the idea does not exist).
    return NextResponse.json({ ok: false, error: 'Only the maintainer can set idea status.' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, id: data[0].id, status: data[0].status });
}
