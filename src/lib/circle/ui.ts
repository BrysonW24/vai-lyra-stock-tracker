/**
 * The circle's words and buttons on Telegram. Plain text unless a renderer escapes its inputs.
 *
 * Tone: a friend who follows markets closely - short, specific, never hype, never advice. The owner
 * is named by their own Telegram first name (from their circle record), never hard-coded here.
 */
import { escapeHtml } from '@/lib/notifications/telegram-templates';
import { CIRCLE_TOPICS, type CircleMember, type CircleTopic } from './store';

export const NOT_ADVICE = 'Research, not financial advice.';

/** When the scheduled reads arrive, in Sydney time all year (circle-reads.yml fires for both halves of daylight saving). */
export const READ_TIMES = 'about 8:45am and 7:15pm Sydney';

/**
 * Who sees feedback, by name: every owner gets every note, so a member is told all of them - never
 * one name when there are two.
 */
export function ownersLabel(ownerNames: readonly string[]): string {
  const names = ownerNames.map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) return ownerNames.length > 1 ? 'the people who run this Lyra' : 'the person who runs this Lyra';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The line a STOP adds to the route's reply: the circle's own part of stopping. */
export const CIRCLE_STOPPED = 'Your circle reads are paused - send /resume to start them again.';

export function welcomeText(member: CircleMember, ownerNames: readonly string[]): string {
  const hello = member.name ? `Welcome to Lyra, ${member.name}.` : 'Welcome to Lyra.';
  return [
    hello,
    '',
    'I follow the markets for you - Asia, Europe, the US and Australia, tech and chips, small caps and IPOs.',
    '',
    '- Twice a day I send a short read: about 8:45am Sydney (how Wall Street and Europe closed) and about 7:15pm (how Asia closed and Europe opened).',
    '- Ask me anything, any time, in your own words. Only you see this chat.',
    '- Tell me what you hold, like /hold NVDA CBA.AX 005930.KS, and your names come first.',
    `- Feedback on Lyra: /feedback and your note, or rate a read and reply to it. That goes to ${ownersLabel(ownerNames)}, with your first name. /privacy says exactly what is kept.`,
    '',
    'First - what do you follow? Tap any, then Done.',
    '',
    NOT_ADVICE,
  ].join('\n');
}

export const HELP_TEXT = [
  'Ask me anything in plain words - "why is Korea down?", "how did chips do this week?", "what does the VIX tell me?"',
  '',
  '/world - how every market stands right now',
  '/read - the latest read again',
  '/hold NVDA CBA.AX - add what you hold (/drop to remove)',
  '/topics - choose what you follow',
  '/me - what I know about you',
  '/feedback your note - straight to the owner (or rate a read, then reply to it)',
  '/pause and /resume - the twice-daily reads',
  'STOP - pause the reads and end any other Lyra messages to this chat',
  '/forget - wipe our conversation',
  '/privacy - what is kept and who sees it',
  '/leave - leave the circle and forget me',
  '',
  NOT_ADVICE,
].join('\n');

export function privacyText(ownerNames: readonly string[]): string {
  return [
    'What Lyra keeps about you, and who sees it:',
    '',
    '- Your first name, the topics you follow and the tickers you added. Kept until you /leave.',
    '- The last 12 messages of this chat, so I can follow a conversation. Each is used for 7 days at most, and /forget wipes them.',
    '- Your 👍/👎 on each read, kept 90 days. The owners see only how many of each a read got, never who.',
    `- Feedback: what you send with /feedback, a reason you tap under a read, and a reply to a read you rated - your own words, with your first name. ${ownersLabel(ownerNames)} sees those, and nothing else you write here.`,
    '- Your question, our recent messages and the market figures it needs (including your tickers, never your name) are sent to the free AI service that writes the answer (Groq or Cloudflare, running open-source models). Cloudflare says it does not keep them; Groq keeps logs for up to 30 days and does not train on them.',
    '',
    'Other members never see your chat, your tickers or your feedback. /leave deletes your record, your chat and your 👍/👎; feedback notes you sent stay with the owners.',
  ].join('\n');
}

export const OWNER_TEXT =
  'You are an owner. /members lists who is in (numbered, names only), /feedbacks shows the latest feedback and how the recent reads were rated, /invite gives you the link to share, /announce sends everyone a note, /kick 3 removes member 3 and /demote 2 takes owner 2 back to a member.';

export function topicKeyboard(selected: readonly CircleTopic[]): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const buttons = CIRCLE_TOPICS.map((topic) => ({
    text: `${selected.includes(topic.id) ? '✅' : topic.emoji} ${topic.label}`,
    callback_data: `cl:t:${topic.id}`,
  }));
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([{ text: 'Done', callback_data: 'cl:td' }]);
  return { inline_keyboard: rows };
}

/** What a read's buttons become once it is rated: the read id stays, so a reply to it is filed as a note on that read. */
export function notedKeyboard(readId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  return { inline_keyboard: [[{ text: '✓ Noted - reply to say more', callback_data: `cl:n:${readId}` }]] };
}

export function rateKeyboard(readId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  return { inline_keyboard: [[{ text: '👍 Useful', callback_data: `cl:r:${readId}:u` }, { text: '👎 Not for me', callback_data: `cl:r:${readId}:d` }]] };
}

export const WHY_REASONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'long', label: 'Too long' },
  { id: 'short', label: 'Too thin' },
  { id: 'late', label: 'Too late' },
  { id: 'wrong', label: 'Something was wrong' },
  { id: 'more', label: 'Not my markets' },
  { id: 'other', label: 'Something else' },
];

export function whyKeyboard(readId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const buttons = WHY_REASONS.map((reason) => ({ text: reason.label, callback_data: `cl:y:${readId}:${reason.id}` }));
  return { inline_keyboard: [buttons.slice(0, 3), buttons.slice(3)] };
}

export function topicsLine(topics: readonly CircleTopic[]): string {
  const labels = CIRCLE_TOPICS.filter((topic) => topics.includes(topic.id)).map((topic) => topic.label);
  return labels.length ? labels.join(', ') : 'everything (no topics chosen)';
}

export function meText(member: CircleMember): string {
  return [
    `Name: ${member.name || '(none)'}${member.role === 'owner' ? ' (owner)' : ''}`,
    `Following: ${topicsLine(member.topics)}`,
    `Holdings: ${member.holdings.length ? member.holdings.join(', ') : 'none yet - add them with /hold NVDA CBA.AX'}`,
    `Twice-daily reads: ${member.paused ? 'paused (/resume)' : 'on (/pause to stop)'}`,
  ].join('\n');
}

/** Members in the one order /members numbers them and /kick and /demote read the number from: by when they joined. */
export function membersInOrder(members: readonly CircleMember[]): CircleMember[] {
  return [...members].sort((a, b) => (a.joinedAt === b.joinedAt ? (a.chatId < b.chatId ? -1 : 1) : a.joinedAt < b.joinedAt ? -1 : 1));
}

/** A member list for the owner: numbered names and roles only - never anyone's tickers or chat. */
export function membersText(members: readonly CircleMember[]): string {
  if (!members.length) return 'No members yet.';
  return [
    `${members.length} in the circle:`,
    ...membersInOrder(members).map((member, index) => `${index + 1}. ${member.name || 'unnamed'}${member.role === 'owner' ? ' (owner)' : ''}${member.paused ? ' - reads paused' : ''}`),
    '',
    '/kick 3 removes number 3; /demote 2 takes an owner back to a member.',
  ].join('\n');
}

/** A feedback note as the owner receives it, as HTML. */
export function feedbackForOwnerHtml(note: { name: string; text: string; via: string; readId: string | null }): string {
  const where = note.via === 'rating' ? 'tapped under a read' : note.via === 'reply' ? 'replied to a read' : note.via === 'conversation' ? 'said in chat' : 'sent with /feedback';
  return `💬 <b>Feedback from ${escapeHtml(note.name || 'a member')}</b> (${where}${note.readId ? `, read ${escapeHtml(note.readId)}` : ''}):\n${escapeHtml(note.text)}`;
}

/** Telegram's limit is 4,096 characters; the owner's listing stays well inside it, measured after escaping. */
const OWNER_LISTING_CHARS = 3_800;
const LISTED_NOTE_CHARS = 400;

/**
 * The owners' view of feedback: how the recent reads were rated (counts only), then the newest notes
 * that fit - each cut to a few hundred characters, whole notes only, never a cut inside a tag.
 */
export function feedbacksHtml(notes: ReadonlyArray<{ name: string; text: string; via: string; readId: string | null }>, ratings: ReadonlyArray<{ readId: string; up: number; down: number }>): string {
  const parts: string[] = [];
  const rated = ratings.filter((entry) => entry.up + entry.down > 0);
  if (rated.length) parts.push(`<b>Recent reads</b>\n${rated.map((entry) => `${escapeHtml(entry.readId)}: 👍 ${entry.up} · 👎 ${entry.down}`).join('\n')}`);
  let length = parts.join('\n\n').length;
  let shown = 0;
  for (const note of notes) {
    const text = note.text.length > LISTED_NOTE_CHARS ? `${note.text.slice(0, LISTED_NOTE_CHARS - 1)}…` : note.text;
    const html = feedbackForOwnerHtml({ ...note, text });
    if (length + html.length + 2 > OWNER_LISTING_CHARS) break;
    parts.push(html);
    length += html.length + 2;
    shown += 1;
  }
  if (!parts.length) return 'No feedback yet.';
  if (shown < notes.length) parts.push(`<i>${notes.length - shown} older note${notes.length - shown === 1 ? '' : 's'} not shown.</i>`);
  return parts.join('\n\n');
}
