/**
 * The circle on the Telegram webhook - who may join, what a member's message does, and what a tap
 * on a circle button does. The route (src/app/api/webhooks/telegram/route.ts) offers every update
 * here first; whatever is not the circle's goes on to the route's own closed command set unchanged.
 *
 * Who is in: only someone who opened the invite link (`t.me/<bot>?start=c<CIRCLE_INVITE_CODE>`) or
 * the owner link (`?start=o<CIRCLE_OWNER_CODE>`), up to CIRCLE_MAX_MEMBERS people. Telegram
 * delivering that /start from a chat is the proof the chat is theirs. The circle is ON only while
 * CIRCLE_INVITE_CODE is set: unset it and nobody joins, no member is answered and no read goes out
 * (the broadcast route checks the same switch). Without the shared store the circle is off too, and
 * says so.
 *
 * The same bot serves the evening briefing's subscribers and paired accounts, so a member's chat is
 * never the circle's alone. A /start link the circle does not own, a STOP (which every briefing and
 * alert tells people to send), a reply to another Lyra message's feedback buttons and any command
 * the circle does not know all go back to the route - a STOP after pausing the circle's own reads,
 * so one reply says everything that stopped.
 *
 * Only private chats hold a conversation. In the one group CIRCLE_GROUP_CHAT_ID names, the bot
 * answers /world and /read and nothing else - a question asked in a group would be answered in
 * front of everyone, which is the one thing this was built not to do.
 *
 * Slow work (a question, /world, /read) runs AFTER the webhook has returned 200 (`later`, which is
 * next/server's after() in the route): Telegram retries a slow webhook, and a retried update would be
 * answered twice. The update id is claimed once in the shared store for the same reason, and so is
 * every button tap.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { DeliveryRecord } from '@/lib/notifications/types';
import type { SendTelegramOptions, TelegramCallResult } from '@/lib/notifications/telegram';
import { describeHoldings, getWorldSnapshot } from '@/lib/world/fetch';
import type { WorldSnapshot } from '@/lib/world/compute';
import { notableHtml, regionHtml, regionsFor, techPulseHtml } from '@/lib/world/text';
import { circleStartFlow, MAX_TEXT_CHARS, parseCircleMessage, parseCircleTap, readIdFor, type CircleCommand } from './commands';
import { converse, liveConverseDeps, type ConverseDeps } from './converse';
import { personalise, sydneyDate, yourNamesHtml, type ComposedRead } from './reads';
import { CircleStore, CircleStoreUnavailable, isCircleTopic, MAX_HOLDINGS, type CircleMember, type FeedbackNote } from './store';
import {
  CIRCLE_STOPPED,
  feedbackForOwnerHtml,
  feedbacksHtml,
  HELP_TEXT,
  meText,
  membersInOrder,
  membersText,
  NOT_ADVICE,
  notedKeyboard,
  OWNER_TEXT,
  ownersLabel,
  privacyText,
  rateKeyboard,
  READ_TIMES,
  topicKeyboard,
  topicsLine,
  welcomeText,
  whyKeyboard,
  WHY_REASONS,
} from './ui';

export interface CircleConfig {
  inviteCode: string | null;
  ownerCode: string | null;
  maxMembers: number;
  botUsername: string | null;
  /** The one group chat the reads also go to - and the only group the bot answers /world and /read in. */
  groupChatId: string | null;
}

/** Codes shorter than this are guessable and are treated as not set. */
const MIN_CODE_CHARS = 12;

export function circleConfigFromEnv(env: NodeJS.ProcessEnv = process.env): CircleConfig {
  const code = (value: string | undefined) => {
    const trimmed = value?.trim() ?? '';
    return trimmed.length >= MIN_CODE_CHARS && /^[A-Za-z0-9_-]{1,63}$/.test(trimmed) ? trimmed : null;
  };
  const max = Number(env.CIRCLE_MAX_MEMBERS);
  const group = env.CIRCLE_GROUP_CHAT_ID?.trim() ?? '';
  return {
    inviteCode: code(env.CIRCLE_INVITE_CODE),
    ownerCode: code(env.CIRCLE_OWNER_CODE),
    maxMembers: Number.isFinite(max) && max >= 1 ? Math.min(Math.floor(max), 200) : 12,
    botUsername: env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') || null,
    groupChatId: /^-?\d{1,20}$/.test(group) ? group : null,
  };
}

/** The circle's off switch: it is on only while it has an invite code. */
export function circleIsOn(config: CircleConfig): boolean {
  return config.inviteCode !== null;
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

/**
 * What a message replies to, read by the route from the replied-to message's buttons: a circle read
 * (and whether the member had already rated it - the "Noted" button), or another Lyra message that
 * carries the feedback flow's buttons (the briefing, an alert).
 */
export type ReplyTarget = { kind: 'read'; readId: string; rated: boolean } | { kind: 'feedback' } | null;

export interface InboundMessage {
  updateId: number;
  chatId: string;
  chatType: string;
  fromId: string;
  firstName: string;
  text: string;
  replyTo: ReplyTarget;
  /** It replies to one of the bot's own messages (with or without buttons). */
  repliesToBot: boolean;
}

export interface InboundTap {
  id: string;
  fromId: string;
  chatId: string;
  messageId: number | null;
  data: string;
}

/**
 * What the route does next. `handled` - the circle answered (or deliberately said nothing). Not
 * handled - the route's own commands take it; `stop` - it was a STOP from a member, whose circle
 * reads are paused, and the route's stop (ending the briefing subscription and the account pairing)
 * runs with `note` as the circle's part of the reply.
 */
export type CircleOutcome = { handled: true } | { handled: false; stop?: { note: string } };

const HANDLED: CircleOutcome = { handled: true };
const NOT_OURS: CircleOutcome = { handled: false };

function codeMatches(provided: string, expected: string | null): boolean {
  if (!expected || !provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

const NOT_ON = "Lyra's circle isn't switched on here yet.";
const ONCE_TTL = 86_400;
const STORE_DOWN = 'Lyra could not reach its memory just now - try again in a minute.';

function nowOf(io: CircleIo): Date {
  return io.now?.() ?? new Date();
}

function plainName(name: string, fallback: string): string {
  return (name || fallback).replace(/[<>&]/g, '');
}

/** Every owner's first name (an unnamed owner still counts, so "the people who run this Lyra" stays plural). */
async function ownerNames(store: CircleStore): Promise<string[]> {
  const owners = await store.ownerIds();
  const records = await Promise.all(owners.map((id) => store.getMember(id)));
  return records.map((record) => record?.name ?? '');
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

/** Run slow work after the 200, with a plain reply if it fails. */
function runLater(io: CircleIo, chatId: string, updateId: number, event: string, work: () => Promise<void>): void {
  io.later(async () => {
    try {
      await work();
    } catch (error) {
      console.warn(JSON.stringify({ at: 'circle', event, error: error instanceof Error ? error.name : 'unknown' }));
      await io.send(chatId, 'Something went wrong on my side - ask again in a minute.', `circle:error:${updateId}`).catch(() => undefined);
    }
  });
}

/** /world or /read, for a member (their order, their names, the rating buttons) or for the group (nobody's names, no buttons). */
async function readOut(kind: 'world' | 'read', member: CircleMember | null, chatId: string, updateId: number, io: CircleIo): Promise<void> {
  const key = `circle:cmd:${updateId}`;
  if (kind === 'world') {
    if (member) await io.typing(chatId);
    const snapshot = await (io.snapshot ?? (() => getWorldSnapshot()))();
    await io.send(chatId, worldNowHtml(snapshot, member), key, { parseMode: 'HTML' });
    return;
  }
  const read = await io.store.lastRead<ComposedRead>();
  if (!read) {
    await io.send(chatId, `No read has gone out yet - the next arrives ${READ_TIMES}. /world shows every market right now.`, key);
    return;
  }
  if (!member) {
    await io.send(chatId, personalise(read, null), key, { parseMode: 'HTML' });
    return;
  }
  const moves = member.holdings.length ? await describeHoldings(member.holdings).catch(() => []) : [];
  const names = yourNamesHtml(member.holdings.map((symbol, index) => ({ symbol, move: moves[index] ?? null })));
  await io.send(chatId, personalise(read, member, names), key, { parseMode: 'HTML', replyMarkup: rateKeyboard(read.readId) });
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
        joinedAt: nowOf(io).toISOString(),
        topics: [],
        holdings: [],
        reads: { morning: true, evening: true },
        paused: false,
      };
  await store.saveMember(member);
  console.info(JSON.stringify({ at: 'circle', event: 'joined', role: member.role, upgraded: Boolean(existing) }));
  await reply(welcomeText(member, await ownerNames(store)), { replyMarkup: topicKeyboard(member.topics) });
  if (member.role === 'owner') {
    await io.send(message.chatId, OWNER_TEXT, `circle:owner:${message.updateId}`);
    // Every owner sees every note and can remove anyone, so the others are told when one is added.
    await tellOwners(io, `🔑 <b>${plainName(member.name, 'Someone')}</b> is now an owner of the circle.`, `circle:new-owner:${message.chatId}:${message.updateId}`, message.chatId);
  } else {
    await tellOwners(io, `👋 <b>${plainName(member.name, 'Someone')}</b> joined the circle.`, `circle:joined:${message.chatId}`);
  }
}

// --- commands --------------------------------------------------------------------------------------

/** The last week's reads, newest first: morning and evening for each Sydney date. */
function recentReadIds(nowMs: number, days = 7): string[] {
  const ids: string[] = [];
  for (let back = 0; back < days; back += 1) {
    const date = sydneyDate(nowMs - back * 86_400_000);
    ids.push(readIdFor('evening', date), readIdFor('morning', date));
  }
  return ids;
}

type MemberCommand = Exclude<CircleCommand, { kind: 'ask' } | { kind: 'stop' } | { kind: 'unknown' }>;

async function runCommand(command: MemberCommand, member: CircleMember, message: InboundMessage, io: CircleIo): Promise<void> {
  const key = `circle:cmd:${message.updateId}`;
  const reply = (text: string, options?: SendTelegramOptions) => io.send(message.chatId, text, key, options);
  const { store } = io;
  const owner = member.role === 'owner';
  switch (command.kind) {
    case 'help':
      await reply(owner ? `${HELP_TEXT}\n\n${OWNER_TEXT}` : HELP_TEXT);
      return;
    case 'privacy':
      await reply(privacyText(await ownerNames(store)));
      return;
    case 'me':
      await reply(meText(member));
      return;
    case 'topics':
      await reply(`You follow: ${topicsLine(member.topics)}. Tap to change, then Done.`, { replyMarkup: topicKeyboard(member.topics) });
      return;
    case 'world':
    case 'read': {
      // Slow (the board, their prices): after the 200, once per update.
      if (!(await store.claimOnce(`update:${message.updateId}`, ONCE_TTL))) return;
      const kind = command.kind;
      runLater(io, message.chatId, message.updateId, 'read_out_error', () => readOut(kind, member, message.chatId, message.updateId, io));
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
      await recordFeedback(io, { chatId: member.chatId, name: member.name, text: command.text.trim(), via: 'command', readId: null, at: nowOf(io).toISOString() });
      await reply(`Thanks - passed to ${ownersLabel(await ownerNames(store))}, with your first name.`);
      return;
    }
    case 'pause':
      await store.saveMember({ ...member, paused: true });
      await reply('Paused - no more scheduled reads until you send /resume. You can still ask me anything. (/leave to leave the circle.)');
      return;
    case 'resume':
      await store.saveMember({ ...member, paused: false });
      await reply(`Back on - the next read arrives ${READ_TIMES}.`);
      return;
    case 'leave':
      await store.removeMember(member.chatId);
      await reply('Done - you have left the circle and Lyra has forgotten you: your name, topics and names, our chat and your 👍/👎. Feedback notes you sent stay with the owners. The invite link brings you back any time.');
      await tellOwners(io, `${plainName(member.name, 'A member')}${owner ? ' (an owner)' : ''} left the circle.`, `circle:left:${member.chatId}:${message.updateId}`, member.chatId);
      return;
    case 'members':
      if (!owner) break;
      await reply(membersText(await store.members()));
      return;
    case 'feedbacks': {
      if (!owner) break;
      const [notes, ratings] = await Promise.all([store.recentFeedback(10), store.ratingCounts(recentReadIds(nowOf(io).getTime()))]);
      await reply(feedbacksHtml(notes, ratings), { parseMode: 'HTML' });
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
    case 'kick':
    case 'demote': {
      if (!owner) break;
      const verb = command.kind;
      if (command.index === null) {
        await reply(`Send the number from /members after the command: /${verb} 3`);
        return;
      }
      const target = membersInOrder(await store.members())[command.index - 1];
      if (!target) {
        await reply(`There is no member number ${command.index} - send /members for the list.`);
        return;
      }
      if (target.chatId === member.chatId) {
        await reply(verb === 'kick' ? "You can't remove yourself - /leave does that." : "You can't demote yourself here - another owner can, or /leave.");
        return;
      }
      const name = plainName(target.name, 'that member');
      if (verb === 'kick') {
        await store.removeMember(target.chatId);
        await io.send(target.chatId, "You've been removed from Lyra's circle by one of its owners, and Lyra has forgotten your record and our chat.", `circle:kicked:${message.updateId}`);
        await reply(`Removed ${name}.`);
        await tellOwners(io, `${name} was removed from the circle by ${plainName(member.name, 'an owner')}.`, `circle:kick:${message.updateId}`, member.chatId);
        return;
      }
      if (target.role !== 'owner') {
        await reply(`${name} is not an owner.`);
        return;
      }
      await store.saveMember({ ...target, role: 'member' });
      await io.send(target.chatId, "You're a member of Lyra's circle now, no longer an owner.", `circle:demoted:${message.updateId}`);
      await reply(`${name} is a member now.`);
      await tellOwners(io, `${name} is no longer an owner (changed by ${plainName(member.name, 'an owner')}).`, `circle:demote:${message.updateId}`, member.chatId);
      return;
    }
  }
  await reply(`I don't know that command - send /help, or just ask me in your own words.`);
}

// --- a question, and a note on a read ------------------------------------------------------------------

/**
 * `epoch` is the conversation's epoch when the question ARRIVED: a /forget or /leave sent after it -
 * before or during the answer - wins, and the exchange is not saved back.
 */
async function answer(member: CircleMember, message: InboundMessage, text: string, epoch: number, io: CircleIo): Promise<void> {
  const { store } = io;
  const started = Date.now();
  await io.typing(message.chatId);
  const history = await store.turns(message.chatId, nowOf(io).getTime()).catch(() => []);
  const question = message.replyTo?.kind === 'read' ? `(Replying to the read ${message.replyTo.readId}) ${text}` : text;
  const result = await converse(member, question, history, io.converseDeps ?? liveConverseDeps);
  const sent = await io.send(message.chatId, result.text, `circle:answer:${message.updateId}`);
  const at = nowOf(io).toISOString();
  const keep = result.outcome !== 'refused' && (await store.epoch(message.chatId)) === epoch && (await store.getMember(message.chatId)) !== null;
  if (keep) {
    await store.appendTurns(message.chatId, [
      { role: 'user', text, at },
      { role: 'lyra', text: result.text, at },
    ]);
  }
  // Counts, outcome and timing only - never the question or the answer.
  console.info(JSON.stringify({ at: 'circle', event: 'answer', outcome: result.outcome, model: result.model, sent: sent.status, ms: Date.now() - started, saved: keep }));
}

/** A reply to a read the member rated: their own words, filed as a note on that read - never sent to a model. */
async function fileReply(member: CircleMember, message: InboundMessage, readId: string, text: string, io: CircleIo): Promise<void> {
  const note = text.trim().slice(0, MAX_TEXT_CHARS);
  if (!note || !(await io.store.claimOnce(`update:${message.updateId}`, ONCE_TTL))) return;
  await recordFeedback(io, { chatId: member.chatId, name: member.name, text: note, via: 'reply', readId, at: nowOf(io).toISOString() });
  await io.send(
    message.chatId,
    `Thanks - passed to ${ownersLabel(await ownerNames(io.store))} as a note on that read, with your first name. To ask me something, send it as a new message.`,
    `circle:reply-note:${message.updateId}`,
  );
}

// --- groups --------------------------------------------------------------------------------------------

function privatePointer(botUsername: string | null): string {
  return `Questions are answered privately, never in the group - message me directly${botUsername ? ` at @${botUsername}` : ''}.`;
}

async function inGroup(message: InboundMessage, text: string, io: CircleIo): Promise<CircleOutcome> {
  // Only the one group the reads go to. Any other group the bot is added to gets nothing from the circle.
  if (!io.config.groupChatId || message.chatId !== io.config.groupChatId) return NOT_OURS;
  // A reply to the bot here is almost always a question about a read: point to the private chat,
  // rather than let it fall to a flow that would answer in front of everyone.
  if (message.repliesToBot) {
    if (await io.store.claimOnce(`update:${message.updateId}`, ONCE_TTL)) await io.send(message.chatId, privatePointer(io.config.botUsername), `circle:group-reply:${message.updateId}`);
    return HANDLED;
  }
  const command = parseCircleMessage(text);
  if (command.kind !== 'world' && command.kind !== 'read') return NOT_OURS;
  if (!(await io.store.claimOnce(`update:${message.updateId}`, ONCE_TTL))) return HANDLED;
  const kind = command.kind;
  runLater(io, message.chatId, message.updateId, 'group_read_out_error', () => readOut(kind, null, message.chatId, message.updateId, io));
  return HANDLED;
}

// --- entry points ------------------------------------------------------------------------------------

export async function handleCircleMessage(message: InboundMessage, io: CircleIo): Promise<CircleOutcome> {
  const text = message.text.trim();
  const startArgs = /^\/start(?:@\S+)?\s+(\S+)/.exec(text)?.[1] ?? '';
  const start = startArgs ? circleStartFlow(startArgs) : null;
  // A /start link the circle does not own (a subscribe or account-pairing link) is the route's, from anyone.
  if (startArgs && !start) return NOT_OURS;
  try {
    if (start) {
      if (message.chatType !== 'private') {
        await io.send(message.chatId, 'Open the invite link in a private chat with me, not in a group.', `circle:start:${message.updateId}`);
        return HANDLED;
      }
      if (!circleIsOn(io.config)) {
        await io.send(message.chatId, NOT_ON, `circle:start:${message.updateId}`);
        return HANDLED;
      }
      await join(message, start.flow, start.code, io);
      return HANDLED;
    }
    if (!circleIsOn(io.config)) return NOT_OURS;
    if (message.chatType !== 'private') return await inGroup(message, text, io);

    const member = await io.store.getMember(message.chatId);
    if (!member) return NOT_OURS;
    // A reply to the briefing's or an alert's feedback buttons is that flow's note, not a question.
    if (message.replyTo?.kind === 'feedback') return NOT_OURS;

    const command = parseCircleMessage(text);
    if (command.kind === 'stop') {
      await io.store.saveMember({ ...member, paused: true });
      return { handled: false, stop: { note: CIRCLE_STOPPED } };
    }
    // A command the circle does not know is one of the route's (/status, /mute ...).
    if (command.kind === 'unknown') return NOT_OURS;
    if (command.kind !== 'ask') {
      await runCommand(command, member, message, io);
      return HANDLED;
    }
    if (message.replyTo?.kind === 'read' && message.replyTo.rated) {
      await fileReply(member, message, message.replyTo.readId, command.text, io);
      return HANDLED;
    }
    // A question: claimed once (a Telegram redelivery must not be answered twice), then answered
    // after the webhook has returned.
    if (!(await io.store.claimOnce(`update:${message.updateId}`, ONCE_TTL))) return HANDLED;
    const question = command.text;
    const epoch = await io.store.epoch(message.chatId);
    runLater(io, message.chatId, message.updateId, 'answer_error', () => answer(member, message, question, epoch, io));
    return HANDLED;
  } catch (error) {
    if (error instanceof CircleStoreUnavailable) {
      if (start) {
        await io.send(message.chatId, NOT_ON, `circle:start:${message.updateId}`).catch(() => undefined);
        return HANDLED;
      }
      return NOT_OURS;
    }
    // The store did not answer (a dropped connection). A STOP still reaches the route's stop; a
    // command the circle does not know is still the route's. Anything else gets a plain "try
    // again" rather than being handed to the route, which would answer a member as a stranger.
    console.warn(JSON.stringify({ at: 'circle', event: 'store_error', error: error instanceof Error ? error.name : 'unknown' }));
    const command = parseCircleMessage(text);
    if (command.kind === 'stop') return { handled: false, stop: { note: "Lyra couldn't pause your circle reads just now - send STOP again in a minute." } };
    if (command.kind === 'unknown' || message.chatType !== 'private') return NOT_OURS;
    await io.send(message.chatId, STORE_DOWN, `circle:error:${message.updateId}`).catch(() => undefined);
    return HANDLED;
  }
}

/** True when the tap was a circle button (handled here, answered always); false otherwise. */
export async function handleCircleTap(tap: InboundTap, io: CircleIo): Promise<boolean> {
  if (!tap.data.startsWith('cl:')) return false;
  const parsed = parseCircleTap(tap.data);
  try {
    if (!circleIsOn(io.config)) {
      await io.answerTap(tap.id, NOT_ON);
      return true;
    }
    if (!parsed || parsed.kind === 'noted') {
      await io.answerTap(tap.id, parsed ? 'Reply to the read to say more.' : undefined);
      return true;
    }
    // A redelivered tap is acted on once.
    if (!(await io.store.claimOnce(`tap:${tap.id}`, ONCE_TTL))) {
      await io.answerTap(tap.id);
      return true;
    }
    const member = await io.store.getMember(tap.fromId);
    if (!member) {
      await io.answerTap(tap.id, 'Join the circle with your invite link first.');
      return true;
    }
    // Buttons change only in the member's own private chat: a tap anywhere else (an old group copy)
    // must never rewrite what other people see.
    const ownChat = tap.chatId === tap.fromId && tap.messageId !== null;
    const at = nowOf(io).toISOString();
    switch (parsed.kind) {
      case 'topic': {
        if (!isCircleTopic(parsed.topic)) break;
        const topics = member.topics.includes(parsed.topic) ? member.topics.filter((topic) => topic !== parsed.topic) : [...member.topics, parsed.topic];
        await io.store.saveMember({ ...member, topics });
        await io.answerTap(tap.id);
        if (ownChat) await io.editMarkup(tap.chatId, tap.messageId!, topicKeyboard(topics));
        return true;
      }
      case 'topics_done':
        await io.answerTap(tap.id, 'Saved');
        if (ownChat) await io.editMarkup(tap.chatId, tap.messageId!, { inline_keyboard: [] });
        await io.send(
          member.chatId,
          `Got it - ${topicsLine(member.topics)}. ${member.holdings.length ? '' : 'Add what you hold with /hold NVDA CBA.AX so your names come first. '}Ask me anything, any time.`,
          `circle:topics-done:${tap.id}`,
        );
        return true;
      case 'rate':
        await io.store.rate(parsed.readId, member.chatId, parsed.rating);
        await io.answerTap(tap.id, parsed.rating === 'u' ? 'Thanks!' : 'What was off?');
        if (ownChat) await io.editMarkup(tap.chatId, tap.messageId!, parsed.rating === 'u' ? notedKeyboard(parsed.readId) : whyKeyboard(parsed.readId));
        return true;
      case 'why': {
        // One reason per member per read reaches the owners - a member cannot flood them by tapping.
        if (!(await io.store.claimOnce(`why:${parsed.readId}:${member.chatId}`, ONCE_TTL))) {
          await io.answerTap(tap.id, 'Already noted - reply to the read to say more.');
          return true;
        }
        const label = WHY_REASONS.find((reason) => reason.id === parsed.reason)?.label ?? parsed.reason;
        await recordFeedback(io, { chatId: member.chatId, name: member.name, text: `Not for me: ${label}`, via: 'rating', readId: parsed.readId, at });
        await io.answerTap(tap.id, 'Noted - reply to the read to say more.');
        if (ownChat) await io.editMarkup(tap.chatId, tap.messageId!, notedKeyboard(parsed.readId));
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
