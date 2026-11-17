import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendCircleRead } from '@/lib/circle/broadcast';
import { CircleStore, CircleStoreUnavailable, circleStoreConfigured } from '@/lib/circle/store';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { SIGNATURE_HEADER, publishSecret, verifySignature } from '@/lib/updates/publish-auth';
import { describeHoldings, getWorldSnapshot } from '@/lib/world/fetch';
import { ipoCalendar, marketHeadlines } from '@/lib/world/news';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The board (about forty quotes), one shared note from the free pool, and a handful of sends.
export const maxDuration = 60;

/**
 * Send the circle's scheduled read. Called by .github/workflows/circle-reads.yml twice a day, never
 * by a browser.
 *
 * The request must be the writer's: signed with UPDATES_PUBLISH_SECRET over a timestamp and the
 * exact body - the same scheme, and the same secret, as the free market read's publish route
 * (src/lib/updates/publish-auth.ts), because it is the same runner holding it. Everything the read
 * says is composed here from the world board; the one model-written note is checked by guardProse
 * inside composeRead (src/lib/circle/reads.ts). Each read is sent once (sendCircleRead claims its id).
 */
const Body = z.object({
  kind: z.enum(['morning', 'evening']),
  rehearsal: z.boolean().optional(),
  force: z.boolean().optional(),
});

const refuse = (reason: string, status: number) => NextResponse.json({ ok: false, reason }, { status });

function updatesUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_BASE_URL?.trim();
  return `${(configured || request.nextUrl.origin).replace(/\/$/, '')}/updates`;
}

export async function POST(request: NextRequest) {
  const secret = publishSecret();
  if (!secret || !circleStoreConfigured()) return refuse('not_configured', 503);
  if (!process.env.TELEGRAM_BOT_TOKEN) return refuse('no_bot', 503);

  const raw = await request.text();
  if (raw.length > 2_000) return refuse('payload_too_large', 413);
  const signature = verifySignature(secret, request.headers.get(SIGNATURE_HEADER), raw);
  if (!signature.ok) return refuse(`signature_${signature.reason}`, 401);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(JSON.parse(raw));
  } catch {
    return refuse('bad_request', 400);
  }

  try {
    const result = await sendCircleRead(
      body.kind,
      Date.now(),
      {
        store: new CircleStore(),
        send: sendTelegramMessage,
        snapshot: () => getWorldSnapshot(),
        headlines: () => marketHeadlines(),
        ipos: () => ipoCalendar(),
        holdings: (symbols) => describeHoldings(symbols),
        groupChatId: process.env.CIRCLE_GROUP_CHAT_ID?.trim() || null,
        updatesUrl: updatesUrl(request),
      },
      { rehearsal: body.rehearsal, force: body.force },
    );
    // Counts and outcomes only - never a member, a ticker or the text.
    console.info(JSON.stringify({ at: 'circle.broadcast', ...result }));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CircleStoreUnavailable) return refuse('not_configured', 503);
    console.warn(JSON.stringify({ at: 'circle.broadcast', event: 'error', error: error instanceof Error ? error.name : 'unknown' }));
    return refuse('error', 500);
  }
}
