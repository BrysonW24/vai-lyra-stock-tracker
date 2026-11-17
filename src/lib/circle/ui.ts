/**
 * The circle's words and buttons on Telegram. Plain text unless a renderer escapes its inputs.
 *
 * Tone: a friend who follows markets closely - short, specific, never hype, never advice. The owner
 * is named by their own Telegram first name (from their circle record), never hard-coded here.
 */
import { escapeHtml } from '@/lib/notifications/telegram-templates';
import { CIRCLE_TOPICS, type CircleMember, type CircleTopic } from './store';

export const NOT_ADVICE = 'Research, not financial advice.';

export function ownerLabel(ownerName: string | null): string {
  return ownerName?.trim() ? ownerName.trim() : 'the person who runs this Lyra';
}

export function welcomeText(member: CircleMember, ownerName: string | null): string {
  const hello = member.name ? `Welcome to Lyra, ${member.name}.` : 'Welcome to Lyra.';
  return [
    hello,
    '',
    'I follow the markets for you - Asia, Europe, the US and Australia, tech and chips, small caps and IPOs.',
    '',
    '- Twice a day I send a short read: about 8:45am Sydney (how Wall Street and Europe closed) and about 7:15pm (how Asia closed and Europe opened).',
    '- Ask me anything, any time, in your own words. Only you see this chat.',
    '- Tell me what you hold, like /hold NVDA CBA.AX 005930.KS, and your names come first.',
    `- Anything that sounds like feedback on Lyra goes to ${ownerLabel(ownerName)}. /privacy says exactly what is kept.`,
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
  '/feedback your note - straight to the owner',
  '/pause and /resume - the twice-daily reads',
  '/forget - wipe our conversation',
  '/privacy - what is kept and who sees it',
  '/leave - leave the circle and forget me',
  '',
  NOT_ADVICE,
].join('\n');

export function privacyText(ownerName: string | null): string {
  return [
    'What Lyra keeps about you, and who sees it:',
    '',
    '- Your first name, the topics you follow and the tickers you added. Kept until you /leave.',
    '- The last 12 messages of this chat, so I can follow a conversation. Kept 7 days, or until you send /forget.',
    `- Feedback: what you send with /feedback, a reason you tap under a read, or a message I pick out as feedback on Lyra (I tell you when I do). ${ownerLabel(ownerName)} sees those - and nothing else you write here.`,
    '- Your question, our recent messages and the market figures it needs (including your tickers, never your name) are sent to the free AI service that writes the answer (Groq or Cloudflare, running open-source models). Cloudflare says it does not keep them; Groq keeps logs for up to 30 days and does not train on them.',
    '',
    'Other members never see your chat, your tickers or your feedback.',
  ].join('\n');
}

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

/** A member list for the owner: names and counts only - never anyone's tickers or chat. */
export function membersText(members: readonly CircleMember[]): string {
  if (!members.length) return 'No members yet.';
  return [
    `${members.length} in the circle:`,
    ...members.map((member) => `- ${member.name || 'unnamed'}${member.role === 'owner' ? ' (owner)' : ''}${member.paused ? ' - reads paused' : ''}`),
  ].join('\n');
}

/** A feedback note as the owner receives it, as HTML. */
export function feedbackForOwnerHtml(note: { name: string; text: string; via: string; readId: string | null }): string {
  const where = note.via === 'rating' ? 'tapped under a read' : note.via === 'reply' ? 'replied to a read' : note.via === 'conversation' ? 'said in chat' : 'sent with /feedback';
  return `💬 <b>Feedback from ${escapeHtml(note.name || 'a member')}</b> (${where}${note.readId ? `, read ${escapeHtml(note.readId)}` : ''}):\n${escapeHtml(note.text)}`;
}
