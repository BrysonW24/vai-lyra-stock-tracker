/**
 * Server-only pieces of the subscribe-by-link flow: the random public token, the signed links,
 * and what is configured. Never import from a client component.
 *
 * Links are signed, not stored: `sig = HMAC-SHA256(secret, "<purpose>:<row id>")[:32]`, with the
 * secret shared with the worker (SUBSCRIBE_LINK_SECRET, falling back to the dispatch secret both
 * sides already hold). The worker builds the unsubscribe link the same way
 * (workers/stock_scanner/briefing_subscribers.py link_signature), so no secret has to sit in the
 * table and the confirmation secret is never handed to whoever submitted the form - only to the
 * inbox it was sent to, which is the whole point of double opt-in.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export type LinkPurpose = 'confirm' | 'unsubscribe';

/** 128 bits, base64url: the Telegram deep-link parameter and the status poll handle. */
export function newSubscriberToken(): string {
  return randomBytes(16).toString('base64url');
}

export function linkSecret(): string | null {
  return process.env.SUBSCRIBE_LINK_SECRET || process.env.NOTIFICATION_DISPATCH_SECRET || null;
}

export function linkSignature(secret: string, purpose: LinkPurpose, id: string): string {
  return createHmac('sha256', secret).update(`${purpose}:${id}`).digest('hex').slice(0, 32);
}

/** Constant-time check of a supplied signature. */
export function signatureMatches(secret: string, purpose: LinkPurpose, id: string, supplied: string | null | undefined): boolean {
  if (!supplied || supplied.length !== 32) return false;
  const expected = Buffer.from(linkSignature(secret, purpose, id));
  const given = Buffer.from(supplied);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * The public origin links are built on. The customer-facing URL (NEXT_PUBLIC_APP_URL, the custom
 * domain) wins over the worker's base (APP_BASE_URL, which may be the hosting platform's own
 * hostname), with the request's origin as the fallback when neither is set.
 */
export function appBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || '';
  return (configured || request.nextUrl.origin).replace(/\/+$/, '');
}

export function signedLink(baseUrl: string, purpose: LinkPurpose, secret: string, id: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/subscribe/${purpose}?id=${encodeURIComponent(id)}&sig=${linkSignature(secret, purpose, id)}`;
}

/** The bot /subscribe deep-links to - the same one the webhook route answers for. */
export function telegramBotUsername(): string {
  return (process.env.TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
}

export interface SubscribeAvailability {
  /** The deep link only works when the bot's webhook can answer /start: username + token + webhook secret all set. */
  telegram: boolean;
  /** Confirmation emails (and the briefing itself) go through Resend. */
  email: boolean;
}

export function subscribeAvailability(): SubscribeAvailability {
  return {
    telegram: Boolean(telegramBotUsername() && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
    email: Boolean(process.env.RESEND_API_KEY),
  };
}
