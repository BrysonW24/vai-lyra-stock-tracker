import { type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rateLimitShared } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';
import { corsJson, corsPreflight } from '@/lib/api/cors';
import { readJsonCapped } from '@/lib/api/body';
import { IDEA_DESCRIPTION_MAX, IDEA_TITLE_MAX, IDEA_TITLE_MIN } from '@/lib/community-contract';
import { verifyCommunityKey } from '@/lib/community-key';

/**
 * Community Ideas board API - the ONE global board every Lyra surface shares.
 *   GET  - list ideas, most-voted first. `?origin=human` (default) is the community board:
 *          what people want built inside Lyra. `?origin=scout` is the AI scout's proposal
 *          list, surfaced on the Scout tab - external build signals NEVER mix into the
 *          community list. `?vk=<device key>` resolves the anonymous caller's voted state.
 *   POST - submit a community idea. Signed-in users post as themselves; everyone else posts
 *          anonymously with a device key (service-role write; RLS stays strict). Rate-limited.
 *
 * CORS is deliberately open (see lib/api/cors.ts): Lyra Solo has no Supabase of its own and
 * joins this board cross-origin as an anonymous caller.
 *
 * Degrades on purpose: with no Supabase configured it serves the two standing example ideas
 * so the board still renders; if a migration has not been applied it returns an empty board
 * with `pendingMigration: true` (or all-human rows pre-043) rather than a 500. Author
 * identity is never returned - only the date/title/description/votes the board shows.
 */

export interface IdeaEvidence {
  itemId?: string;
  title: string;
  url: string | null;
  sourceId?: string;
}

export interface CommunityIdea {
  id: string;
  title: string;
  description: string;
  status: string;
  voteCount: number;
  createdAt: string;
  voted: boolean;
  /** 'human' (default) or 'scout' - the AI scout files onto the same table, different surface. */
  origin: string;
  /** feature | vertical | content-gap | frontend | backend. */
  kind: string;
  /** Scout receipts: the items that triggered the card. Empty for human ideas. */
  evidence: IdeaEvidence[];
  /** Breadth-derived scout confidence (0-100); null for human ideas. */
  confidence: number | null;
}

/**
 * Served only when no Supabase is configured. Mirrors the migration-053 seeds - the two
 * standing "things we may never build" examples - so an unconfigured board demonstrates
 * exactly what the real one opens with.
 */
const DEMO_IDEAS: CommunityIdea[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    title: 'Lyra rings your phone like an old-school broker',
    description: 'Example idea - probably never, but who knows: when a strong setup fires, Lyra calls you and talks through the score in plain English. This is the kind of thing to post here - what do you want Lyra to do?',
    status: 'open', voteCount: 9, createdAt: '2026-07-15T00:00:00.000Z', voted: false, origin: 'human', kind: 'feature', evidence: [], confidence: null,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    title: 'Let Lyra place the trades for me',
    description: 'Example idea - and one we may never build: Lyra is research-only by design, it never touches your broker. Posted here to show how the board works: add what you want built, vote on what you agree with.',
    status: 'declined', voteCount: 4, createdAt: '2026-07-10T00:00:00.000Z', voted: false, origin: 'human', kind: 'feature', evidence: [], confidence: null,
  },
];

/** Demo scout proposal (unconfigured deployments only) so the Scout tab demonstrates its shape. */
const DEMO_SCOUT_IDEAS: CommunityIdea[] = [
  {
    id: 'demo-scout-1',
    title: 'Emerging signal: Commercial Fusion',
    description: 'The scout saw fusion-energy funding recur across 4 items from 3 independent sources, and none of it attaches to any existing vertical. Filed automatically; nothing changes unless accepted.',
    status: 'open', voteCount: 9, createdAt: '2026-07-15T00:00:00.000Z', voted: false,
    origin: 'scout', kind: 'vertical', confidence: 75,
    evidence: [
      { title: 'US Department of Energy announces fusion pilot funding round', url: 'https://example.com/doe-fusion', sourceId: 'rss-doe-newsroom' },
      { title: 'Second fusion startup signs utility power purchase agreement', url: 'https://example.com/fusion-ppa', sourceId: 'rss-spacenews' },
    ],
  },
];

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || /does not exist/i.test(error.message || '');
}

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || /column .* does not exist/i.test(error.message || '');
}

/** Header-level half of the two-layer size gate; the text-level half is readJsonCapped. */
const MAX_BODY_BYTES = 16_384;
function bodyTooLarge(request: NextRequest): boolean {
  return Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES;
}

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: NextRequest) {
  const originFilter = request.nextUrl.searchParams.get('origin') === 'scout' ? 'scout' : 'human';

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return corsJson({ ok: true, demo: true, signedIn: false, ideas: originFilter === 'scout' ? DEMO_SCOUT_IDEAS : DEMO_IDEAS });
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  // Scout columns arrive with migration 043 - fall back to the 038 shape when the
  // columns are missing so the board never 400s on an unapplied migration. Pre-043
  // every row is human, so a scout listing is just empty there.
  let scoutColumns = true;
  const first = await supabase
    .from('community_ideas')
    .select('id, title, description, status, vote_count, created_at, origin, kind, evidence, confidence')
    .eq('origin', originFilter)
    .order('vote_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  let data: Record<string, unknown>[] | null = first.data;
  let error = first.error;
  if (error && isMissingColumn(error)) {
    scoutColumns = false;
    if (originFilter === 'scout') {
      return corsJson({ ok: true, signedIn: Boolean(user), ideas: [] });
    }
    const second = await supabase
      .from('community_ideas')
      .select('id, title, description, status, vote_count, created_at')
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);
    data = second.data;
    error = second.error;
  }

  if (error) {
    if (isMissingTable(error)) {
      // Migration 038 not applied yet - render the board empty instead of failing.
      return corsJson({ ok: true, pendingMigration: true, signedIn: Boolean(user), ideas: [] });
    }
    return corsJson({ ok: false, error: error.message }, { status: 400 });
  }

  // Maintainer flag drives the status controls in the UI; RLS is the real authority.
  let maintainer = false;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    maintainer = profile?.role === 'maintainer';
  }

  let votedIds = new Set<string>();
  if (data && data.length) {
    if (user) {
      const { data: votes } = await supabase.from('community_idea_votes').select('idea_id').eq('user_id', user.id);
      votedIds = new Set((votes || []).map((v) => v.idea_id as string));
    } else {
      // Anonymous voted-state comes from the signed participant key. Service-role read (RLS
      // has no anon-vote policy on purpose); tolerate the column missing until 053 is applied.
      const voterId = verifyCommunityKey(request.nextUrl.searchParams.get('vk'));
      const admin = voterId ? createSupabaseAdminClient() : null;
      if (admin && voterId) {
        const { data: votes, error: voteErr } = await admin.from('community_idea_votes').select('idea_id').eq('voter_key', voterId);
        if (!voteErr) votedIds = new Set((votes || []).map((v) => v.idea_id as string));
      }
    }
  }

  const ideas: CommunityIdea[] = (data || []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    status: (row.status as string) ?? 'open',
    voteCount: Number(row.vote_count ?? 0),
    createdAt: row.created_at as string,
    voted: votedIds.has(row.id as string),
    origin: scoutColumns ? ((row.origin as string) ?? 'human') : 'human',
    kind: scoutColumns ? ((row.kind as string) ?? 'feature') : 'feature',
    evidence: scoutColumns && Array.isArray(row.evidence) ? (row.evidence as IdeaEvidence[]) : [],
    confidence: scoutColumns && typeof row.confidence === 'number' ? row.confidence : null,
  }));

  return corsJson({ ok: true, signedIn: Boolean(user), maintainer, ideas });
}

export async function POST(request: NextRequest) {
  if (bodyTooLarge(request)) {
    return corsJson({ ok: false, error: 'Request too large.' }, { status: 413 });
  }

  // Each submission can spam the board - dampen drive-by posting (burst + daily budget).
  const ip = clientIp(request);
  const rl = await rateLimitShared(`ip:${ip}`, { scope: 'community_idea', capacity: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return corsJson({ ok: false, error: 'Too many submissions - wait a minute and try again.' }, { status: 429 });
  }
  const daily = await rateLimitShared(`ip:${ip}`, { scope: 'community_idea_day', capacity: 20, windowMs: 86_400_000 });
  if (!daily.allowed) {
    return corsJson({ ok: false, error: 'Daily submission limit reached - come back tomorrow.' }, { status: 429 });
  }

  // Parse (under the size cap) before any backend branch: the text-level half of the size
  // gate must run even when Content-Length was absent (chunked transfer).
  const parsed = await readJsonCapped<{ title?: string; description?: string; vk?: string }>(request, MAX_BODY_BYTES);
  if (parsed.tooLarge) return corsJson({ ok: false, error: 'Request too large.' }, { status: 413 });
  if (parsed.invalid || !parsed.body) return corsJson({ ok: false, error: 'Invalid request.' }, { status: 400 });
  const body = parsed.body;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return corsJson({ ok: false, demo: true, error: 'This deployment has no board of its own - ideas post to the shared board.' }, { status: 200 });
  }

  const title = (body.title ?? '').trim();
  const description = (body.description ?? '').trim();
  if (title.length < IDEA_TITLE_MIN) return corsJson({ ok: false, error: 'Give your idea a short title (at least 3 characters).' }, { status: 400 });
  if (title.length > IDEA_TITLE_MAX) return corsJson({ ok: false, error: 'Title is too long (max 120 characters).' }, { status: 400 });
  if (description.length > IDEA_DESCRIPTION_MAX) return corsJson({ ok: false, error: 'Description is too long (max 2000 characters).' }, { status: 400 });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  let data: { id: string; title: string; description: string | null; status: string | null; vote_count: number | null; created_at: string } | null = null;
  let error: { code?: string; message: string } | null = null;

  if (user) {
    const result = await supabase
      .from('community_ideas')
      .insert({ user_id: user.id, title, description })
      .select('id, title, description, status, vote_count, created_at')
      .single();
    data = result.data;
    error = result.error;
  } else {
    // Anonymous posting: a server-issued signed key + the service role. RLS never opens to
    // anon clients - this route (with its IP rate limits and length caps) is the gate.
    const voterId = verifyCommunityKey(body.vk);
    if (!voterId) return corsJson({ ok: false, error: 'Could not post from this device - refresh and try again.', badKey: true }, { status: 400 });
    const admin = createSupabaseAdminClient();
    if (!admin) return corsJson({ ok: false, error: 'Posting is not available on this deployment.' }, { status: 503 });
    const result = await admin
      .from('community_ideas')
      .insert({ title, description })
      .select('id, title, description, status, vote_count, created_at')
      .single();
    data = result.data;
    error = result.error;
  }

  if (error || !data) {
    if (isMissingTable(error)) {
      return corsJson({ ok: false, error: 'The ideas board is not set up yet - check back soon.' }, { status: 503 });
    }
    return corsJson({ ok: false, error: error?.message ?? 'Could not post your idea.' }, { status: 400 });
  }

  return corsJson({
    ok: true,
    idea: {
      id: data.id,
      title: data.title,
      description: data.description ?? '',
      status: data.status ?? 'open',
      voteCount: Number(data.vote_count ?? 0),
      createdAt: data.created_at,
      voted: false,
      origin: 'human',
      kind: 'feature',
      evidence: [],
      confidence: null,
    } satisfies CommunityIdea,
  });
}
