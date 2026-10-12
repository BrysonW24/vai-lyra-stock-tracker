/**
 * The webhook's feedback paths (v0.137.0): a tap on 👍 / 👎 or a reason is recorded against the
 * generation its data names and the buttons move on; a reply to a Lyra message is kept as a note;
 * a command - a replied STOP above all - is never swallowed as feedback.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSupabase, type Answer, type Call } from '@/lib/__tests__/fake-supabase';
import { notedKeyboard, reasonKeyboard, voteKeyboard } from '@/lib/feedback/telegram-feedback';

const hoisted = vi.hoisted(() => ({
  answer: (_call: unknown) => ({ data: null }) as unknown,
  calls: [] as unknown[],
  toasts: [] as Array<[string, string | undefined]>,
  edits: [] as Array<[string, number, unknown]>,
  sent: [] as Array<[string, string]>,
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceClient: () => {
    const db = fakeSupabase((call) => hoisted.answer(call) as Answer);
    hoisted.calls = db.calls;
    return db.client;
  },
  getSessionUser: async () => null,
}));

vi.mock('@/lib/notifications/telegram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notifications/telegram')>()),
  answerCallbackQuery: async (id: string, text?: string) => {
    hoisted.toasts.push([id, text]);
    return { ok: true };
  },
  editMessageReplyMarkup: async (chatId: string, messageId: number, markup: unknown) => {
    hoisted.edits.push([chatId, messageId, markup]);
    return { ok: true };
  },
  sendTelegramMessage: async (chatId: string, text: string) => {
    hoisted.sent.push([chatId, text]);
    return { status: 'sent' };
  },
}));

import { POST } from '../route';

const ID = '0b8f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4';
const SECRET = 'test-webhook-secret';
let updateId = 1000;

function post(body: Record<string, unknown>): Promise<Response> {
  updateId += 1;
  return POST(
    new NextRequest('https://lyra.example/api/webhooks/telegram', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': SECRET },
      body: JSON.stringify({ update_id: updateId, ...body }),
    }),
  );
}

function tap(data: string, chatId = 777) {
  return post({ callback_query: { id: `cb-${updateId}`, from: { id: chatId }, data, message: { message_id: 55, chat: { id: chatId } } } });
}

const feedbackWrites = () => (hoisted.calls as Call[]).filter((call) => call.table === 'content_feedback');

describe('telegram webhook feedback', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
    hoisted.answer = (call) => ((call as Call).table === 'briefing_subscribers' && (call as Call).op === 'select' ? { data: { id: 'sub-1' } } : { data: null });
    hoisted.calls = [];
    hoisted.toasts = [];
    hoisted.edits = [];
    hoisted.sent = [];
  });
  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  it('records a 👎 against the generation and offers the reasons', async () => {
    const res = await tap(`fb:${ID}:d`);
    expect(res.status).toBe(200);
    expect(feedbackWrites()[0]).toMatchObject({ op: 'upsert', payload: { generation_id: ID, reader_ref: 'sub:sub-1', rating: 'down', pillar: null, telegram_message_id: 55 } });
    expect(hoisted.toasts.at(-1)?.[1]).toBe('Thanks. What fell short?');
    expect(hoisted.edits).toEqual([['777', 55, reasonKeyboard(ID, 'down')]]);
  });

  it('records the reason and leaves a noted button; change goes back to the vote without writing', async () => {
    await tap(`fb:${ID}:d:cla`);
    expect(feedbackWrites()[0]).toMatchObject({ payload: { rating: 'down', pillar: 'clarity' } });
    expect(hoisted.toasts.at(-1)?.[1]).toBe('Thanks - noted.');
    expect(hoisted.edits.at(-1)?.[2]).toEqual(notedKeyboard(ID));

    hoisted.calls = [];
    await tap(`fb:${ID}:c`);
    expect(feedbackWrites()).toEqual([]);
    expect(hoisted.edits.at(-1)?.[2]).toEqual(voteKeyboard(ID));
  });

  it('says honestly when feedback cannot be saved yet, and keeps the buttons so the reader can retry', async () => {
    hoisted.answer = (call) =>
      (call as Call).table === 'content_feedback' ? { error: { code: 'PGRST205', message: 'schema cache' } } : { data: null };
    await tap(`fb:${ID}:u`);
    expect(hoisted.toasts.at(-1)?.[1]).toMatch(/not being saved yet/);
    expect(hoisted.edits).toEqual([]);
  });

  it('stops the spinner on data it does not know and touches nothing', async () => {
    await tap('something:else');
    expect(hoisted.toasts.at(-1)).toEqual([expect.any(String), undefined]);
    expect(hoisted.calls).toEqual([]);
    expect(hoisted.edits).toEqual([]);
  });

  it('keeps a reply to a Lyra message as a note on its generation', async () => {
    await post({
      message: {
        message_id: 90,
        text: 'too many numbers in the setups bit',
        chat: { id: 777 },
        from: { id: 777 },
        reply_to_message: { message_id: 55, from: { id: 1, is_bot: true }, reply_markup: notedKeyboard(ID) },
      },
    });
    expect(feedbackWrites()[0]).toMatchObject({ payload: { generation_id: ID, note: 'too many numbers in the setups bit', telegram_message_id: 55 } });
    expect(hoisted.sent.at(-1)?.[1]).toMatch(/^Thanks - noted\./);
  });

  it('never swallows a command: STOP sent as a reply still unsubscribes', async () => {
    hoisted.answer = () => ({ data: [{ id: 'sub-1' }] });
    await post({
      message: { message_id: 91, text: 'STOP', chat: { id: 777 }, from: { id: 777 }, reply_to_message: { message_id: 55, from: { id: 1, is_bot: true }, reply_markup: voteKeyboard(ID) } },
    });
    expect(feedbackWrites()).toEqual([]);
    expect((hoisted.calls as Call[]).some((call) => call.table === 'briefing_subscribers' && call.op === 'update')).toBe(true);
    expect(hoisted.sent.at(-1)?.[1]).toMatch(/subscription has ended/);
  });

  it('still refuses an update without the secret', async () => {
    const res = await POST(
      new NextRequest('https://lyra.example/api/webhooks/telegram', { method: 'POST', body: JSON.stringify({ update_id: 1, callback_query: { id: 'x', from: { id: 1 }, data: `fb:${ID}:u` } }) }),
    );
    expect(res.status).toBe(401);
    expect(hoisted.toasts).toEqual([]);
  });
});
