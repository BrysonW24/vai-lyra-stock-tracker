/**
 * Telegram pairing for ACCOUNTS - SERVER-ONLY: "Connect Telegram" in Settings > Notifications.
 *
 * Replaces the chat-id dance (find @userinfobot, copy a number, paste it, save, send /start, save
 * again) that not one of the four production accounts completed. The app mints a one-time code,
 * stores only its hash in channel_pairing_codes (migration 020, 10-minute expiry), and hands the
 * browser a `t.me/<bot>?start=p<code>` link. Tapping it makes Telegram send `/start p<code>` from
 * the person's own chat; the webhook hashes the code, matches the unused unexpired row, and writes
 * the chat id into notification_channels as a VERIFIED channel - verified because the update came
 * from that chat, which is stronger proof than a probe message landing.
 *
 * Functions take the client as a parameter (service role in production) so the unit tests use a
 * small fake, the same convention as subscribe-store.ts and notifications/dispatch.ts.
 */
import { buildPairingCode, hashPairingCode } from './telegram';
import type { SupabaseLike } from '@/lib/subscribe-store';

/** Long enough that the link, not the clock, is the security: 31^20 possibilities, never typed. */
export const PAIRING_TOKEN_LENGTH = 20;
export const PAIRING_CHANNEL_LABEL = 'Telegram (connected from the app)';

export interface PairingStart {
  /** Plaintext code for the deep link - shown to the owner once, never stored. */
  code: string;
  expiresAt: string;
}

export async function startTelegramPairing(client: SupabaseLike, userId: string, now: Date = new Date()): Promise<PairingStart | { error: string }> {
  const pairing = buildPairingCode(now, PAIRING_TOKEN_LENGTH);
  const { error } = await client
    .from('channel_pairing_codes')
    .insert({ user_id: userId, channel_type: 'telegram', code_hash: pairing.codeHash, expires_at: pairing.expiresAt });
  if (error) return { error: (error as { message?: string }).message || 'could not store the pairing code' };
  return { code: pairing.code, expiresAt: pairing.expiresAt };
}

export type PairingOutcome = 'paired' | 'invalid' | 'expired' | 'error';

interface PairingRow {
  id: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
}

/** `/start p<code>` arrived from `chatId`: link the chat to the code's owner as a verified channel. */
export async function completeTelegramPairing(
  client: SupabaseLike,
  code: string,
  chatId: string,
  now: Date = new Date(),
): Promise<{ outcome: PairingOutcome; userId?: string }> {
  if (!code.trim()) return { outcome: 'invalid' };
  const { data } = await client
    .from('channel_pairing_codes')
    .select('id, user_id, expires_at, used_at')
    .eq('code_hash', hashPairingCode(code))
    .eq('channel_type', 'telegram')
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as PairingRow | null;
  if (!row) return { outcome: 'invalid' };
  if (new Date(row.expires_at).getTime() < now.getTime()) return { outcome: 'expired' };

  const stamp = now.toISOString();
  // One active Telegram channel per account: whatever was saved by hand before is retired.
  await client.from('notification_channels').update({ is_active: false, updated_at: stamp }).eq('user_id', row.user_id).eq('channel_type', 'telegram').neq('destination', chatId);
  const { error } = await client.from('notification_channels').upsert(
    {
      user_id: row.user_id,
      channel_type: 'telegram',
      destination: chatId,
      channel_label: PAIRING_CHANNEL_LABEL,
      is_active: true,
      is_verified: true,
      verified_at: stamp,
      updated_at: stamp,
    },
    { onConflict: 'user_id,channel_type,destination' },
  );
  if (error) return { outcome: 'error' };
  await client.from('user_alert_preferences').upsert({ user_id: row.user_id, telegram_enabled: true, updated_at: stamp }, { onConflict: 'user_id' });
  await client.from('channel_pairing_codes').update({ used_at: stamp }).eq('id', row.id);
  return { outcome: 'paired', userId: row.user_id };
}

/** The account a chat is connected to, if any (an active Telegram channel row with that chat id). */
export async function pairedUserForChat(client: SupabaseLike, chatId: string): Promise<string | null> {
  const { data } = await client
    .from('notification_channels')
    .select('user_id')
    .eq('channel_type', 'telegram')
    .eq('destination', chatId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  const row = data as { user_id?: string } | null;
  return row?.user_id || null;
}

/** STOP from a paired chat: retire the channel and switch the preference off, so nothing else is sent there. */
export async function disconnectChat(client: SupabaseLike, chatId: string, now: Date = new Date()): Promise<string | null> {
  const userId = await pairedUserForChat(client, chatId);
  if (!userId) return null;
  const stamp = now.toISOString();
  await client.from('notification_channels').update({ is_active: false, updated_at: stamp }).eq('channel_type', 'telegram').eq('destination', chatId);
  await client.from('user_alert_preferences').upsert({ user_id: userId, telegram_enabled: false, updated_at: stamp }, { onConflict: 'user_id' });
  return userId;
}
