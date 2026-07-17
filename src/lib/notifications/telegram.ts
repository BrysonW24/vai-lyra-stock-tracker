/**
 * Telegram delivery adapter - SERVER-ONLY. [Part 8]
 *
 * Reads TELEGRAM_BOT_TOKEN from server-side env at call time. This module must never
 * be imported from a client component and the token must never appear in a
 * NEXT_PUBLIC_* variable, a log line, or an error string (see redactBotToken below).
 *
 * Design rules:
 * - sendTelegramMessage NEVER throws. Every outcome is returned as a
 *   DeliveryRecord-shaped result (src/lib/notifications/types.ts) so callers can
 *   persist or log it without try/catch ceremony.
 * - When no token is configured the send becomes a no-op "demo_logged" record, which
 *   keeps demo mode honest: nothing silently pretends to deliver.
 * - Idempotency keys are deduped best-effort in process memory. Serverless instances
 *   do not share memory, so production-grade exactly-once needs the delivery log
 *   table (see docs/integrations/telegram.md - replay and idempotency).
 */
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { DeliveryRecord } from './types';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const SEND_TIMEOUT_MS = 8_000;
const TELEGRAM_TEXT_LIMIT = 4_096;

// --- best-effort in-memory idempotency --------------------------------------

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_TRACKED_KEYS = 5_000;
const sentKeys = new Map<string, number>();

function pruneSentKeys(nowMs: number): void {
  if (sentKeys.size < MAX_TRACKED_KEYS) return;
  for (const [key, recordedAt] of sentKeys) {
    if (nowMs - recordedAt > IDEMPOTENCY_TTL_MS) sentKeys.delete(key);
  }
  // Hard cap: if still oversized after TTL pruning, drop oldest insertion order.
  while (sentKeys.size >= MAX_TRACKED_KEYS) {
    const oldest = sentKeys.keys().next().value;
    if (oldest === undefined) break;
    sentKeys.delete(oldest);
  }
}

// --- token redaction ---------------------------------------------------------

/**
 * Strip the bot token from any string that might be logged or stored. Covers both
 * the literal configured token and the generic `bot<digits>:<secret>` URL shape so
 * provider error bodies can never leak credentials.
 */
export function redactBotToken(message: string, token?: string): string {
  let safe = message;
  if (token && token.length > 0) safe = safe.split(token).join('[REDACTED_BOT_TOKEN]');
  return safe.replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[REDACTED_BOT_TOKEN]');
}

// --- sendMessage -------------------------------------------------------------

export interface SendTelegramOptions {
  /** Originating NotificationEvent id when known - defaults to the idempotency key. */
  eventId?: string;
  /** Owning user id when known - 'unpaired' otherwise (webhook replies pre-pairing). */
  userId?: string;
  attempt?: number;
  /**
   * Telegram parse mode. Omit for plain text. 'HTML' unlocks the rich layout built by
   * telegram-templates.ts - but Telegram rejects the ENTIRE message with a 400 if the
   * markup is malformed, so only pass it for text from a renderer that escapes its inputs.
   */
  parseMode?: 'HTML' | 'MarkdownV2';
}

interface TelegramSendResponse {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number };
}

/**
 * Send one Telegram message to a chat id. Never throws - inspect `status` on the
 * returned DeliveryRecord ('sent' | 'failed' | 'suppressed' | 'demo_logged').
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  idempotencyKey: string,
  options: SendTelegramOptions = {},
): Promise<DeliveryRecord> {
  const nowMs = Date.now();
  const base: Omit<DeliveryRecord, 'status'> = {
    id: randomUUID(),
    eventId: options.eventId ?? idempotencyKey,
    userId: options.userId ?? 'unpaired',
    channel: 'telegram',
    destination: chatId,
    attempt: options.attempt ?? 1,
    createdAt: new Date(nowMs).toISOString(),
  };

  if (!chatId.trim() || !text.trim() || !idempotencyKey.trim()) {
    return { ...base, status: 'failed', errorMessage: 'telegram: chatId, text, and idempotencyKey are required' };
  }

  pruneSentKeys(nowMs);
  if (sentKeys.has(idempotencyKey)) {
    return {
      ...base,
      status: 'suppressed',
      errorMessage: 'duplicate idempotency key (best-effort in-memory dedupe)',
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    // No token configured: honest no-op. Log enough to debug, never the message body.
    console.info(
      JSON.stringify({ at: 'telegram.send', status: 'demo_logged', destination: chatId, idempotencyKey }),
    );
    return { ...base, status: 'demo_logged' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const post = (payload: Record<string, unknown>) =>
      fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

    const basePayload = {
      chat_id: chatId,
      text: text.slice(0, TELEGRAM_TEXT_LIMIT),
      disable_web_page_preview: true,
    };

    let res = await post(options.parseMode ? { ...basePayload, parse_mode: options.parseMode } : basePayload);
    let raw = await res.text();
    let parsed: TelegramSendResponse = {};
    try {
      parsed = JSON.parse(raw) as TelegramSendResponse;
    } catch {
      // Non-JSON body (proxy error page etc.) - fall through to the failure branch.
    }

    // Telegram 400s the WHOLE message on malformed markup. An alert is worth more than its
    // formatting, so retry once as plain text rather than let a rendering bug swallow it.
    const isParseFailure =
      options.parseMode !== undefined &&
      res.status === 400 &&
      /can't parse entities|unsupported start tag|unclosed|entity/i.test(parsed.description ?? '');
    if (isParseFailure) {
      console.warn(
        JSON.stringify({
          at: 'telegram.send',
          status: 'parse_mode_fallback',
          idempotencyKey,
          detail: redactBotToken(parsed.description ?? '', token).slice(0, 200),
        }),
      );
      res = await post(basePayload);
      raw = await res.text();
      parsed = {};
      try {
        parsed = JSON.parse(raw) as TelegramSendResponse;
      } catch {
        /* fall through to the failure branch */
      }
    }

    if (!res.ok || parsed.ok !== true) {
      const detail = parsed.description ?? raw.slice(0, 200);
      return {
        ...base,
        status: 'failed',
        errorMessage: redactBotToken(`telegram sendMessage ${res.status}: ${detail}`, token),
      };
    }

    sentKeys.set(idempotencyKey, nowMs);
    return {
      ...base,
      status: 'sent',
      providerMessageId:
        parsed.result?.message_id != null ? String(parsed.result.message_id) : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown send error';
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ...base,
      status: 'failed',
      errorMessage: redactBotToken(aborted ? `telegram sendMessage timed out after ${SEND_TIMEOUT_MS}ms` : `telegram sendMessage failed: ${message}`, token),
    };
  } finally {
    clearTimeout(timer);
  }
}

// --- pairing codes -----------------------------------------------------------

/**
 * One-time pairing code shape, mirroring the channel_pairing_codes table columns:
 * code_hash (sha256 hex), created_at, expires_at, used_at (null until consumed).
 * The plaintext `code` is shown to the user once in the web app and NEVER stored -
 * only the hash is persisted, so a leaked table cannot be replayed.
 */
export interface PairingCode {
  /** Plaintext 6-char code - display once, never persist. */
  code: string;
  /** sha256 hex of the normalised code - persist as channel_pairing_codes.code_hash. */
  codeHash: string;
  /** ISO timestamp - channel_pairing_codes.created_at. */
  createdAt: string;
  /** ISO timestamp 10 minutes out - channel_pairing_codes.expires_at. */
  expiresAt: string;
}

export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_TTL_MINUTES = 10;
/** Unambiguous alphabet: no 0/O, 1/I/L pairs that users mistype from a phone. */
const PAIRING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Normalise then hash a pairing code - the only form that may touch storage. */
export function hashPairingCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

/** Generate a one-time pairing code using crypto-grade randomness (randomInt). */
export function buildPairingCode(now: Date = new Date()): PairingCode {
  let code = '';
  for (let i = 0; i < PAIRING_CODE_LENGTH; i += 1) {
    code += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  }
  return {
    code,
    codeHash: hashPairingCode(code),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PAIRING_CODE_TTL_MINUTES * 60_000).toISOString(),
  };
}
