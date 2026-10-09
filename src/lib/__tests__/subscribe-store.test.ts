import { describe, expect, it } from 'vitest';
import { fakeSupabase, type Call } from './fake-supabase';
import {
  activateTelegramSubscriber,
  confirmEmailSubscriber,
  createSubscriber,
  isMissingTable,
  unsubscribeById,
  unsubscribeChat,
  type SubscriberRow,
} from '../subscribe-store';

const NOW = new Date('2026-10-08T09:00:00Z');

function row(overrides: Partial<SubscriberRow> = {}): SubscriberRow {
  return { id: 'sub-1', token: 'tok', channel: 'telegram', email: null, telegram_chat_id: null, topics: [], holdings: ['NVDA'], status: 'pending', ...overrides };
}

const writes = (calls: Call[]) => calls.filter((call) => call.op !== 'select');

describe('subscriber store', () => {
  it('knows an unapplied migration from any other failure', () => {
    expect(isMissingTable({ code: 'PGRST205', message: "Could not find the table 'public.briefing_subscribers' in the schema cache" })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: '23505', message: 'duplicate key value' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });

  it('creates a pending row and reports a missing table honestly', async () => {
    const ok = fakeSupabase(() => ({ data: row() }));
    const created = await createSubscriber(ok.client, { token: 'tok', channel: 'email', email: ' Friend@Example.com ', topics: ['agi-infrastructure'], holdings: ['NVDA'], userId: null, source: 'subscribe-page' });
    expect('row' in created && created.row.id).toBe('sub-1');
    expect(ok.calls[0]).toMatchObject({ table: 'briefing_subscribers', op: 'insert', payload: { token: 'tok', channel: 'email', email: 'friend@example.com', status: 'pending', topics: ['agi-infrastructure'], holdings: ['NVDA'], user_id: null, source: 'subscribe-page' } });

    const missing = fakeSupabase(() => ({ error: { code: 'PGRST205', message: 'schema cache' } }));
    expect(await createSubscriber(missing.client, { token: 't', channel: 'telegram', topics: [], holdings: [] })).toEqual({ error: 'table_missing', message: 'schema cache' });
  });

  it('activates a Telegram subscriber from /start, superseding any other live row for that chat', async () => {
    const db = fakeSupabase((call) => (call.op === 'select' ? { data: row() } : { data: [] }));
    expect(await activateTelegramSubscriber(db.client, 'tok', '777', NOW)).toBe('activated');
    const [supersede, activate] = writes(db.calls);
    expect(supersede).toMatchObject({ op: 'update', payload: { status: 'unsubscribed', unsubscribe_reason: 'replaced' }, filters: [['eq', 'telegram_chat_id', '777'], ['eq', 'status', 'active'], ['neq', 'id', 'sub-1']] });
    expect(activate).toMatchObject({ op: 'update', payload: { telegram_chat_id: '777', status: 'active', confirmed_at: NOW.toISOString(), unsubscribed_at: null }, filters: [['eq', 'id', 'sub-1']] });

    const already = fakeSupabase(() => ({ data: row({ status: 'active', telegram_chat_id: '777' }) }));
    expect(await activateTelegramSubscriber(already.client, 'tok', '777', NOW)).toBe('already');
    expect(writes(already.calls)).toEqual([]);

    const unknown = fakeSupabase(() => ({ data: null }));
    expect(await activateTelegramSubscriber(unknown.client, 'nope', '777', NOW)).toBe('unknown');
    const wrongChannel = fakeSupabase(() => ({ data: row({ channel: 'email', email: 'a@b.co' }) }));
    expect(await activateTelegramSubscriber(wrongChannel.client, 'tok', '777', NOW)).toBe('unknown');
  });

  it('confirms an email subscriber from the signed link', async () => {
    const db = fakeSupabase((call) => (call.op === 'select' ? { data: row({ channel: 'email', email: 'friend@example.com' }) } : { data: [] }));
    expect(await confirmEmailSubscriber(db.client, 'sub-1', NOW)).toBe('activated');
    const [supersede, activate] = writes(db.calls);
    expect(supersede.filters).toEqual([['eq', 'email', 'friend@example.com'], ['eq', 'status', 'active'], ['neq', 'id', 'sub-1']]);
    expect(activate).toMatchObject({ payload: { status: 'active' }, filters: [['eq', 'id', 'sub-1']] });
    const telegramRow = fakeSupabase(() => ({ data: row() }));
    expect(await confirmEmailSubscriber(telegramRow.client, 'sub-1', NOW)).toBe('unknown');
  });

  it('ends subscriptions by link and by STOP, idempotently', async () => {
    const db = fakeSupabase((call) => (call.op === 'select' ? { data: row({ status: 'active', channel: 'email', email: 'a@b.co' }) } : { data: [] }));
    expect(await unsubscribeById(db.client, 'sub-1', 'link', NOW)).toBe('done');
    expect(writes(db.calls)[0]).toMatchObject({ payload: { status: 'unsubscribed', unsubscribe_reason: 'link', unsubscribed_at: NOW.toISOString() } });
    const done = fakeSupabase(() => ({ data: row({ status: 'unsubscribed' }) }));
    expect(await unsubscribeById(done.client, 'sub-1', 'link', NOW)).toBe('done');
    expect(writes(done.calls)).toEqual([]);
    const gone = fakeSupabase(() => ({ data: null }));
    expect(await unsubscribeById(gone.client, 'sub-1', 'link', NOW)).toBe('unknown');

    const chat = fakeSupabase(() => ({ data: [{ id: 'sub-1' }, { id: 'sub-9' }] }));
    expect(await unsubscribeChat(chat.client, '777', 'stop', NOW)).toBe(2);
    expect(chat.calls[0]).toMatchObject({ op: 'update', payload: { status: 'unsubscribed', unsubscribe_reason: 'stop' }, filters: [['eq', 'telegram_chat_id', '777'], ['eq', 'status', 'active']], columns: 'id' });
  });
});
