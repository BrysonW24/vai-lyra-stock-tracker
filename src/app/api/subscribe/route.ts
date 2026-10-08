import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/api/ai-guard';
import { sendEmail } from '@/lib/email/resend';
import { confirmSubscriptionEmail } from '@/lib/email/subscribe-templates';
import { rateLimitShared } from '@/lib/ratelimit';
import { describeSubscription, isValidEmail, normaliseHoldings, normaliseTopics, telegramDeepLink, type SubscribeChannel } from '@/lib/subscribe';
import { appBaseUrl, linkSecret, newSubscriberToken, signedLink, subscribeAvailability, telegramBotUsername } from '@/lib/subscribe-server';
import { createSubscriber, findByToken } from '@/lib/subscribe-store';
import { createSupabaseServiceClient, getSessionUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Subscribe to the evening AI briefing with no account (public, rate-limited).
 *
 * POST  { channel, email?, topics[], holdings[] | "NVDA, QQQ" }
 *   -> telegram: { ok, status: 'pending', token, telegramUrl }  (the button opens the bot; its
 *      /start webhook learns the chat id and activates the row - nobody types an id)
 *   -> email:    { ok, status: 'pending' }  (a confirmation link is sent; the row activates when
 *      it is opened - the secret in that link is never returned to whoever posted the form)
 * GET   ?token=  -> { ok, status, channel }  the page polls this until Telegram says /start
 *
 * Logs carry counts and reasons only - never an address, a chat id or a token.
 */

interface SubscribeBody {
  channel?: unknown;
  email?: unknown;
  topics?: unknown;
  holdings?: unknown;
  source?: unknown;
}

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const limited = await rateLimitShared(`ip:${clientIp(request)}`, { scope: 'subscribe', capacity: 8, windowMs: 600_000 });
  if (!limited.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many attempts - try again in a few minutes.' }, { status: 429, headers: { 'retry-after': String(limited.retryAfterSec) } });
  }

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return bad('Send JSON.');
  }
  const channel = body.channel === 'telegram' || body.channel === 'email' ? (body.channel as SubscribeChannel) : null;
  if (!channel) return bad('Choose Telegram or email.');

  const available = subscribeAvailability();
  if (channel === 'telegram' && !available.telegram) return bad('Telegram subscriptions are not switched on here yet - choose email.', 503);
  if (channel === 'email' && !available.email) return bad('Email subscriptions are not switched on here yet - choose Telegram.', 503);

  const email = channel === 'email' ? String(body.email || '').trim().toLowerCase() : '';
  if (channel === 'email' && !isValidEmail(email)) return bad('Enter a valid email address.');
  const topics = normaliseTopics(body.topics);
  const holdings = normaliseHoldings(body.holdings);
  if (topics.includes('holdings') && holdings.length === 0) return bad('"Just my holdings" needs at least one holding - or pick a topic.');

  const client = createSupabaseServiceClient();
  if (!client) return bad('Subscriptions need the database, which is not configured here.', 503);
  const secret = linkSecret();
  if (channel === 'email' && !secret) return bad('Email subscriptions are not configured here (no link secret).', 503);

  let userId: string | null = null;
  try {
    userId = (await getSessionUser())?.id ?? null; // a signed-in account subscribing: linked, not required
  } catch {
    userId = null;
  }

  const created = await createSubscriber(client, {
    token: newSubscriberToken(),
    channel,
    email,
    topics,
    holdings,
    userId,
    source: typeof body.source === 'string' ? body.source : request.headers.get('referer') || null,
  });
  if ('error' in created) {
    console.warn(JSON.stringify({ at: 'subscribe', event: 'create_failed', reason: created.error }));
    return created.error === 'table_missing'
      ? bad('Subscriptions open shortly - the sign-up table is not in place yet. Try again tomorrow.', 503)
      : bad('Could not save the subscription - try again shortly.', 500);
  }
  const row = created.row;

  if (channel === 'email') {
    const confirmUrl = signedLink(appBaseUrl(request), 'confirm', secret as string, row.id);
    const content = confirmSubscriptionEmail({ confirmUrl, summary: describeSubscription(topics, holdings) });
    const sent = await sendEmail({ to: email, subject: content.subject, html: content.html, text: content.text });
    if (sent.status !== 'sent') {
      console.warn(JSON.stringify({ at: 'subscribe', event: 'confirm_email_failed', status: sent.status, error: sent.error }));
      return bad('We could not send the confirmation email just now - try again shortly.', 502);
    }
    console.info(JSON.stringify({ at: 'subscribe', event: 'created', channel, topics: topics.length, holdings: holdings.length }));
    return NextResponse.json({ ok: true, channel, status: 'pending' });
  }

  console.info(JSON.stringify({ at: 'subscribe', event: 'created', channel, topics: topics.length, holdings: holdings.length }));
  return NextResponse.json({ ok: true, channel, status: 'pending', token: row.token, telegramUrl: telegramDeepLink(telegramBotUsername(), row.token) });
}

export async function GET(request: NextRequest) {
  const limited = await rateLimitShared(`ip:${clientIp(request)}`, { scope: 'subscribe_status', capacity: 120, windowMs: 60_000 });
  if (!limited.allowed) return bad('Slow down.', 429);
  const token = (request.nextUrl.searchParams.get('token') || '').trim();
  if (!token || token.length > 64) return bad('token is required.');
  const client = createSupabaseServiceClient();
  if (!client) return bad('Not configured.', 503);
  const row = await findByToken(client, token);
  if (!row) return bad('Unknown subscription.', 404);
  return NextResponse.json({ ok: true, status: row.status, channel: row.channel }, { headers: { 'cache-control': 'no-store' } });
}
