/**
 * Reader feedback store - SERVER-ONLY, always through the service-role client. [v0.137.0]
 *
 * `content_feedback` (migration 060) has RLS on and no policies: only the Telegram webhook writes
 * it and only the review reads it. One row per reader per generation (unique on generation_id +
 * reader_ref), so a reader who taps 👎 and then a reason, or changes their mind, updates their row;
 * a reply to the message fills the same row's note.
 *
 * Who the reader is comes from the chat, never from the callback data: an active subscriber row for
 * the chat ('sub:<id>'), else an account the chat is paired to ('user:<id>'), else the chat itself,
 * stored as a hash ('chat:<16 hex>') - a raw chat id is never written here.
 */
import { createHash } from 'node:crypto';
import { pairedUserForChat } from '@/lib/notifications/telegram-pairing';
import { isMissingTable, type SupabaseLike } from '@/lib/subscribe-store';
import { MAX_NOTE_CHARS, type Pillar, type Rating } from './telegram-feedback';

export type ReaderKind = 'subscriber' | 'account' | 'chat';

export interface Reader {
  kind: ReaderKind;
  ref: string;
  userId: string | null;
  subscriberId: string | null;
}

export type FeedbackOutcome = 'recorded' | 'table_missing' | 'error';

const TABLE = 'content_feedback';

export function chatRef(chatId: string): string {
  return `chat:${createHash('sha256').update(chatId).digest('hex').slice(0, 16)}`;
}

export async function readerForChat(client: SupabaseLike, chatId: string): Promise<Reader> {
  const { data: subscriber } = await client
    .from('briefing_subscribers')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  const subscriberId = (subscriber as { id?: string } | null)?.id;
  if (subscriberId) return { kind: 'subscriber', ref: `sub:${subscriberId}`, userId: null, subscriberId };
  const userId = await pairedUserForChat(client, chatId);
  if (userId) return { kind: 'account', ref: `user:${userId}`, userId, subscriberId: null };
  return { kind: 'chat', ref: chatRef(chatId), userId: null, subscriberId: null };
}

export interface FeedbackInput {
  generationId: string;
  reader: Reader;
  /** Leave undefined to keep what is stored; null clears it. */
  rating?: Rating | null;
  pillar?: Pillar | null;
  note?: string | null;
  telegramMessageId?: number | null;
  now?: Date;
}

/** Upsert the reader's row for the generation. Only the fields given are written; never throws. */
export async function recordFeedback(client: SupabaseLike, input: FeedbackInput): Promise<FeedbackOutcome> {
  const row: Record<string, unknown> = {
    generation_id: input.generationId,
    reader_ref: input.reader.ref,
    reader_kind: input.reader.kind,
    user_id: input.reader.userId,
    subscriber_id: input.reader.subscriberId,
    channel: 'telegram',
    updated_at: (input.now ?? new Date()).toISOString(),
  };
  if (input.rating !== undefined) row.rating = input.rating;
  if (input.pillar !== undefined) row.pillar = input.pillar;
  if (input.note !== undefined) row.note = input.note === null ? null : input.note.trim().slice(0, MAX_NOTE_CHARS);
  if (input.telegramMessageId != null) row.telegram_message_id = input.telegramMessageId;
  try {
    const { error } = await client.from(TABLE).upsert(row, { onConflict: 'generation_id,reader_ref' });
    if (!error) return 'recorded';
    return isMissingTable(error) ? 'table_missing' : 'error';
  } catch {
    return 'error';
  }
}
