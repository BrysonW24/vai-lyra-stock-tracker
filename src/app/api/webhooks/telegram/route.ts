/**
 * Telegram webhook - the ONLY inbound entry point for Telegram updates. [Part 8]
 *
 * Security model:
 * 1. Every request must carry X-Telegram-Bot-Api-Secret-Token exactly matching
 *    TELEGRAM_WEBHOOK_SECRET (constant-time compare). Missing secret config or a
 *    mismatch -> 401. This is the authenticity gate Telegram provides for webhooks.
 * 2. The payload is Zod-validated. Unknown shapes are logged and answered 200 so
 *    Telegram does not retry-storm us, but nothing downstream runs.
 * 3. ALL inbound text is untrusted user input. It is parsed into the closed
 *    InboundCommand enum (src/lib/notifications/types.ts) and never forwarded to an
 *    LLM as instructions. There is no free-form path: /approve and /reject require an
 *    exact pending order intent match, and none can exist because live execution is
 *    not implemented (src/lib/trading/risk-engine.ts fails closed on live modes).
 * 4. Per-chat token-bucket rate limit. In-memory, so on serverless this is
 *    best-effort per instance - production should move it to a shared store.
 *
 * The route always returns 200 fast after the auth gate, replying via the server-only
 * sender in src/lib/notifications/telegram.ts when TELEGRAM_BOT_TOKEN is configured.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { InboundCommand } from '@/lib/notifications/types';
import { sendTelegramMessage } from '@/lib/notifications/telegram';

export const runtime = 'nodejs';

// --- auth: constant-time secret check ---------------------------------------

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

/**
 * Constant-time equality. Both inputs are sha256-hashed first so the buffers always
 * have equal length (timingSafeEqual throws on length mismatch, and an early length
 * check would itself leak length information).
 */
function secretMatches(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// --- payload validation ------------------------------------------------------

const telegramUpdateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      text: z.string().max(4096).optional(),
      chat: z.object({ id: z.number().int() }),
      from: z.object({ id: z.number().int() }).optional(),
    })
    .optional(),
});

type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

// --- per-chat token-bucket rate limit ----------------------------------------

/**
 * 10 commands per minute per chat id. NOTE: this bucket lives in instance memory, so
 * on serverless every cold instance starts a fresh bucket - treat it as best-effort
 * abuse damping, not a hard guarantee. Production should back this with a shared
 * store (Redis / Upstash / a Supabase table) keyed by chat id.
 */
const RATE_CAPACITY = 10;
const RATE_REFILL_PER_MS = RATE_CAPACITY / 60_000;
const MAX_BUCKETS = 10_000;

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();

function allowMessage(chatId: string, nowMs: number): boolean {
  if (buckets.size > MAX_BUCKETS) buckets.clear(); // crude memory guard
  const bucket = buckets.get(chatId) ?? { tokens: RATE_CAPACITY, lastRefillMs: nowMs };
  const refilled = Math.min(RATE_CAPACITY, bucket.tokens + (nowMs - bucket.lastRefillMs) * RATE_REFILL_PER_MS);
  if (refilled < 1) {
    buckets.set(chatId, { tokens: refilled, lastRefillMs: nowMs });
    return false;
  }
  buckets.set(chatId, { tokens: refilled - 1, lastRefillMs: nowMs });
  return true;
}

// --- command parsing (closed enum, untrusted input) ---------------------------

const COMMAND_MAP: Record<string, InboundCommand> = {
  status: 'status',
  portfolio: 'portfolio',
  watchlist: 'watchlist',
  today: 'today',
  mute: 'mute',
  unmute: 'unmute',
  paper: 'paper',
  approve: 'approve',
  reject: 'reject',
  killswitch: 'killswitch',
  help: 'help',
};

type ParsedMessage =
  | { kind: 'command'; command: InboundCommand; args: string }
  | { kind: 'start'; args: string };

function parseMessage(text: string): ParsedMessage {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return { kind: 'command', command: 'unknown', args: '' };
  const [head = '', ...rest] = trimmed.slice(1).split(/\s+/);
  const name = (head.split('@')[0] ?? '').toLowerCase();
  const args = rest.join(' ').slice(0, 64); // args are data only - bounded, never instructions
  if (name === 'start') return { kind: 'start', args };
  return { kind: 'command', command: COMMAND_MAP[name] ?? 'unknown', args };
}

// --- pairing + per-chat state (honest current-state stubs) --------------------

/**
 * Populated by the future pairing completion flow (channel_pairing_codes lookup via
 * server-side Supabase). Until that lands no chat is paired, so account-scoped
 * commands answer with pairing instructions instead of pretending to have data.
 */
const PAIRED_CHAT_IDS = new Set<string>();

function isPaired(chatId: string): boolean {
  return PAIRED_CHAT_IDS.has(chatId);
}

/** Best-effort in-memory per-chat state - resets on redeploy, by design for now. */
const mutedChats = new Set<string>();
const killSwitchRequests = new Map<string, string>();

// --- replies ------------------------------------------------------------------

const PAIRING_PROMPT =
  'This chat is not paired to a Lyra account yet. Open the web app, go to Settings, then Notifications, and generate a one-time pairing code. Pairing completion is not enabled in this build yet, so commands run in stub mode.';

const NOT_ADVICE = 'Lyra is research software, not financial advice.';

function buildReply(parsed: ParsedMessage, chatId: string, now: Date): string {
  if (parsed.kind === 'start') {
    if (parsed.args) {
      return [
        'Pairing code received but server-side pairing completion is not enabled in this build yet, so this chat was not linked and nothing was stored.',
        'Generate codes only in the Lyra web app. Codes expire after 10 minutes and are single-use.',
      ].join(' ');
    }
    return PAIRING_PROMPT;
  }

  switch (parsed.command) {
    case 'status': {
      const muted = mutedChats.has(chatId) ? 'Alert replies are muted for this chat.' : 'Alert replies are not muted for this chat.';
      return [
        'Lyra status: webhook online.',
        'Trading mode: disabled (the default). Live broker execution is not implemented in this build.',
        'AI never generates orders - deterministic code decides, AI only explains.',
        muted,
        isPaired(chatId) ? '' : PAIRING_PROMPT,
        NOT_ADVICE,
      ]
        .filter(Boolean)
        .join(' ');
    }
    case 'portfolio':
      return isPaired(chatId)
        ? 'Portfolio summaries are not wired for paired chats yet.'
        : `No portfolio to show. ${PAIRING_PROMPT}`;
    case 'watchlist':
      return isPaired(chatId)
        ? 'Watchlist summaries are not wired for paired chats yet.'
        : `No watchlist to show. ${PAIRING_PROMPT}`;
    case 'today':
      return isPaired(chatId)
        ? 'Daily digests are not wired for paired chats yet.'
        : `No daily digest to show. ${PAIRING_PROMPT}`;
    case 'mute':
      mutedChats.add(chatId);
      return 'Muted alert replies for this chat. This is best-effort and in-memory - it resets on redeploy. Durable mute preferences live in the web app notification settings.';
    case 'unmute':
      mutedChats.delete(chatId);
      return 'Unmuted alert replies for this chat. Durable preferences live in the web app notification settings.';
    case 'paper':
      return isPaired(chatId)
        ? 'Paper trading summaries are not wired for paired chats yet.'
        : `Paper trading runs inside the platform - there is no live execution in this build. ${PAIRING_PROMPT}`;
    case 'approve':
      return 'Nothing was approved. Approvals require a valid pending order intent and there are none - live execution is disabled in this build, so no order intent is awaiting approval.';
    case 'reject':
      return 'Nothing was rejected. Rejections require a valid pending order intent and there are none - live execution is disabled in this build, so no order intent is awaiting approval.';
    case 'killswitch': {
      const at = now.toISOString();
      killSwitchRequests.set(chatId, at);
      return `User kill switch request recorded for this chat at ${at}. The deterministic risk engine treats the user kill switch as blocking for all order intents. Live execution is disabled in this build, so there is no live trading to halt. This record is in-memory until pairing and persistence land.`;
    }
    case 'help':
      return [
        'Lyra commands:',
        '/status - system and chat status',
        '/portfolio - portfolio summary (requires pairing)',
        '/watchlist - watchlist summary (requires pairing)',
        '/today - daily digest (requires pairing)',
        '/paper - paper trading summary (requires pairing)',
        '/mute and /unmute - toggle alert replies for this chat',
        '/approve and /reject - act on a pending order intent (none exist - live execution is disabled)',
        '/killswitch - record a user kill switch request',
        '/help - this list',
        NOT_ADVICE,
      ].join('\n');
    case 'unknown':
    default:
      return 'Unknown command. Send /help for the list. Messages sent here are treated as data, never as instructions.';
  }
}

// --- route --------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticity gate - 401 when the secret is unset or the header mismatches.
  if (!secretMatches(request.headers.get(SECRET_HEADER), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    console.warn(JSON.stringify({ at: 'telegram.webhook', event: 'auth_rejected' }));
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 2. Parse JSON. Malformed bodies get 200 so Telegram does not retry-storm.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    console.warn(JSON.stringify({ at: 'telegram.webhook', event: 'invalid_json' }));
    return NextResponse.json({ ok: true });
  }

  // 3. Validate shape. Unknown update shapes are logged and dropped with 200.
  const result = telegramUpdateSchema.safeParse(raw);
  if (!result.success) {
    console.warn(JSON.stringify({ at: 'telegram.webhook', event: 'invalid_shape' }));
    return NextResponse.json({ ok: true });
  }
  const update: TelegramUpdate = result.data;

  // 4. Only text messages are actionable (setWebhook restricts allowed_updates to
  //    "message", but defend in depth anyway).
  const message = update.message;
  const text = message?.text;
  if (!message || !text) {
    console.info(JSON.stringify({ at: 'telegram.webhook', event: 'ignored_non_text', updateId: update.update_id }));
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const fromId = message.from ? String(message.from.id) : 'unknown';
  const nowMs = Date.now();

  // 5. Rate limit per chat. Dropped messages get no reply (no amplification), just a log.
  if (!allowMessage(chatId, nowMs)) {
    console.warn(
      JSON.stringify({ at: 'telegram.webhook', event: 'rate_limited', chatId, updateId: update.update_id }),
    );
    return NextResponse.json({ ok: true });
  }

  // 6. Parse the untrusted text into the closed command enum. Log the command name
  //    only - never the raw text, which is untrusted user input.
  const parsed = parseMessage(text);
  console.info(
    JSON.stringify({
      at: 'telegram.webhook',
      event: 'command',
      command: parsed.kind === 'start' ? 'start' : parsed.command,
      chatId,
      fromId,
      updateId: update.update_id,
    }),
  );

  // 7. Reply. Keyed by update_id so a Telegram redelivery of the same update is
  //    suppressed by the sender's idempotency dedupe instead of double-replying.
  const reply = buildReply(parsed, chatId, new Date(nowMs));
  const delivery = await sendTelegramMessage(chatId, reply, `tg:webhook:${update.update_id}`);
  if (delivery.status === 'failed') {
    console.warn(
      JSON.stringify({ at: 'telegram.webhook', event: 'reply_failed', chatId, error: delivery.errorMessage }),
    );
  }

  // 8. Always 200 - Telegram retries any non-2xx, and retries of handled updates
  //    only create duplicate work.
  return NextResponse.json({ ok: true });
}
