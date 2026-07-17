import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { rateLimitShared } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';

/**
 * Engagement capture - the read side of the tagged alert deep links (?nid=&ch=).
 *
 * When a user opens an alert's link, the client beacon posts here once and a
 * notification_engagements row is written: the first behavioral signal the alert layer
 * has ever accumulated. First engagement per (event, channel) wins; repeats no-op via
 * the unique index. The row denormalizes type + relevance from the event so the ledger
 * keeps meaning even after events prune.
 *
 * Deliberately unauthenticated: a Telegram link often opens a browser with no session.
 * The nid is an unguessable uuid the user could only have received in their own alert,
 * and the write is validated against a REAL event before insert. Rate-limited per IP.
 */

const CHANNELS = new Set(['telegram', 'slack', 'push', 'whatsapp', 'web']);

export async function POST(request: NextRequest) {
  const rl = await rateLimitShared(`ip:${clientIp(request)}`, { scope: 'notification_engaged', capacity: 20, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  let body: { nid?: string; ch?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const nid = (body.nid ?? '').trim();
  const channel = CHANNELS.has((body.ch ?? '').trim()) ? (body.ch ?? '').trim() : 'web';
  if (!/^[0-9a-f-]{36}$/i.test(nid)) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: true, demo: true });

  // Only a real event can be engaged - the nid is the proof of receipt.
  const { data: event } = await supabase
    .from('notification_events')
    .select('id, user_id, type, relevance_score')
    .eq('id', nid)
    .maybeSingle();
  if (!event) return NextResponse.json({ ok: false }, { status: 404 });

  const { error } = await supabase.from('notification_engagements').insert({
    event_id: event.id,
    user_id: event.user_id,
    channel,
    notification_type: event.type,
    relevance: typeof event.relevance_score === 'number' ? event.relevance_score : null,
  });
  // 23505 = already engaged on this channel - the first signal stands, repeat is a no-op.
  if (error && error.code !== '23505') return NextResponse.json({ ok: false }, { status: 400 });
  return NextResponse.json({ ok: true });
}
