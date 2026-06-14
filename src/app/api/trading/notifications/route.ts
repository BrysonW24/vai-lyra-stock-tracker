import { NextResponse } from 'next/server';
import { listFlags, unreadCount, markAllRead } from '@/lib/trading/notifications-store';
import { activeChannels } from '@/lib/trading/notify-delivery';

export const dynamic = 'force-dynamic';

/** GET the paper-bot flag feed + which delivery channels are live. */
export async function GET() {
  return NextResponse.json({ flags: listFlags(20), unread: unreadCount(), channels: activeChannels() });
}

/** POST { read: true } marks the feed read (clears the unread badge). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { read?: boolean };
    if (body.read) markAllRead();
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true, unread: unreadCount() });
}
