import { describe, expect, it } from 'vitest';
import { fakeSupabase, type Call } from '@/lib/__tests__/fake-supabase';
import { hashPairingCode } from '../telegram';
import { PAIRING_CHANNEL_LABEL, PAIRING_TOKEN_LENGTH, completeTelegramPairing, disconnectChat, pairedUserForChat, startTelegramPairing } from '../telegram-pairing';

const NOW = new Date('2026-10-08T09:00:00Z');
const writes = (calls: Call[]) => calls.filter((call) => call.op !== 'select');

describe('Telegram account pairing by deep link', () => {
  it('stores only the hash of a long one-time code with a ten-minute expiry', async () => {
    const db = fakeSupabase(() => ({ data: null }));
    const started = await startTelegramPairing(db.client, 'user-1', NOW);
    if ('error' in started) throw new Error(started.error);
    expect(started.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{20}$/);
    expect(started.code).toHaveLength(PAIRING_TOKEN_LENGTH);
    expect(started.expiresAt).toBe('2026-10-08T09:10:00.000Z');
    expect(db.calls[0]).toMatchObject({ table: 'channel_pairing_codes', op: 'insert', payload: { user_id: 'user-1', channel_type: 'telegram', code_hash: hashPairingCode(started.code), expires_at: started.expiresAt } });
    expect(JSON.stringify(db.calls[0].payload)).not.toContain(started.code);
  });

  it('completes a pairing by writing the chat as a VERIFIED channel and switching the preference on', async () => {
    const db = fakeSupabase((call) =>
      call.table === 'channel_pairing_codes' && call.op === 'select'
        ? { data: { id: 'code-1', user_id: 'user-1', expires_at: '2026-10-08T09:10:00.000Z', used_at: null } }
        : { data: null },
    );
    expect(await completeTelegramPairing(db.client, 'ABCDEFGHJKMNPQRSTUVW', '777', NOW)).toEqual({ outcome: 'paired', userId: 'user-1' });
    expect(db.calls[0].filters).toEqual([['eq', 'code_hash', hashPairingCode('ABCDEFGHJKMNPQRSTUVW')], ['eq', 'channel_type', 'telegram'], ['is', 'used_at', null]]);
    const [retire, channel, prefs, used] = writes(db.calls);
    expect(retire).toMatchObject({ table: 'notification_channels', op: 'update', payload: { is_active: false }, filters: [['eq', 'user_id', 'user-1'], ['eq', 'channel_type', 'telegram'], ['neq', 'destination', '777']] });
    expect(channel).toMatchObject({
      table: 'notification_channels',
      op: 'upsert',
      payload: { user_id: 'user-1', channel_type: 'telegram', destination: '777', channel_label: PAIRING_CHANNEL_LABEL, is_active: true, is_verified: true, verified_at: NOW.toISOString() },
      options: { onConflict: 'user_id,channel_type,destination' },
    });
    expect(prefs).toMatchObject({ table: 'user_alert_preferences', op: 'upsert', payload: { user_id: 'user-1', telegram_enabled: true } });
    expect(used).toMatchObject({ table: 'channel_pairing_codes', op: 'update', payload: { used_at: NOW.toISOString() }, filters: [['eq', 'id', 'code-1']] });
  });

  it('refuses an expired or unknown code without writing anything', async () => {
    const expired = fakeSupabase(() => ({ data: { id: 'code-1', user_id: 'user-1', expires_at: '2026-10-08T08:59:59.000Z', used_at: null } }));
    expect(await completeTelegramPairing(expired.client, 'ABCDEFGHJKMNPQRSTUVW', '777', NOW)).toEqual({ outcome: 'expired' });
    expect(writes(expired.calls)).toEqual([]);
    const unknown = fakeSupabase(() => ({ data: null }));
    expect(await completeTelegramPairing(unknown.client, 'NOPE', '777', NOW)).toEqual({ outcome: 'invalid' });
    expect(await completeTelegramPairing(unknown.client, '', '777', NOW)).toEqual({ outcome: 'invalid' });
    expect(writes(unknown.calls)).toEqual([]);
  });

  it('finds the account behind a chat and disconnects it on STOP', async () => {
    const db = fakeSupabase((call) => (call.table === 'notification_channels' && call.op === 'select' ? { data: { user_id: 'user-1' } } : { data: null }));
    expect(await pairedUserForChat(db.client, '777')).toBe('user-1');
    expect(await disconnectChat(db.client, '777', NOW)).toBe('user-1');
    const [retire, prefs] = writes(db.calls);
    expect(retire).toMatchObject({ table: 'notification_channels', payload: { is_active: false }, filters: [['eq', 'channel_type', 'telegram'], ['eq', 'destination', '777']] });
    expect(prefs).toMatchObject({ table: 'user_alert_preferences', payload: { user_id: 'user-1', telegram_enabled: false } });
    const stranger = fakeSupabase(() => ({ data: null }));
    expect(await disconnectChat(stranger.client, '888', NOW)).toBeNull();
    expect(writes(stranger.calls)).toEqual([]);
  });
});
