import { NextResponse } from 'next/server';
import { listFlags, unreadCount, markAllRead } from '@/lib/trading/notifications-store';
import { activeChannels } from '@/lib/trading/notify-delivery';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * The flag store is process-global single-operator state. On a demo deploy (no Supabase)
 * that is the whole universe, so the feed stays open. On a CONFIGURED deploy the feed must
 * not leak the operator's fills/approvals to signed-out visitors - require a session.
 */
async function requireSessionWhenConfigured(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null; // demo mode - single-user by definition
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false, error: 'Sign in to view bot notifications.' }, { status: 401 });
  return null;
}

/** GET the paper-bot flag feed + which delivery channels are live. */
export async function GET() {
  const denied = await requireSessionWhenConfigured();
  if (denied) return denied;
  return NextResponse.json({ flags: listFlags(20), unread: unreadCount(), channels: activeChannels() });
}

/** POST { read: true } marks the feed read (clears the unread badge). */
export async function POST(req: Request) {
  const denied = await requireSessionWhenConfigured();
  if (denied) return denied;
  try {
    const body = (await req.json()) as { read?: boolean };
    if (body.read) markAllRead();
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true, unread: unreadCount() });
}
