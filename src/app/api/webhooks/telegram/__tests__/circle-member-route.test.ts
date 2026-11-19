/**
 * A circle member's chat is not the circle's alone: the same bot sends the evening briefing and
 * account alerts, and each says "Reply STOP". Through the real route, with the circle's store backed
 * by an in-memory Redis: a member's STOP pauses their circle reads AND reaches the route's stop in one
 * reply; a subscribe link, a route command and a reply to a briefing's buttons reach the route; and a
 * flood of circle button taps is held to the same per-chat limit as messages.
 */
import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FakeRedis } from '@/lib/circle/__tests__/fake-redis';

const SAVED = { ...process.env };
afterAll(() => {
  for (const key of ['TELEGRAM_WEBHOOK_SECRET', 'CIRCLE_INVITE_CODE']) {
    if (SAVED[key] === undefined) delete process.env[key];
    else process.env[key] = SAVED[key];
  }
});

const hoisted = vi.hoisted(() => ({
  toasts: [] as Array<[string, string | undefined]>,
  sent: [] as Array<[string, string]>,
  fake: null as FakeRedis | null,
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

// The circle's store, on an in-memory Redis instead of Upstash.
vi.mock('@/lib/circle/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/circle/store')>();
  const { fakeRedis } = await import('@/lib/circle/__tests__/fake-redis');
  hoisted.fake = fakeRedis();
  class InMemoryStore extends actual.CircleStore {
    constructor() {
      super(hoisted.fake!.redis);
    }
  }
  return { ...actual, CircleStore: InMemoryStore };
});

// after() runs the deferred work at once in a test.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (work: () => Promise<void>) => void work(),
}));

import { CircleStore } from '@/lib/circle/store';
import { POST } from '../route';

const SECRET = 'test-webhook-secret';
let updateId = 9000;

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

const privateMessage = (chatId: number, text: string, extra: Record<string, unknown> = {}) => ({ message: { message_id: updateId, text, chat: { id: chatId, type: 'private' }, from: { id: chatId, first_name: 'Sam' }, ...extra } });

async function seedMember(chatId: string) {
  await new CircleStore().saveMember({ chatId, name: 'Sam', role: 'member', joinedAt: '2026-11-17T00:00:00.000Z', topics: [], holdings: [], reads: { morning: true, evening: true }, paused: false });
}

describe("telegram webhook - a circle member's chat, shared with the bot's other flows", () => {
  beforeEach(async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
    process.env.CIRCLE_INVITE_CODE = 'invite-code-123456';
    hoisted.toasts.length = 0;
    hoisted.sent.length = 0;
  });

  it("a member's STOP pauses the circle reads and runs the route's stop, in one reply", async () => {
    await seedMember('101');
    await post(privateMessage(101, 'STOP'));
    expect(hoisted.sent).toEqual([['101', 'Your circle reads are paused - send /resume to start them again.']]);
    expect((await new CircleStore().getMember('101'))!.paused).toBe(true);
  });

  it('a subscribe link from a member reaches the route, not the circle help', async () => {
    await seedMember('102');
    await post(privateMessage(102, '/start sAbCdEf123456'));
    expect(hoisted.sent).toHaveLength(1);
    expect(hoisted.sent[0]![1]).toContain('running without a database');
    expect(hoisted.sent[0]![1]).not.toContain('/world');
  });

  it("a member's reply to a briefing's feedback buttons is the feedback flow's note, never a question for a model", async () => {
    await seedMember('103');
    const repliedTo = { message_id: 40, from: { id: 999, is_bot: true }, reply_markup: { inline_keyboard: [[{ text: '👍', callback_data: 'fb:5d1e1c0a-7f5e-4b8e-9a1b-2c3d4e5f6a7b:u' }]] } };
    await post(privateMessage(103, 'this item was wrong', { reply_to_message: repliedTo }));
    // The route's note flow answered (here, without its database) - not the circle's chat, which
    // would have replied with figures or a model's answer.
    expect(hoisted.sent).toHaveLength(1);
    expect(hoisted.sent[0]![1]).toContain('running without a database');
    expect(hoisted.sent[0]![1]).not.toContain('figures');
  });

  it('holds circle button taps to the per-chat limit', async () => {
    await seedMember('104');
    for (let i = 0; i < 14; i += 1) {
      await post({ callback_query: { id: `q${i}`, from: { id: 104 }, data: 'cl:t:asia', message: { message_id: 3, chat: { id: 104 } } } });
    }
    expect(hoisted.toasts.length).toBeLessThanOrEqual(10);
    expect(hoisted.toasts.length).toBeGreaterThan(0);
  });
});
