import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rateLimitShared } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';

/**
 * Community Ideas board API.
 *   GET  - list every idea, most-voted first, with the current user's "voted" state.
 *   POST - submit a new idea (signed-in only, rate-limited).
 *
 * Degrades on purpose: with no Supabase configured (demo) it serves a few sample ideas so the
 * board still renders; if migration 038 has not been applied yet it returns an empty board with
 * `pendingMigration: true` rather than a 500. Author identity is never returned - only the
 * date/title/description/votes the board shows.
 */

export interface CommunityIdea {
  id: string;
  title: string;
  description: string;
  status: string;
  voteCount: number;
  createdAt: string;
  voted: boolean;
}

/** Sample ideas shown only in demo mode (no Supabase) so the board demonstrates its shape. */
const DEMO_IDEAS: CommunityIdea[] = [
  { id: 'demo-1', title: 'Price-target alerts per holding', description: 'Let me set a target price on each position and get pinged when it is hit.', status: 'open', voteCount: 12, createdAt: '2026-07-10T00:00:00.000Z', voted: false },
  { id: 'demo-2', title: 'A lighter daytime theme', description: 'A high-contrast light theme for using Lyra at a bright desk.', status: 'planned', voteCount: 7, createdAt: '2026-07-12T00:00:00.000Z', voted: false },
  { id: 'demo-3', title: 'Export my watchlist to CSV', description: 'One tap to export the watchlist with each name and its current score.', status: 'open', voteCount: 4, createdAt: '2026-07-14T00:00:00.000Z', voted: false },
];

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || /does not exist/i.test(error.message || '');
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, demo: true, signedIn: false, ideas: DEMO_IDEAS });
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const { data, error } = await supabase
    .from('community_ideas')
    .select('id, title, description, status, vote_count, created_at')
    .order('vote_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingTable(error)) {
      // Migration 038 not applied yet - render the board empty instead of failing.
      return NextResponse.json({ ok: true, pendingMigration: true, signedIn: Boolean(user), ideas: [] });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  let votedIds = new Set<string>();
  if (user && data && data.length) {
    const { data: votes } = await supabase.from('community_idea_votes').select('idea_id').eq('user_id', user.id);
    votedIds = new Set((votes || []).map((v) => v.idea_id as string));
  }

  const ideas: CommunityIdea[] = (data || []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    status: (row.status as string) ?? 'open',
    voteCount: Number(row.vote_count ?? 0),
    createdAt: row.created_at as string,
    voted: votedIds.has(row.id as string),
  }));

  return NextResponse.json({ ok: true, signedIn: Boolean(user), ideas });
}

export async function POST(request: NextRequest) {
  // Each submission can spam the board - dampen drive-by posting.
  const rl = await rateLimitShared(`ip:${clientIp(request)}`, { scope: 'community_idea', capacity: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many submissions - wait a minute and try again.' }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, demo: true, error: 'Sign in to post an idea (not available in the demo).' }, { status: 200 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ ok: false, error: 'Sign in to post an idea.' }, { status: 401 });

  let body: { title?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  const description = (body.description ?? '').trim();
  if (title.length < 3) return NextResponse.json({ ok: false, error: 'Give your idea a short title (at least 3 characters).' }, { status: 400 });
  if (title.length > 120) return NextResponse.json({ ok: false, error: 'Title is too long (max 120 characters).' }, { status: 400 });
  if (description.length > 2000) return NextResponse.json({ ok: false, error: 'Description is too long (max 2000 characters).' }, { status: 400 });

  const { data, error } = await supabase
    .from('community_ideas')
    .insert({ user_id: user.id, title, description })
    .select('id, title, description, status, vote_count, created_at')
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ ok: false, error: 'The ideas board is not set up yet - check back soon.' }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    idea: {
      id: data.id,
      title: data.title,
      description: data.description ?? '',
      status: data.status ?? 'open',
      voteCount: Number(data.vote_count ?? 0),
      createdAt: data.created_at,
      voted: false,
    } satisfies CommunityIdea,
  });
}
