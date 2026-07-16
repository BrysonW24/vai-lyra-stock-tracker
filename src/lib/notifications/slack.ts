/**
 * Slack delivery adapter - SERVER-ONLY.
 *
 * The destination is the USER'S OWN incoming-webhook URL (saved per user in
 * notification_channels via Settings -> Notifications), so unlike Telegram there is
 * no server-side credential: the webhook itself is the secret. Two rules follow:
 *
 * - SSRF fence: we only ever POST to https://hooks.slack.com/services/... - a
 *   destination on any other host is refused outright, so a hostile "webhook" can
 *   never point this server at an arbitrary URL.
 * - Redaction: the webhook path IS the secret, so it must never appear in a log
 *   line, an error string, or a delivery record (see redactSlackWebhook below).
 *
 * Design rules (same contract as telegram.ts):
 * - sendSlackMessage NEVER throws; every outcome is a DeliveryRecord-shaped result.
 * - Idempotency keys are deduped best-effort in process memory; production-grade
 *   exactly-once lives in the delivery log table.
 */
import { randomUUID } from 'node:crypto';
import type { DeliveryRecord } from './types';

const SLACK_WEBHOOK_PREFIX = 'https://hooks.slack.com/services/';
const SEND_TIMEOUT_MS = 8_000;
const SLACK_TEXT_LIMIT = 4_000;

// --- best-effort in-memory idempotency --------------------------------------

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_TRACKED_KEYS = 5_000;
const sentKeys = new Map<string, number>();

function pruneSentKeys(nowMs: number): void {
  if (sentKeys.size < MAX_TRACKED_KEYS) return;
  for (const [key, recordedAt] of sentKeys) {
    if (nowMs - recordedAt > IDEMPOTENCY_TTL_MS) sentKeys.delete(key);
  }
  while (sentKeys.size >= MAX_TRACKED_KEYS) {
    const oldest = sentKeys.keys().next().value;
    if (oldest === undefined) break;
    sentKeys.delete(oldest);
  }
}

// --- webhook validation + redaction ------------------------------------------

/** True only for a real Slack incoming-webhook URL - the SSRF fence for saves and sends. */
export function isValidSlackWebhook(url: string): boolean {
  if (!url.startsWith(SLACK_WEBHOOK_PREFIX)) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'hooks.slack.com' && parsed.pathname.startsWith('/services/') && parsed.pathname.length > '/services/'.length;
  } catch {
    return false;
  }
}

/**
 * Strip the secret path from any webhook URL that might be logged or stored. The
 * team id segment is kept (it is the workspace, not the secret) so records stay
 * debuggable: https://hooks.slack.com/services/T123/[REDACTED]
 */
export function redactSlackWebhook(message: string): string {
  return message.replace(
    /https:\/\/hooks\.slack\.com\/services\/([A-Za-z0-9]+)\/\S*/g,
    'https://hooks.slack.com/services/$1/[REDACTED]',
  );
}

// --- send ----------------------------------------------------------------------

export interface SendSlackOptions {
  /** Originating NotificationEvent id when known - defaults to the idempotency key. */
  eventId?: string;
  /** Owning user id when known. */
  userId?: string;
  attempt?: number;
}

/**
 * Send one message to a Slack incoming webhook. Never throws - inspect `status` on
 * the returned DeliveryRecord ('sent' | 'failed' | 'suppressed'). Note there is no
 * 'demo_logged' state: the webhook is the user's own credential, so a send is always
 * genuinely attempted (or refused as invalid).
 */
export async function sendSlackMessage(
  webhookUrl: string,
  text: string,
  idempotencyKey: string,
  options: SendSlackOptions = {},
): Promise<DeliveryRecord> {
  const nowMs = Date.now();
  const base: Omit<DeliveryRecord, 'status'> = {
    id: randomUUID(),
    eventId: options.eventId ?? idempotencyKey,
    userId: options.userId ?? 'unpaired',
    channel: 'slack',
    // The webhook is the secret - delivery records only ever carry the redacted form.
    destination: redactSlackWebhook(webhookUrl),
    attempt: options.attempt ?? 1,
    createdAt: new Date(nowMs).toISOString(),
  };

  if (!webhookUrl.trim() || !text.trim() || !idempotencyKey.trim()) {
    return { ...base, status: 'failed', errorMessage: 'slack: webhookUrl, text, and idempotencyKey are required' };
  }
  if (!isValidSlackWebhook(webhookUrl)) {
    return { ...base, status: 'failed', errorMessage: 'slack: destination is not a hooks.slack.com incoming-webhook URL' };
  }

  pruneSentKeys(nowMs);
  if (sentKeys.has(idempotencyKey)) {
    return { ...base, status: 'suppressed', errorMessage: 'duplicate idempotency key (best-effort in-memory dedupe)' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, SLACK_TEXT_LIMIT) }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Webhook errors come back as short plain-text bodies (no_service, invalid_token, ...).
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      return { ...base, status: 'failed', errorMessage: redactSlackWebhook(`slack webhook ${res.status}: ${detail}`) };
    }

    sentKeys.set(idempotencyKey, nowMs);
    return { ...base, status: 'sent' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown send error';
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ...base,
      status: 'failed',
      errorMessage: redactSlackWebhook(aborted ? `slack webhook timed out after ${SEND_TIMEOUT_MS}ms` : `slack webhook failed: ${message}`),
    };
  } finally {
    clearTimeout(timer);
  }
}
