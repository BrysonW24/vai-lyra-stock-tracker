/**
 * The webhook offers every update to the circle first (v0.144.0). With no shared store the circle is
 * off: its buttons and links say so, and everything else reaches the route's own commands unchanged.
 */
import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const SAVED = { ...process.env };
afterAll(() => {
  for (const key of ['TELEGRAM_WEBHOOK_SECRET', 'CIRCLE_INVITE_CODE', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) {
    if (SAVED[key] === undefined) delete process.env[key];
    else process.env[key] = SAVED[key];
  }
});

const hoisted = vi.hoisted(() => ({
  toasts: [] as Array<[string, string | undefined]>,
  sent: [] as Array<[string, string]>,
}));

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: () => null, getSessionUser: async () => null }));

vi.mock('@/lib/notifications/telegram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notifications/telegram')>()),
  answerCallbackQuery: async (id: string, text?: string) => {
    hoisted.toasts.push([id, text]);
    return { ok: true };
  },
  editMessageReplyMarkup: async () => ({ ok: true }),
  sendChatAction: async () => ({ ok: true }),
  sendTelegramMessage: async (chatId: string, text: string) => {
    hoisted.sent.push([chatId, text]);
    return { status: 'sent' };
  },
}));

import { POST } from '../route';

const SECRET = 'test-webhook-secret';
let updateId = 5000;

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

describe('telegram webhook - the circle when it is off', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    process.env.CIRCLE_INVITE_CODE = 'invite-code-123456';
    hoisted.toasts.length = 0;
    hoisted.sent.length = 0;
  });

  it('answers a circle button and says the circle is not on, without touching the feedback flow', async () => {
    const res = await post({ callback_query: { id: 'q1', from: { id: 7 }, data: 'cl:r:m20261118:u', message: { message_id: 3, chat: { id: 7 } } } });
    expect(res.status).toBe(200);
    expect(hoisted.toasts).toEqual([['q1', "Lyra's circle isn't switched on here yet."]]);
  });

  it('answers a circle invite link honestly when there is no shared store', async () => {
    await post({ message: { message_id: 1, text: '/start cinvite-code-123456', chat: { id: 7, type: 'private' }, from: { id: 7, first_name: 'Sam' } } });
    expect(hoisted.sent).toEqual([['7', "Lyra's circle isn't switched on here yet."]]);
  });

  it('leaves the route\'s own commands exactly as they were', async () => {
    await post({ message: { message_id: 2, text: 'what is going on with chips?', chat: { id: 8, type: 'private' }, from: { id: 8 } } });
    expect(hoisted.sent[0]![1]).toContain('Unknown command');
  });
});
