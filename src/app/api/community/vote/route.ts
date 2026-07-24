import { type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rateLimitShared } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';
import { corsJson, corsPreflight } from '@/lib/api/cors';
import { readJsonCapped } from '@/lib/api/body';
import { verifyCommunityKey } from '@/lib/community-key';

/**
 * Toggle a vote on a community idea - no account required. Signed-in users vote as
 * themselves (unique per user via uq_idea_vote_once); everyone else votes with a
 * SERVER-ISSUED signed participant key (unique per key via uq_idea_vote_once_anon,
 * migration 053) - client-minted keys verify to nothing, which is what keeps the tally
 * honest. Anonymous writes go through the service role - RLS never opens to anon clients;
 * this route's rate limits and key verification are the gate. Returns the fresh,
 * trigger-maintained tally.
 *
 * CORS is open on purpose: Lyra Solo votes on the shared board cross-origin.
 */

/** Size cap for this internet-open route: header gate here, text gate in readJsonCapped. */
const MAX_BODY_BYTES = 4_096;

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    return corsJson({ ok: false, error: 'Request too large.' }, { status: 413 });
  }

  const ip = clientIp(request);
  const rl = await rateLimitShared(`ip:${ip}`, { scope: 'community_vote', capacity: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return corsJson({ ok: false, error: 'Too many votes - slow down a moment.' }, { status: 429 });
  }
  const daily = await rateLimitShared(`ip:${ip}`, { scope: 'community_vote_day', capacity: 200, windowMs: 86_400_000 });
  if (!daily.allowed) {
    return corsJson({ ok: false, error: 'Daily voting limit reached - come back tomorrow.' }, { status: 429 });
  }

  // Parse (under the size cap) before any backend branch: the text-level half of the size
  // gate must run even when Content-Length was absent (chunked transfer).
  const parsed = await readJsonCapped<{ ideaId?: string; vk?: string }>(request, MAX_BODY_BYTES);
  if (parsed.tooLarge) return corsJson({ ok: false, error: 'Request too large.' }, { status: 413 });
  if (parsed.invalid || !parsed.body) return corsJson({ ok: false, error: 'Invalid request.' }, { status: 400 });
  const body = parsed.body;
  const ideaId = (body.ideaId ?? '').trim();
  if (!ideaId) return corsJson({ ok: false, error: 'Missing idea id.' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return corsJson({ ok: false, demo: true, error: 'This deployment has no board of its own - votes go to the shared board.' }, { status: 200 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  // Pick the identity column once; both paths share the same toggle shape below.
  const anon = !user;
  const voterId = anon ? verifyCommunityKey(body.vk) : null;
  if (anon && !voterId) {
    return corsJson({ ok: false, error: 'Could not vote from this device - refresh and try again.', badKey: true }, { status: 400 });
  }
  const client = anon ? createSupabaseAdminClient() : supabase;
  if (!client) return corsJson({ ok: false, error: 'Voting is not available on this deployment.' }, { status: 503 });
  const identity: { column: 'user_id' | 'voter_key'; value: string } = anon
    ? { column: 'voter_key', value: voterId! }
    : { column: 'user_id', value: user!.id };

  // Toggle. The unique indexes make a concurrent double-insert safe: the loser gets 23505,
  // which we read as "already voted" rather than an error.
  const { data: existing, error: lookupError } = await client
    .from('community_idea_votes')
    .select('id')
    .eq('idea_id', ideaId)
    .eq(identity.column, identity.value)
    .maybeSingle();

  if (lookupError && (lookupError.code === '42703' || /column .* does not exist/i.test(lookupError.message || ''))) {
    // Migration 053 not applied yet - anonymous voting simply is not open here yet.
    return corsJson({ ok: false, error: 'Voting without an account is not switched on here yet - try again soon.' }, { status: 503 });
  }

  let voted: boolean;
  if (existing?.id) {
    const { error } = await client.from('community_idea_votes').delete().eq('id', existing.id).eq(identity.column, identity.value);
    if (error) return corsJson({ ok: false, error: error.message }, { status: 400 });
    voted = false;
  } else {
    const { error } = await client.from('community_idea_votes').insert({ idea_id: ideaId, [identity.column]: identity.value });
    if (error && error.code !== '23505') {
      return corsJson({ ok: false, error: error.message }, { status: 400 });
    }
    voted = true;
  }

  const { data: idea } = await client.from('community_ideas').select('vote_count').eq('id', ideaId).maybeSingle();
  return corsJson({ ok: true, voted, voteCount: Number(idea?.vote_count ?? 0) });
}
