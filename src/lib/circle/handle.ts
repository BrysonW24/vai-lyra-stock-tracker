/**
 * The circle on the Telegram webhook - who may join, what a member's message does, and what a tap
 * on a circle button does. The route (src/app/api/webhooks/telegram/route.ts) hands every update
 * here first; whatever is not the circle's goes on to the route's own closed command set unchanged.
 *
 * Who is in: only someone who opened the invite link (`t.me/<bot>?start=c<CIRCLE_INVITE_CODE>`) or
 * the owner link (`?start=o<CIRCLE_OWNER_CODE>`), up to CIRCLE_MAX_MEMBERS people. Telegram
 * delivering that /start from a chat is the proof the chat is theirs. Without the shared store, or
 * without an invite code, the circle is off and says so.
 *
 * Only private chats hold a conversation. In a group the bot answers /world and /read and nothing
 * else - a question asked in a group would be answered in front of everyone, which is the one thing
 * this was built not to do.
 *
 * A question is answered AFTER the webhook has returned 200 (`later`, which is next/server's after()
 * in the route): Telegram retries a slow webhook, and a retried question would be answered twice.
 * The update id is claimed once in the shared store for the same reason.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { DeliveryRecord } from '@/lib/notifications/types';
import type { SendTelegramOptions, TelegramCallResult } from '@/lib/notifications/telegram';
import { describeHoldings, getWorldSnapshot } from '@/lib/world/fetch';
import type { WorldSnapshot } from '@/lib/world/compute';
import { notableHtml, regionHtml, regionsFor, techPulseHtml } from '@/lib/world/text';
import { circleStartFlow, parseCircleMessage, parseCircleTap, type CircleCommand } from './commands';
import { converse, liveConverseDeps, type ConverseDeps } from './converse';
import { personalise, yourNamesHtml, type ComposedRead } from './reads';
import { CircleStore, CircleStoreUnavailable, isCircleTopic, MAX_HOLDINGS, type CircleMember, type FeedbackNote } from './store';
import { feedbackForOwnerHtml, HELP_TEXT, meText, membersText, NOT_ADVICE, ownerLabel, privacyText, rateKeyboard, topicKeyboard, topicsLine, welcomeText, whyKeyboard, WHY_REASONS } from './ui';

export interface CircleConfig {
  inviteCode: string | null;
  ownerCode: string | null;
  maxMembers: number;
  botUsername: string | null;
}

/** Codes shorter than this are guessable and are treated as not set. */
const MIN_CODE_CHARS = 12;

export function circleConfigFromEnv(env: NodeJS.ProcessEnv = process.env): CircleConfig {
  const code = (value: string | undefined) => {
    const trimmed = value?.trim() ?? '';
    return trimmed.length >= MIN_CODE_CHARS && /^[A-Za-z0-9_-]{1,63}$/.test(trimmed) ? trimmed : null;
  };
  const max = Number(env.CIRCLE_MAX_MEMBERS);
  return {
    inviteCode: code(env.CIRCLE_INVITE_CODE),
    ownerCode: code(env.CIRCLE_OWNER_CODE),
    maxMembers: Number.isFinite(max) && max >= 1 ? Math.min(Math.floor(max), 200) : 12,
    botUsername: env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') || null,
  };
}

export interface CircleIo {
  store: CircleStore;
  send: (chatId: string, text: string, key: string, options?: SendTelegramOptions) => Promise<DeliveryRecord>;
  answerTap: (id: string, text?: string) => Promise<TelegramCallResult>;
  editMarkup: (chatId: string, messageId: number, markup: unknown) => Promise<TelegramCallResult>;
  typing: (chatId: string) => Promise<TelegramCallResult>;
  /** Run work after the response is sent (next/server after() in the route; immediate in tests). */
  later: (work: () => Promise<void>) => void;
  config: CircleConfig;
  converseDeps?: ConverseDeps;
  snapshot?: () => Promise<WorldSnapshot>;
  now?: () => Date;
}

export interface InboundMessage {
  updateId: number;
  chatId: string;
  chatType: string;
  fromId: string;
  firstName: string;
  text: string;
  /** The circle read this message replies to, when it replies to one. */
  replyToReadId: string | null;
}

export interface InboundTap {
  id: string;
  fromId: string;
  chatId: string;
  messageId: number | null;
  data: string;
}

function codeMatches(provided: string, expected: string | null): boolean {
  if (!expected || !provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

const NOT_ON = "Lyra's circle isn't switched on here yet.";
const ONCE_TTL = 86_400;

async function ownerName(store: CircleStore): Promise<string | null> {
  const owners = await store.ownerIds();
  for (const id of owners) {
    const owner = await store.getMember(id);
    if (owner?.name) return owner.name;
  }
  return null;
}

async function tellOwners(io: CircleIo, html: string, key: string, exceptChatId: string | null = null): Promise<void> {
  const owners = await io.store.ownerIds();
  await Promise.all(owners.filter((id) => id !== exceptChatId).map((id) => io.send(id, html, `${key}:${id}`, { parseMode: 'HTML' })));
}

async function recordFeedback(io: CircleIo, note: FeedbackNote): Promise<void> {
  await io.store.addFeedback(note);
  await tellOwners(io, feedbackForOwnerHtml(note), `circle:feedback:${note.chatId}:${note.at}`, note.chatId);
}

function worldNowHtml(snapshot: WorldSnapshot, member: CircleMember | null): string {
  const order = ['asia', 'europe', 'us', 'australia', 'macro'] as const;
  // Region ids double as topic ids (asia, europe, us, australia, macro), so a followed region leads.
  const followed = new Set<string>(member?.topics ?? []);
  const regions = regionsFor(snapshot, order).sort((a, b) => Number(followed.has(b.region)) - Number(followed.has(a.region)));
  return [
    '🗺️ <b>Markets right now</b>',
    techPulseHtml(snapshot.techPulse),
    ...regions.map((region) => regionHtml(region)),
    notableHtml(snapshot, 4),
    `<i>${NOT_ADVICE}</i>`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// --- joining -------------------------------------------------------------------------------------

async function join(message: InboundMessage, flow: 'invite' | 'owner', code: string, io: CircleIo): Promise<void> {
  const reply = (text: string, options?: SendTelegramOptions) => io.send(message.chatId, text, `circle:start:${message.updateId}`, options);
  const { config, store } = io;
  const expected = flow === 'owner' ? config.ownerCode : config.inviteCode;
  if (!codeMatches(code, expected)) {
    await reply(flow === 'owner' ? 'That owner link is not one Lyra recognises.' : 'That invite link is not one Lyra recognises, or it has been changed. Ask the person who sent it for a new one.');
    return;
  }
  const existing = await store.getMember(message.chatId);
  if (existing && (flow === 'invite' || existing.role === 'owner')) {
    await reply(`You're already in, ${existing.name || 'friend'}. Ask me anything, or send /help.`);
    return;
  }
  if (!existing && (await store.memberCount()) >= config.maxMembers) {
    await reply('The circle is full for now - ask the person who invited you to make room.');
    return;
  }
  const member: CircleMember = existing
    ? { ...existing, role: 'owner' }
    : {
        chatId: message.chatId,
        name: message.firstName.slice(0, 64),
        role: flow === 'owner' ? 'owner' : 'member',
        joinedAt: (io.now?.() ?? new Date()).toISOString(),
        topics: [],
        holdings: [],
        reads: { morning: true, evening: true },
        paused: false,
      };
  await store.saveMember(member);
  console.info(JSON.stringify({ at: 'circle', event: 'joined', role: member.role }));
  const owner = member.role === 'owner' ? member.name : await ownerName(store);
  await reply(welcomeText(member, owner), { replyMarkup: topicKeyboard(member.topics) });
  if (member.role === 'owner') {
    await io.send(message.chatId, 'You are the owner. /members lists who is in (names only), /feedbacks shows the latest feedback, /invite gives you the link to share, /announce sends everyone a note.', `circle:owner:${message.updateId}`);
  } else {
    await tellOwners(io, `👋 <b>${(member.name || 'Someone').replace(/[<>&]/g, '')}</b> joined the circle.`, `circle:joined:${message.chatId}`);
  }
}

// --- commands --------------------------------------------------------------------------------------

async function runCommand(command: Exclude<CircleCommand, { kind: 'ask' }>, member: CircleMember, message: InboundMessage, io: CircleIo): Promise<void> {
  const key = `circle:cmd:${message.updateId}`;
  const reply = (text: string, options?: SendTelegramOptions) => io.send(message.chatId, text, key, options);
  const { store } = io;
  const owner = member.role === 'owner';
  switch (command.kind) {
    case 'help':
      await reply(HELP_TEXT);
      return;
    case 'privacy':
      await reply(privacyText(await ownerName(store)));
      return;
    case 'me':
      await reply(meText(member));
      return;
    case 'topics':
      await reply(`You follow: ${topicsLine(member.topics)}. Tap to change, then Done.`, { replyMarkup: topicKeyboard(member.topics) });
      return;
    case 'world': {
      await io.typing(message.chatId);
      const snapshot = await (io.snapshot ?? (() => getWorldSnapshot()))();
      await reply(worldNowHtml(snapshot, member), { parseMode: 'HTML' });
      return;
    }
    case 'read': {
      const read = await store.lastRead<ComposedRead>();
      if (!read) {
        await reply('No read has gone out yet - the next arrives about 8:45am or 7:15pm Sydney. /world shows every market right now.');
        return;
      }
      const moves = member.holdings.length ? await describeHoldings(member.holdings).catch(() => []) : [];
      const names = yourNamesHtml(member.holdings.map((symbol, index) => ({ symbol, move: moves[index] ?? null })));
      await reply(personalise(read, member, names), { parseMode: 'HTML', replyMarkup: rateKeyboard(read.readId) });
      return;
    }
    case 'hold': {
      if (!command.symbols.length) {
        await reply(`Send the tickers after the command, the way Yahoo writes them: /hold NVDA CBA.AX 005930.KS${command.rejected.length ? ` (I couldn't read: ${command.rejected.join(', ')})` : ''}`);
        return;
      }
      const holdings = [...new Set([...member.holdings, ...command.symbols])].slice(0, MAX_HOLDINGS);
      await store.saveMember({ ...member, holdings });
      await reply(`Added. Your names: ${holdings.join(', ')}.${command.rejected.length ? ` Not tickers I could read: ${command.rejected.join(', ')}.` : ''} They come first in your reads, and you can ask about them any time.`);
      return;
    }
    case 'drop': {
      const holdings = member.holdings.filter((symbol) => !command.symbols.includes(symbol));
      await store.saveMember({ ...member, holdings });
      await reply(holdings.length ? `Done. Your names: ${holdings.join(', ')}.` : 'Done - no names left. Add some with /hold NVDA.');
      return;
    }
    case 'forget':
      await store.forgetTurns(message.chatId);
      await reply('Done - our conversation is wiped. Your topics and names are still here (/me).');
      return;
    case 'feedback': {
      if (!command.text.trim()) {
        await reply('Write it after the command, like: /feedback the evening read is too long');
        return;
      }
      await recordFeedback(io, { chatId: member.chatId, name: member.name, text: command.text.trim(), via: 'command', readId: null, at: (io.now?.() ?? new Date()).toISOString() });
      await reply(`Thanks - passed to ${ownerLabel(await ownerName(store))}.`);
      return;
    }
    case 'pause':
      await store.saveMember({ ...member, paused: true });
      await reply('Paused - no more scheduled reads until you send /resume. You can still ask me anything. (/leave to leave the circle.)');
      return;
    case 'resume':
      await store.saveMember({ ...member, paused: false });
      await reply('Back on - the next read arrives about 8:45am or 7:15pm Sydney.');
      return;
    case 'leave':
      await store.removeMember(member.chatId);
      await reply('Done - you have left the circle and Lyra has forgotten you (your name, topics, names and our chat). Feedback you sent stays with the owner. The invite link brings you back any time.');
      if (!owner) await tellOwners(io, `${(member.name || 'A member').replace(/[<>&]/g, '')} left the circle.`, `circle:left:${member.chatId}:${message.updateId}`);
      return;
    case 'members':
      if (!owner) break;
      await reply(membersText(await store.members()));
      return;
    case 'feedbacks': {
      if (!owner) break;
      const notes = await store.recentFeedback(10);
      await reply(notes.length ? notes.map((note) => feedbackForOwnerHtml(note)).join('\n\n') : 'No feedback yet.', { parseMode: 'HTML' });
      return;
    }
    case 'invite':
      if (!owner) break;
      await reply(
        io.config.botUsername && io.config.inviteCode
          ? `Share this link - anyone who opens it joins (up to ${io.config.maxMembers} people): https://t.me/${io.config.botUsername}?start=c${io.config.inviteCode}`
          : 'The invite link needs TELEGRAM_BOT_USERNAME and CIRCLE_INVITE_CODE set on the app.',
      );
      return;
    case 'announce': {
      if (!owner) break;
      if (!command.text.trim()) {
        await reply('Write the note after the command: /announce Lyra will be quiet over the holidays');
        return;
      }
      const ids = (await store.memberIds()).filter((id) => id !== member.chatId);
      const results = await Promise.all(ids.map((id) => io.send(id, `📣 ${member.name || 'The owner'}: ${command.text.trim()}`, `circle:announce:${message.updateId}:${id}`)));
      await reply(`Sent to ${results.filter((result) => result.status === 'sent' || result.status === 'demo_logged').length} of ${ids.length}.`);
      return;
    }
    case 'unknown':
      break;
  }
  await reply(`I don't know that command - send /help, or just ask me in your own words.`);
}

// --- a question ------------------------------------------------------------------------------------

async function answer(member: CircleMember, message: InboundMessage, text: string, io: CircleIo): Promise<void> {
  const { store } = io;
  const started = Date.now();
  await io.typing(message.chatId);
  const [history, owner] = await Promise.all([store.turns(message.chatId).catch(() => []), ownerName(store).catch(() => null)]);
  const question = message.replyToReadId ? `(Replying to the read ${message.replyToReadId}) ${text}` : text;
  const result = await converse(member, question, history, owner, io.converseDeps ?? liveConverseDeps);
  const sent = await io.send(message.chatId, result.text, `circle:answer:${message.updateId}`);
  const at = (io.now?.() ?? new Date()).toISOString();
  if (result.outcome !== 'refused') {
    await store.appendTurns(message.chatId, [
      { role: 'user', text, at },
      { role: 'lyra', text: result.text, at },
    ]);
  }
  if (result.feedback) await recordFeedback(io, { chatId: member.chatId, name: member.name, text: result.feedback.text, via: 'conversation', readId: message.replyToReadId, at });
  // Counts, outcome and timing only - never the question or the answer.
  console.info(JSON.stringify({ at: 'circle', event: 'answer', outcome: result.outcome, model: result.model, sent: sent.status, ms: Date.now() - started, feedback: Boolean(result.feedback) }));
}

// --- entry points ------------------------------------------------------------------------------------

/** True when the circle handled the message (the route then stops); false hands it to the route's own commands. */
export async function handleCircleMessage(message: InboundMessage, io: CircleIo): Promise<boolean> {
  const text = message.text.trim();
  const startArgs = /^\/start(?:@\S+)?\s+(\S+)/.exec(text)?.[1] ?? '';
  const start = startArgs ? circleStartFlow(startArgs) : null;
  try {
    if (start) {
      if (message.chatType !== 'private') {
        await io.send(message.chatId, 'Open the invite link in a private chat with me, not in a group.', `circle:start:${message.updateId}`);
        return true;
      }
      if (!io.config.inviteCode && !io.config.ownerCode) {
        await io.send(message.chatId, NOT_ON, `circle:start:${message.updateId}`);
        return true;
      }
      await join(message, start.flow, start.code, io);
      return true;
    }

    if (message.chatType !== 'private') {
      // In a group: only the two read-out commands, and only for a circle that is switched on.
      const command = parseCircleMessage(text);
      if (command.kind !== 'world' && command.kind !== 'read') return false;
      if (!io.config.inviteCode) return false;
      if (command.kind === 'world') {
        const snapshot = await (io.snapshot ?? (() => getWorldSnapshot()))();
        await io.send(message.chatId, worldNowHtml(snapshot, null), `circle:cmd:${message.updateId}`, { parseMode: 'HTML' });
      } else {
        const read = await io.store.lastRead<ComposedRead>();
        await io.send(message.chatId, read ? personalise(read, null) : 'No read has gone out yet.', `circle:cmd:${message.updateId}`, read ? { parseMode: 'HTML' } : undefined);
      }
      return true;
    }

    const member = await io.store.getMember(message.chatId);
    if (!member) return false;

    const command = parseCircleMessage(text);
    if (command.kind !== 'ask') {
      await runCommand(command, member, message, io);
      return true;
    }
    // A question: claimed once (a Telegram redelivery must not be answered twice), then answered
    // after the webhook has returned.
    if (!(await io.store.claimOnce(`update:${message.updateId}`, ONCE_TTL))) return true;
    io.later(async () => {
      try {
        await answer(member, message, command.text, io);
      } catch (error) {
        console.warn(JSON.stringify({ at: 'circle', event: 'answer_error', error: error instanceof Error ? error.name : 'unknown' }));
        await io.send(message.chatId, 'Something went wrong on my side - ask again in a minute.', `circle:answer:${message.updateId}`).catch(() => undefined);
      }
    });
    return true;
  } catch (error) {
    if (error instanceof CircleStoreUnavailable) {
      if (start) {
        await io.send(message.chatId, NOT_ON, `circle:start:${message.updateId}`).catch(() => undefined);
        return true;
      }
      return false;
    }
    throw error;
  }
}

const NOTED_KEYBOARD = { inline_keyboard: [[{ text: '✓ Noted - thank you', callback_data: 'cl:n' }]] };

/** True when the tap was a circle button (handled here, answered always); false otherwise. */
export async function handleCircleTap(tap: InboundTap, io: CircleIo): Promise<boolean> {
  if (!tap.data.startsWith('cl:')) return false;
  const parsed = parseCircleTap(tap.data);
  try {
    if (!parsed) {
      await io.answerTap(tap.id);
      return true;
    }
    const member = await io.store.getMember(tap.fromId);
    if (!member) {
      await io.answerTap(tap.id, 'Join the circle with your invite link first.');
      return true;
    }
    const at = (io.now?.() ?? new Date()).toISOString();
    switch (parsed.kind) {
      case 'topic': {
        if (!isCircleTopic(parsed.topic)) break;
        const topics = member.topics.includes(parsed.topic) ? member.topics.filter((topic) => topic !== parsed.topic) : [...member.topics, parsed.topic];
        await io.store.saveMember({ ...member, topics });
        await io.answerTap(tap.id);
        if (tap.messageId !== null) await io.editMarkup(tap.chatId, tap.messageId, topicKeyboard(topics));
        return true;
      }
      case 'topics_done':
        await io.answerTap(tap.id, 'Saved');
        if (tap.messageId !== null) await io.editMarkup(tap.chatId, tap.messageId, { inline_keyboard: [] });
        await io.send(
          tap.chatId,
          `Got it - ${topicsLine(member.topics)}. ${member.holdings.length ? '' : 'Add what you hold with /hold NVDA CBA.AX so your names come first. '}Ask me anything, any time.`,
          `circle:topics-done:${tap.id}`,
        );
        return true;
      case 'rate':
        await io.store.rate(parsed.readId, member.chatId, parsed.rating);
        await io.answerTap(tap.id, parsed.rating === 'u' ? 'Thanks!' : 'What was off?');
        if (tap.messageId !== null) await io.editMarkup(tap.chatId, tap.messageId, parsed.rating === 'u' ? NOTED_KEYBOARD : whyKeyboard(parsed.readId));
        return true;
      case 'why': {
        const label = WHY_REASONS.find((reason) => reason.id === parsed.reason)?.label ?? parsed.reason;
        await recordFeedback(io, { chatId: member.chatId, name: member.name, text: `Not for me: ${label}`, via: 'rating', readId: parsed.readId, at });
        await io.answerTap(tap.id, 'Noted - reply to the read to say more.');
        if (tap.messageId !== null) await io.editMarkup(tap.chatId, tap.messageId, NOTED_KEYBOARD);
        return true;
      }
    }
    await io.answerTap(tap.id);
    return true;
  } catch (error) {
    await io.answerTap(tap.id, error instanceof CircleStoreUnavailable ? NOT_ON : 'That did not save - try again in a minute.').catch(() => undefined);
    return true;
  }
}
