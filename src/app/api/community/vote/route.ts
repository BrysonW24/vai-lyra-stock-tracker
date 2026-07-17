import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rateLimitShared } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';

/**
 * Toggle the current user's vote on a community idea. Signed-in only, rate-limited.
 * One vote per user per idea is enforced by the unique index (uq_idea_vote_once); this route
 * flips it: already voted -> remove, not voted -> add. Returns the fresh, trigger-maintained tally.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimitShared(`ip:${clientIp(request)}`, { scope: 'community_vote', capacity: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many votes - slow down a moment.' }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, demo: true, error: 'Sign in to vote (not available in the demo).' }, { status: 200 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ ok: false, error: 'Sign in to vote.' }, { status: 401 });

  let body: { ideaId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }
  const ideaId = (body.ideaId ?? '').trim();
  if (!ideaId) return NextResponse.json({ ok: false, error: 'Missing idea id.' }, { status: 400 });

  // Toggle. The unique index makes a concurrent double-insert safe: the loser gets 23505, which we
  // read as "already voted" rather than an error.
  const { data: existing } = await supabase
    .from('community_idea_votes')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('user_id', user.id)
    .maybeSingle();

  let voted: boolean;
  if (existing?.id) {
    const { error } = await supabase.from('community_idea_votes').delete().eq('id', existing.id).eq('user_id', user.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    voted = false;
  } else {
    const { error } = await supabase.from('community_idea_votes').insert({ idea_id: ideaId, user_id: user.id });
    if (error && error.code !== '23505') {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    voted = true;
  }

  const { data: idea } = await supabase.from('community_ideas').select('vote_count').eq('id', ideaId).maybeSingle();
  return NextResponse.json({ ok: true, voted, voteCount: Number(idea?.vote_count ?? 0) });
}
