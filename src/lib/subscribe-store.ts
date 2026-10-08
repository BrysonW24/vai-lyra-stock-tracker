/**
 * The subscribe-by-link store - SERVER-ONLY, always through the service-role client.
 *
 * `briefing_subscribers` (migration 059) has RLS on and no policies: nobody but the API routes,
 * the Telegram webhook and the worker ever reads it, and each of them scopes every query to one
 * row by id, token or chat id. The functions take the client as a parameter so the unit tests can
 * hand in a small fake (the same convention as notifications/dispatch.ts).
 *
 * State machine per row: pending -> active (the /start webhook learns the chat id, or the email
 * confirmation link is opened) -> unsubscribed (STOP, the link, a blocked bot, or 'replaced' when
 * the same chat / inbox subscribes again). Nothing is ever deleted; a row is the audit trail.
 */
import type { SubscribeChannel, SubscribeTopic } from './subscribe';

export type SupabaseLike = {
  // Only `.from()` is required of the injected client; the builder chain stays `any` on purpose so
  // unit tests can hand in a tiny fake without recreating supabase-js generics.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed';

export interface SubscriberRow {
  id: string;
  token: string;
  channel: SubscribeChannel;
  email: string | null;
  telegram_chat_id: string | null;
  topics: string[];
  holdings: string[];
  status: SubscriberStatus;
  created_at?: string | null;
}

const TABLE = 'briefing_subscribers';
export const SUBSCRIBER_COLUMNS = 'id, token, channel, email, telegram_chat_id, topics, holdings, status, created_at';

interface DbError {
  code?: string;
  message?: string;
}

/** PostgREST answers PGRST205 (not in the schema cache) or Postgres 42P01 when migration 059 has not been applied yet. */
export function isMissingTable(error: DbError | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '');
}

export interface NewSubscriber {
  token: string;
  channel: SubscribeChannel;
  email?: string | null;
  topics: SubscribeTopic[];
  holdings: string[];
  userId?: string | null;
  source?: string | null;
}

export type StoreFailure = { error: 'table_missing' | 'db'; message: string };

export async function createSubscriber(client: SupabaseLike, input: NewSubscriber): Promise<{ row: SubscriberRow } | StoreFailure> {
  const { data, error } = await client
    .from(TABLE)
    .insert({
      token: input.token,
      channel: input.channel,
      email: input.channel === 'email' ? (input.email || '').trim().toLowerCase() || null : null,
      topics: input.topics,
      holdings: input.holdings,
      status: 'pending',
      user_id: input.userId || null,
      source: input.source?.slice(0, 120) || null,
    })
    .select(SUBSCRIBER_COLUMNS)
    .single();
  if (error || !data) {
    const failure: DbError = error || {};
    return { error: isMissingTable(failure) ? 'table_missing' : 'db', message: failure.message || 'insert failed' };
  }
  return { row: data as SubscriberRow };
}

export async function findByToken(client: SupabaseLike, token: string): Promise<SubscriberRow | null> {
  if (!token) return null;
  const { data } = await client.from(TABLE).select(SUBSCRIBER_COLUMNS).eq('token', token).maybeSingle();
  return (data as SubscriberRow | null) || null;
}

export async function findById(client: SupabaseLike, id: string): Promise<SubscriberRow | null> {
  if (!id) return null;
  const { data } = await client.from(TABLE).select(SUBSCRIBER_COLUMNS).eq('id', id).maybeSingle();
  return (data as SubscriberRow | null) || null;
}

export type ActivationOutcome = 'activated' | 'already' | 'unknown' | 'error';

/** One live subscription per chat / inbox: any other active row for the same destination is superseded first. */
async function supersede(client: SupabaseLike, column: 'telegram_chat_id' | 'email', destination: string, keepId: string, now: string): Promise<void> {
  await client
    .from(TABLE)
    .update({ status: 'unsubscribed', unsubscribe_reason: 'replaced', unsubscribed_at: now, updated_at: now })
    .eq(column, destination)
    .eq('status', 'active')
    .neq('id', keepId);
}

/**
 * The bot received `/start s<token>` from `chatId`: that chat now owns the subscription. Telegram
 * delivering the update IS the proof of ownership - the chat id is never typed by anyone.
 */
export async function activateTelegramSubscriber(client: SupabaseLike, token: string, chatId: string, now: Date = new Date()): Promise<ActivationOutcome> {
  const row = await findByToken(client, token);
  if (!row || row.channel !== 'telegram') return 'unknown';
  if (row.status === 'active' && row.telegram_chat_id === chatId) return 'already';
  const stamp = now.toISOString();
  await supersede(client, 'telegram_chat_id', chatId, row.id, stamp);
  const { error } = await client
    .from(TABLE)
    .update({ telegram_chat_id: chatId, status: 'active', confirmed_at: stamp, unsubscribed_at: null, unsubscribe_reason: null, updated_at: stamp })
    .eq('id', row.id);
  return error ? 'error' : 'activated';
}

/** The confirmation link was opened: the inbox is proven. */
export async function confirmEmailSubscriber(client: SupabaseLike, id: string, now: Date = new Date()): Promise<ActivationOutcome> {
  const row = await findById(client, id);
  if (!row || row.channel !== 'email' || !row.email) return 'unknown';
  if (row.status === 'active') return 'already';
  const stamp = now.toISOString();
  await supersede(client, 'email', row.email, row.id, stamp);
  const { error } = await client
    .from(TABLE)
    .update({ status: 'active', confirmed_at: stamp, unsubscribed_at: null, unsubscribe_reason: null, updated_at: stamp })
    .eq('id', row.id);
  return error ? 'error' : 'activated';
}

export type UnsubscribeOutcome = 'done' | 'unknown' | 'error';

export async function unsubscribeById(client: SupabaseLike, id: string, reason: string, now: Date = new Date()): Promise<UnsubscribeOutcome> {
  const row = await findById(client, id);
  if (!row) return 'unknown';
  if (row.status === 'unsubscribed') return 'done';
  const stamp = now.toISOString();
  const { error } = await client
    .from(TABLE)
    .update({ status: 'unsubscribed', unsubscribe_reason: reason, unsubscribed_at: stamp, updated_at: stamp })
    .eq('id', row.id);
  return error ? 'error' : 'done';
}

/** STOP from a chat ends every live subscription that chat holds. Returns how many it ended. */
export async function unsubscribeChat(client: SupabaseLike, chatId: string, reason: string, now: Date = new Date()): Promise<number> {
  const stamp = now.toISOString();
  const { data } = await client
    .from(TABLE)
    .update({ status: 'unsubscribed', unsubscribe_reason: reason, unsubscribed_at: stamp, updated_at: stamp })
    .eq('telegram_chat_id', chatId)
    .eq('status', 'active')
    .select('id');
  return Array.isArray(data) ? data.length : 0;
}

export async function activeChatSubscription(client: SupabaseLike, chatId: string): Promise<SubscriberRow | null> {
  const { data } = await client.from(TABLE).select(SUBSCRIBER_COLUMNS).eq('telegram_chat_id', chatId).eq('status', 'active').limit(1).maybeSingle();
  return (data as SubscriberRow | null) || null;
}
