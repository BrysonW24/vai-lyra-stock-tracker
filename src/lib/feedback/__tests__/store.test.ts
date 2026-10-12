import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fakeSupabase } from '@/lib/__tests__/fake-supabase';
import { chatRef, readerForChat, recordFeedback, type Reader } from '../store';

const ID = '0b8f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4';
const NOW = new Date('2026-10-13T10:00:00Z');

describe('feedback store', () => {
  it('knows a reader by their subscription, then their account, then only a hash of the chat', async () => {
    const subscriber = fakeSupabase((call) => (call.table === 'briefing_subscribers' ? { data: { id: 'sub-1' } } : { data: null }));
    expect(await readerForChat(subscriber.client, '777')).toEqual({ kind: 'subscriber', ref: 'sub:sub-1', userId: null, subscriberId: 'sub-1' });
    expect(subscriber.calls[0].filters).toEqual([['eq', 'telegram_chat_id', '777'], ['eq', 'status', 'active']]);

    const account = fakeSupabase((call) => (call.table === 'notification_channels' ? { data: { user_id: 'user-9' } } : { data: null }));
    expect(await readerForChat(account.client, '777')).toEqual({ kind: 'account', ref: 'user:user-9', userId: 'user-9', subscriberId: null });

    const stranger = fakeSupabase(() => ({ data: null }));
    const reader = await readerForChat(stranger.client, '777');
    expect(reader).toEqual({ kind: 'chat', ref: chatRef('777'), userId: null, subscriberId: null });
    expect(reader.ref).not.toContain('777');
    // Keyed: a chat id is a short number, so an unkeyed hash could be reversed by trying them all.
    const unkeyed = `chat:${createHash('sha256').update('777').digest('hex').slice(0, 16)}`;
    expect(chatRef('777', 'link-secret')).not.toBe(unkeyed);
    expect(chatRef('777', 'link-secret')).toBe(chatRef('777', 'link-secret'));
    expect(chatRef('777', 'other-secret')).not.toBe(chatRef('777', 'link-secret'));
    expect(chatRef('777', null)).toBe(unkeyed);
  });

  it('upserts one row per reader per generation, writing only the fields given', async () => {
    const reader: Reader = { kind: 'subscriber', ref: 'sub:sub-1', userId: null, subscriberId: 'sub-1' };
    const db = fakeSupabase(() => ({ data: null }));
    expect(await recordFeedback(db.client, { generationId: ID, reader, rating: 'down', pillar: null, telegramMessageId: 42, now: NOW })).toBe('recorded');
    expect(db.calls[0]).toMatchObject({
      table: 'content_feedback',
      op: 'upsert',
      options: { onConflict: 'generation_id,reader_ref' },
      payload: { generation_id: ID, reader_ref: 'sub:sub-1', reader_kind: 'subscriber', subscriber_id: 'sub-1', user_id: null, channel: 'telegram', rating: 'down', pillar: null, telegram_message_id: 42, updated_at: NOW.toISOString() },
    });

    await recordFeedback(db.client, { generationId: ID, reader, note: `  ${'x'.repeat(1200)}  `, now: NOW });
    const note = db.calls[1].payload as Record<string, unknown>;
    expect((note.note as string).length).toBe(1000);
    expect('rating' in note || 'pillar' in note).toBe(false);
  });

  it('says when migration 060 is missing, and never throws', async () => {
    const reader: Reader = { kind: 'chat', ref: 'chat:abc', userId: null, subscriberId: null };
    const missing = fakeSupabase(() => ({ error: { code: 'PGRST205', message: "Could not find the table 'public.content_feedback' in the schema cache" } }));
    expect(await recordFeedback(missing.client, { generationId: ID, reader, rating: 'up' })).toBe('table_missing');
    const broken = fakeSupabase(() => ({ error: { code: '23514', message: 'check constraint' } }));
    expect(await recordFeedback(broken.client, { generationId: ID, reader, rating: 'up' })).toBe('error');
    const throwing = { from: () => { throw new Error('network'); } };
    expect(await recordFeedback(throwing, { generationId: ID, reader, rating: 'up' })).toBe('error');
  });
});
