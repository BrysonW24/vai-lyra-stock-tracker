import { type NextRequest, NextResponse } from 'next/server';
import { coerceFeedbackType, deliverFeedback } from '@/lib/feedback';
import { rateLimitShared } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';

/**
 * In-app feedback intake. The point: a non-technical user types one box and hits
 * send - and it lands where the maintainer actually looks. Delivery fans out to
 * every configured sink (GitHub issue, Slack message - see src/lib/feedback.ts
 * for the env vars); with nothing configured it logs so nothing is lost.
 */

export async function POST(request: NextRequest) {
  // Each submission can open a GitHub issue + post to Slack - dampen drive-by spam.
  const rl = await rateLimitShared(`ip:${clientIp(request)}`, { scope: 'feedback', capacity: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many submissions - wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }
  // And a daily ceiling: at 5 a minute one address could still open 7,200 issues a day.
  const daily = await rateLimitShared(`ip:${clientIp(request)}`, { scope: 'feedback_day', capacity: 20, windowMs: 86_400_000 });
  if (!daily.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Daily feedback limit reached - thank you, please try again tomorrow.' },
      { status: 429, headers: { 'Retry-After': String(daily.retryAfterSec) } },
    );
  }

  let body: { type?: unknown; message?: unknown; email?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }
  // A JSON body can be `null`, and its fields can be anything: check before treating as text.
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ ok: false, error: 'Please enter a message.' }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ ok: false, error: 'Message too long.' }, { status: 400 });

  const type = coerceFeedbackType(body.type);
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : '';

  const delivery = await deliverFeedback({ type, message, email });
  return NextResponse.json({ ok: true, filed: delivery.filed, url: delivery.url });
}
