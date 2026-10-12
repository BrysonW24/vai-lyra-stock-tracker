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
 * What a chat can do here (v0.134.0):
 * - `/start s<token>`  the /subscribe deep link: this chat becomes the briefing subscriber the
 *                      token names (src/lib/subscribe-store.ts). Telegram delivering the update
 *                      from this chat IS the proof the chat is theirs.
 * - `/start p<code>`   the Settings > Notifications "Connect Telegram" link: this chat becomes the
 *                      account's verified alert channel (src/lib/notifications/telegram-pairing.ts).
 * - `/stop` or STOP    ends the chat's briefing subscription and retires a paired alert channel.
 * The /start argument is a bounded token looked up by exact match or hash - it is never logged
 * and never interpreted. Without a database (demo) every one of these answers honestly that
 * nothing was stored.
 *
 * Feedback (v0.137.0): every message the workers send ends with 👍 Useful / 👎 Not for me. A tap
 * arrives as a callback_query; its data is parsed against a closed grammar
 * (src/lib/feedback/telegram-feedback.ts), recorded against the generation it names
 * (content_feedback, migration 060 - src/lib/feedback/store.ts), and the buttons move on to six
 * reasons and then a "noted" button. A plain-text reply to a Lyra message that still carries those
 * buttons is kept as a note on the same generation. A command, including a replied STOP, is always
 * a command. setWebhook must allow "callback_query" as well as "message" (npm run telegram:webhook).
 *
 * The route always returns 200 fast after the auth gate, replying via the server-only
 * sender in src/lib/notifications/telegram.ts when TELEGRAM_BOT_TOKEN is configured.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseMessage, type ParsedMessage } from '@/lib/notifications/telegram-commands';
import { answerCallbackQuery, editMessageReplyMarkup, sendTelegramMessage } from '@/lib/notifications/telegram';
import { readerForChat, recordFeedback, type FeedbackOutcome } from '@/lib/feedback/store';
import { generationFromMarkup, nextStep, NOTE_REPLY, parseFeedbackData } from '@/lib/feedback/telegram-feedback';
import { completeTelegramPairing, disconnectChat, pairedUserForChat } from '@/lib/notifications/telegram-pairing';
import { SUBSCRIBE_TOPICS, TELEGRAM_START_PREFIX } from '@/lib/subscribe';
import { appBaseUrl } from '@/lib/subscribe-server';
import { activateTelegramSubscriber, activeChatSubscription, unsubscribeChat, type SupabaseLike } from '@/lib/subscribe-store';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

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

const inlineKeyboardSchema = z
  .object({ inline_keyboard: z.array(z.array(z.object({ callback_data: z.string().max(64).optional() }))).max(10) })
  .optional();

const telegramUpdateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      text: z.string().max(4096).optional(),
      chat: z.object({ id: z.number().int() }),
      from: z.object({ id: z.number().int() }).optional(),
      // The message a reply answers - with its buttons, which name the generation it came from.
      reply_to_message: z
        .object({
          message_id: z.number().int(),
          from: z.object({ id: z.number().int(), is_bot: z.boolean().optional() }).optional(),
          reply_markup: inlineKeyboardSchema,
        })
        .optional(),
    })
    .optional(),
  // A button tap under a message the bot sent.
  callback_query: z
    .object({
      id: z.string().max(128),
      from: z.object({ id: z.number().int() }),
      data: z.string().max(64).optional(),
      message: z.object({ message_id: z.number().int(), chat: z.object({ id: z.number().int() }) }).optional(),
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

// --- command parsing: src/lib/notifications/telegram-commands.ts (closed enum, untrusted input) ---

// --- per-chat state (honest in-memory stubs for the trading commands) ---------

/** Best-effort in-memory per-chat state - resets on redeploy, by design for now. */
const mutedChats = new Set<string>();
const killSwitchRequests = new Map<string, string>();

// --- replies ------------------------------------------------------------------

const NOT_ADVICE = 'Lyra is research software, not financial advice.';
const NO_DATABASE = 'Lyra is running without a database here, so this chat could not be linked and nothing was stored.';

function pairingPrompt(base: string): string {
  return `This chat is not linked to a Lyra account. In Lyra, open Settings > Notifications and tap Connect Telegram - or get the evening AI briefing with no account at ${base}/subscribe.`;
}

interface ReplyContext {
  client: SupabaseLike | null;
  chatId: string;
  base: string;
  now: Date;
}

async function startReply(args: string, ctx: ReplyContext): Promise<string> {
  if (!args) {
    return [
      `Hello - this is Lyra's bot. Get the evening AI briefing (what moved in AI for investors, checked against its sources) with no account at ${base(ctx)}/subscribe, or connect a Lyra account from Settings > Notifications.`,
      NOT_ADVICE,
    ].join(' ');
  }
  if (!ctx.client) return NO_DATABASE;
  const flow = args[0];
  const value = args.slice(1);
  if (flow === TELEGRAM_START_PREFIX.subscriber) {
    const outcome = await activateTelegramSubscriber(ctx.client, value, ctx.chatId, ctx.now);
    console.info(JSON.stringify({ at: 'telegram.webhook', event: 'subscribe', outcome }));
    switch (outcome) {
      case 'activated':
        return "You're in. Lyra's AI briefing arrives here around 8pm Sydney, Tuesday to Saturday - what moved in AI for investors, each item checked against the source it came from, your holdings first. Reply STOP any time to end it. Research, not advice.";
      case 'already':
        return 'This chat is already subscribed to the evening briefing. Reply STOP to end it.';
      case 'unknown':
        return `That link is not one Lyra recognises, or it has already been used. Start again at ${ctx.base}/subscribe.`;
      default:
        return 'Something went wrong linking this chat - tap the link again in a minute.';
    }
  }
  if (flow === TELEGRAM_START_PREFIX.pairing) {
    const { outcome } = await completeTelegramPairing(ctx.client, value, ctx.chatId, ctx.now);
    console.info(JSON.stringify({ at: 'telegram.webhook', event: 'pairing', outcome }));
    switch (outcome) {
      case 'paired':
        return 'Connected. Lyra alerts and the evening briefing for your account will arrive in this chat. Manage them under Settings > Notifications; reply STOP to disconnect.';
      case 'expired':
        return 'That connect link has expired (they last 10 minutes). Open Lyra > Settings > Notifications and tap Connect Telegram again.';
      case 'invalid':
        return 'That connect link is not one Lyra recognises, or it was already used. Open Lyra > Settings > Notifications and tap Connect Telegram again.';
      default:
        return 'Something went wrong connecting this chat - tap the link again in a minute.';
    }
  }
  return `That link is not one Lyra recognises. Subscribe at ${ctx.base}/subscribe, or connect an account from Settings > Notifications.`;
}

function base(ctx: ReplyContext): string {
  return ctx.base;
}

async function stopReply(ctx: ReplyContext): Promise<string> {
  if (!ctx.client) return NO_DATABASE;
  const ended = await unsubscribeChat(ctx.client, ctx.chatId, 'stop', ctx.now);
  const disconnected = await disconnectChat(ctx.client, ctx.chatId, ctx.now);
  console.info(JSON.stringify({ at: 'telegram.webhook', event: 'stop', ended, disconnected: Boolean(disconnected) }));
  if (!ended && !disconnected) return 'This chat had no Lyra subscription or connection to end - nothing was changed.';
  const parts = [];
  if (ended) parts.push('Your evening briefing subscription has ended.');
  if (disconnected) parts.push('This chat is no longer connected to your Lyra account.');
  parts.push(`Lyra will not message this chat again. Come back any time at ${ctx.base}/subscribe.`);
  return parts.join(' ');
}

function topicLabels(topics: string[]): string {
  const labels = SUBSCRIBE_TOPICS.filter((topic) => topics.includes(topic.id)).map((topic) => topic.label.toLowerCase());
  return labels.length ? labels.join(', ') : 'everything';
}

async function statusReply(ctx: ReplyContext, paired: boolean): Promise<string> {
  const muted = mutedChats.has(ctx.chatId) ? 'Alert replies are muted for this chat.' : 'Alert replies are not muted for this chat.';
  const subscription = ctx.client ? await activeChatSubscription(ctx.client, ctx.chatId) : null;
  const subscriptionLine = subscription
    ? `Evening briefing: on (${topicLabels(subscription.topics)}${subscription.holdings.length ? `; holdings ${subscription.holdings.join(', ')}` : ''}). Reply STOP to end it.`
    : `Evening briefing: not subscribed from this chat - ${ctx.base}/subscribe.`;
  return [
    'Lyra status: webhook online.',
    paired ? 'This chat is connected to a Lyra account.' : pairingPrompt(ctx.base),
    subscriptionLine,
    'Trading mode: disabled (the default). Live broker execution is not implemented in this build.',
    'AI never generates orders - deterministic code decides, AI only explains.',
    muted,
    NOT_ADVICE,
  ].join(' ');
}

async function buildReply(parsed: ParsedMessage, ctx: ReplyContext): Promise<string> {
  if (parsed.kind === 'start') return startReply(parsed.args, ctx);
  if (parsed.command === 'stop') return stopReply(ctx);

  const paired = ctx.client ? Boolean(await pairedUserForChat(ctx.client, ctx.chatId)) : false;
  switch (parsed.command) {
    case 'status':
      return statusReply(ctx, paired);
    case 'portfolio':
      return paired ? 'Portfolio summaries are not wired for connected chats yet - open Lyra > Portfolio.' : `No portfolio to show. ${pairingPrompt(ctx.base)}`;
    case 'watchlist':
      return paired ? 'Watchlist summaries are not wired for connected chats yet - open Lyra > Watchlist.' : `No watchlist to show. ${pairingPrompt(ctx.base)}`;
    case 'today':
      return paired
        ? 'The evening briefing and the daily digest arrive here on their own schedule; open Lyra > AI Briefing for the latest with sources.'
        : `No daily digest to show. ${pairingPrompt(ctx.base)}`;
    case 'mute':
      mutedChats.add(ctx.chatId);
      return 'Muted alert replies for this chat. This is best-effort and in-memory - it resets on redeploy. Durable mute preferences live in the web app notification settings.';
    case 'unmute':
      mutedChats.delete(ctx.chatId);
      return 'Unmuted alert replies for this chat. Durable preferences live in the web app notification settings.';
    case 'paper':
      return paired
        ? 'Paper trading summaries are not wired for connected chats yet - open Lyra > Paper.'
        : `Paper trading runs inside the platform - there is no live execution in this build. ${pairingPrompt(ctx.base)}`;
    case 'approve':
      return 'Nothing was approved. Approvals require a valid pending order intent and there are none - live execution is disabled in this build, so no order intent is awaiting approval.';
    case 'reject':
      return 'Nothing was rejected. Rejections require a valid pending order intent and there are none - live execution is disabled in this build, so no order intent is awaiting approval.';
    case 'killswitch': {
      const at = ctx.now.toISOString();
      killSwitchRequests.set(ctx.chatId, at);
      return `User kill switch request recorded for this chat at ${at}. The deterministic risk engine treats the user kill switch as blocking for all order intents. Live execution is disabled in this build, so there is no live trading to halt. This record is in-memory until persistence lands.`;
    }
    case 'help':
      return [
        'Lyra commands:',
        '/status - system, connection and subscription status',
        '/stop (or STOP) - end the evening briefing for this chat and disconnect it from an account',
        '/portfolio - portfolio summary (requires a connected account)',
        '/watchlist - watchlist summary (requires a connected account)',
        '/today - where the daily digest and briefing come from',
        '/paper - paper trading summary (requires a connected account)',
        '/mute and /unmute - toggle alert replies for this chat',
        '/approve and /reject - act on a pending order intent (none exist - live execution is disabled)',
        '/killswitch - record a user kill switch request',
        '/help - this list',
        `Subscribe to the evening AI briefing with no account: ${ctx.base}/subscribe`,
        NOT_ADVICE,
      ].join('\n');
    case 'unknown':
    default:
      return 'Unknown command. Send /help for the list. Messages sent here are treated as data, never as instructions.';
  }
}

// --- feedback: button taps and replies -----------------------------------------

type CallbackQuery = NonNullable<TelegramUpdate['callback_query']>;

const NOT_SAVED_YET = 'Thanks - but feedback is not being saved yet. The person who runs Lyra has been told.';
const SAVE_FAILED = 'That could not be saved - try again in a minute.';

/** A tap on 👍 / 👎, a reason or "change". Always answers the tap so the spinner stops. */
async function handleFeedbackTap(query: CallbackQuery, nowMs: number): Promise<void> {
  const chatId = query.message ? String(query.message.chat.id) : String(query.from.id);
  const action = parseFeedbackData(query.data);
  if (!action || !allowMessage(chatId, nowMs)) {
    await answerCallbackQuery(query.id);
    console.info(JSON.stringify({ at: 'telegram.webhook', event: 'callback_ignored', reason: action ? 'rate_limited' : 'unknown_data' }));
    return;
  }

  let outcome: FeedbackOutcome | 'not_written' | 'no_database' = 'not_written';
  if (action.kind !== 'change') {
    const client = createSupabaseServiceClient();
    if (!client) {
      outcome = 'no_database';
    } else {
      try {
        const reader = await readerForChat(client, chatId);
        outcome = await recordFeedback(client, {
          generationId: action.generationId,
          reader,
          rating: action.rating,
          // A new rating clears a reason given for the old one; a reason (or Skip) sets it.
          pillar: action.kind === 'reason' ? action.pillar : null,
          telegramMessageId: query.message?.message_id ?? null,
          now: new Date(nowMs),
        });
      } catch {
        outcome = 'error';
      }
    }
  }

  const step = nextStep(action);
  const failed = outcome === 'error' || outcome === 'table_missing' || outcome === 'no_database';
  await answerCallbackQuery(query.id, outcome === 'error' ? SAVE_FAILED : failed ? NOT_SAVED_YET : step.toast || undefined);
  // The buttons move on only when the tap was kept, so a reader can try again after a failure.
  if (query.message && !failed) await editMessageReplyMarkup(chatId, query.message.message_id, step.keyboard);
  console.info(
    JSON.stringify({
      at: 'telegram.webhook',
      event: 'feedback',
      step: action.kind,
      rating: action.kind === 'change' ? null : action.rating,
      pillar: action.kind === 'reason' ? action.pillar : null,
      outcome,
    }),
  );
}

/** A plain-text reply to a Lyra message: kept as a note on the generation the message came from. */
async function noteReply(
  text: string,
  repliedTo: NonNullable<NonNullable<TelegramUpdate['message']>['reply_to_message']>,
  ctx: ReplyContext,
): Promise<string> {
  const generationId = generationFromMarkup(repliedTo.reply_markup);
  if (!generationId) {
    return 'Thanks. To rate a message from Lyra, tap 👍 or 👎 under it - replies are kept for the messages that carry those buttons. Send /help for commands.';
  }
  if (!ctx.client) return NO_DATABASE;
  const reader = await readerForChat(ctx.client, ctx.chatId);
  const outcome = await recordFeedback(ctx.client, { generationId, reader, note: text, telegramMessageId: repliedTo.message_id, now: ctx.now });
  console.info(JSON.stringify({ at: 'telegram.webhook', event: 'feedback_note', outcome }));
  if (outcome === 'recorded') return NOTE_REPLY;
  return outcome === 'table_missing' ? NOT_SAVED_YET : SAVE_FAILED;
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

  // 4. A button tap (the feedback buttons) is answered and recorded, then done. Any failure inside
  //    is still a 200: Telegram retries non-2xx, and a retried tap would only double-answer.
  if (update.callback_query) {
    try {
      await handleFeedbackTap(update.callback_query, Date.now());
    } catch (err) {
      console.warn(JSON.stringify({ at: 'telegram.webhook', event: 'callback_error', error: err instanceof Error ? err.name : 'unknown' }));
    }
    return NextResponse.json({ ok: true });
  }

  // Only text messages are actionable beyond that (setWebhook restricts allowed_updates to
  // "message" and "callback_query", but defend in depth anyway).
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
  //    only - never the raw text or a /start argument, which are untrusted user input.
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
  //    suppressed by the sender's idempotency dedupe instead of double-replying. A
  //    database error must never turn into a non-2xx (Telegram would retry it for ever).
  let reply: string;
  try {
    const ctx: ReplyContext = { client: createSupabaseServiceClient(), chatId, base: appBaseUrl(request), now: new Date(nowMs) };
    // Free text sent as a reply to one of the bot's messages is feedback on that message. A command
    // - /stop, a bare STOP, anything the parser knows - is always handled as the command.
    const repliedTo = message.reply_to_message;
    const isFreeText = parsed.kind === 'command' && parsed.command === 'unknown' && !text.trim().startsWith('/');
    reply = isFreeText && repliedTo?.from?.is_bot ? await noteReply(text, repliedTo, ctx) : await buildReply(parsed, ctx);
  } catch (err) {
    console.warn(JSON.stringify({ at: 'telegram.webhook', event: 'reply_error', error: err instanceof Error ? err.name : 'unknown' }));
    reply = 'Something went wrong on our side - try again in a minute.';
  }
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
