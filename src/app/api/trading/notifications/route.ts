import { NextResponse } from 'next/server';
import { listFlags, unreadCount, markAllRead, DEMO_OWNER } from '@/lib/trading/notifications-store';
import { activeChannels } from '@/lib/trading/notify-delivery';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * The flag feed is owner-scoped in-memory state. On a demo deploy (no Supabase) there is one implicit
 * operator, so the feed reads the shared DEMO_OWNER bucket. On a CONFIGURED deploy the feed is
 * per-user: a signed-in caller only ever sees their OWN flags (keyed by user id), and signed-out
 * visitors are refused entirely - the store never leaks one operator's fills/approvals to another.
 */
async function resolveFeedOwner(): Promise<{ owner: string } | { denied: NextResponse }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { owner: DEMO_OWNER }; // demo mode - single operator by definition
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { denied: NextResponse.json({ ok: false, error: 'Sign in to view bot notifications.' }, { status: 401 }) };
  return { owner: data.user.id };
}

/** GET the caller's paper-bot flag feed + which delivery channels are live. */
export async function GET() {
  const resolved = await resolveFeedOwner();
  if ('denied' in resolved) return resolved.denied;
  const { owner } = resolved;
  return NextResponse.json({ flags: listFlags(owner, 20), unread: unreadCount(owner), channels: activeChannels() });
}

/** POST { read: true } marks the caller's feed read (clears their unread badge). */
export async function POST(req: Request) {
  const resolved = await resolveFeedOwner();
  if ('denied' in resolved) return resolved.denied;
  const { owner } = resolved;
  try {
    const body = (await req.json()) as { read?: boolean };
    if (body.read) markAllRead(owner);
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true, unread: unreadCount(owner) });
}
