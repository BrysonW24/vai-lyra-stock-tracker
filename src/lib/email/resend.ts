/**
 * Email delivery adapter (Resend) - SERVER-ONLY.
 *
 * The first non-auth email Lyra sends itself: the briefing subscription's confirmation link. The
 * nightly briefing emails go out from the worker (workers/stock_scanner/briefing_subscribers.py)
 * through the same provider and the same from-address. Same rules as the Telegram sender:
 * never throws, never logs the key or the address, an unconfigured key is an honest
 * `demo_logged` no-op rather than a silent success.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;
export const DEFAULT_FROM_EMAIL = 'Lyra <briefing@send.vivacityai.com.au>';

export interface EmailSendInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra headers, e.g. List-Unsubscribe for list mail. */
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  status: 'sent' | 'failed' | 'demo_logged';
  providerId?: string;
  /** Provider error, key-free and bounded, for the caller's log line. */
  error?: string;
}

export function fromEmail(): string {
  return process.env.BRIEFING_FROM_EMAIL || DEFAULT_FROM_EMAIL;
}

export async function sendEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(JSON.stringify({ at: 'email.send', status: 'demo_logged' }));
    return { status: 'demo_logged' };
  }
  if (!input.to.trim() || !input.subject.trim()) return { status: 'failed', error: 'email: to and subject are required' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: fromEmail(), to: [input.to], subject: input.subject, html: input.html, text: input.text, headers: input.headers }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let parsed: { id?: string; message?: string } = {};
    try {
      parsed = JSON.parse(raw) as { id?: string; message?: string };
    } catch {
      // Non-JSON body: reported through the status code below.
    }
    if (!response.ok) {
      return { status: 'failed', error: `resend ${response.status}: ${(parsed.message || raw).slice(0, 160).split(key).join('[REDACTED]')}` };
    }
    return { status: 'sent', providerId: parsed.id };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { status: 'failed', error: aborted ? `resend timed out after ${SEND_TIMEOUT_MS}ms` : `resend failed: ${err instanceof Error ? err.name : 'unknown'}` };
  } finally {
    clearTimeout(timer);
  }
}
