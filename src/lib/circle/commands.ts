/**
 * What a circle member's message asks for - pure, no I/O.
 *
 * A message is either one of a closed set of commands or a question for the chat. Every string is
 * untrusted: commands are matched against a fixed table, tickers against a fixed shape, and free
 * text is handed to the chat as the reader's question - data, never instructions (the chat screens
 * it for injection before any model sees it).
 *
 * The /start deep links that bring someone in are `c<invite code>` (a friend) and `o<owner code>`
 * (the founder). The subscribe and pairing flows own `s` and `p` (src/lib/subscribe.ts).
 */
import { QUOTE_SYMBOL_RE } from '@/lib/world/fetch';
import { MAX_HOLDINGS } from './store';

export const CIRCLE_START_PREFIX = { invite: 'c', owner: 'o' } as const;

export type CircleCommand =
  | { kind: 'help' }
  | { kind: 'world' }
  | { kind: 'read' }
  | { kind: 'me' }
  | { kind: 'topics' }
  | { kind: 'hold'; symbols: string[]; rejected: string[] }
  | { kind: 'drop'; symbols: string[] }
  | { kind: 'forget' }
  | { kind: 'feedback'; text: string }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'leave' }
  | { kind: 'privacy' }
  | { kind: 'members' }
  | { kind: 'feedbacks' }
  | { kind: 'invite' }
  | { kind: 'announce'; text: string }
  | { kind: 'ask'; text: string }
  | { kind: 'unknown'; name: string };

const SIMPLE: Record<string, CircleCommand['kind']> = {
  help: 'help',
  start: 'help',
  world: 'world',
  markets: 'world',
  read: 'read',
  update: 'read',
  me: 'me',
  topics: 'topics',
  follow: 'topics',
  forget: 'forget',
  pause: 'pause',
  stop: 'pause',
  resume: 'resume',
  leave: 'leave',
  privacy: 'privacy',
  members: 'members',
  feedbacks: 'feedbacks',
  invite: 'invite',
};

/** Free text and feedback are kept to this many characters - a question, not an essay. */
export const MAX_TEXT_CHARS = 1_000;

/** "NVDA, cba.ax $TSLA 005930.KS" -> upper-cased, de-duplicated tickers, with the ones that are not tickers set aside. */
export function parseSymbols(text: string): { symbols: string[]; rejected: string[] } {
  const symbols: string[] = [];
  const rejected: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const token = raw.replace(/^\$/, '').trim().toUpperCase();
    if (!token) continue;
    if (QUOTE_SYMBOL_RE.test(token)) {
      if (!symbols.includes(token)) symbols.push(token);
    } else if (rejected.length < 5) rejected.push(raw.slice(0, 16));
  }
  return { symbols: symbols.slice(0, MAX_HOLDINGS), rejected };
}

/** The bare words people use to stop messages - honoured as a pause of the scheduled reads. */
const STOP_WORDS = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL']);

export function parseCircleMessage(text: string): CircleCommand {
  const trimmed = text.trim().slice(0, MAX_TEXT_CHARS);
  if (!trimmed.startsWith('/')) {
    if (STOP_WORDS.has(trimmed.replace(/[\s.!]+$/u, '').toUpperCase())) return { kind: 'pause' };
    return { kind: 'ask', text: trimmed };
  }
  const [head = '', ...rest] = trimmed.slice(1).split(/\s+/);
  const name = (head.split('@')[0] ?? '').toLowerCase();
  const args = rest.join(' ').trim();
  if (name === 'hold' || name === 'add') {
    const { symbols, rejected } = parseSymbols(args);
    return { kind: 'hold', symbols, rejected };
  }
  if (name === 'drop' || name === 'remove') return { kind: 'drop', symbols: parseSymbols(args).symbols };
  if (name === 'feedback' || name === 'idea' || name === 'bug') return { kind: 'feedback', text: args };
  if (name === 'announce') return { kind: 'announce', text: args };
  if (name === 'ask') return args ? { kind: 'ask', text: args } : { kind: 'help' };
  const simple = SIMPLE[name];
  if (simple) return { kind: simple } as CircleCommand;
  return { kind: 'unknown', name: name.slice(0, 32) };
}

/** A /start argument for the circle: which flow, and the code it carries (bounded, never logged). */
export function circleStartFlow(args: string): { flow: 'invite' | 'owner'; code: string } | null {
  const value = args.trim();
  if (value.length < 2 || value.length > 64) return null;
  if (value[0] === CIRCLE_START_PREFIX.invite) return { flow: 'invite', code: value.slice(1) };
  if (value[0] === CIRCLE_START_PREFIX.owner) return { flow: 'owner', code: value.slice(1) };
  return null;
}

// --- button data: `cl:` + a closed grammar, at most 64 bytes ---------------------------------

export type CircleTap =
  | { kind: 'topic'; topic: string }
  | { kind: 'topics_done' }
  | { kind: 'rate'; readId: string; rating: 'u' | 'd' }
  | { kind: 'why'; readId: string; reason: string };

const READ_ID_RE = /^[me]\d{8}$/;
const REASONS = new Set(['long', 'short', 'late', 'wrong', 'more', 'other']);

export function parseCircleTap(data: string | undefined): CircleTap | null {
  if (!data || !data.startsWith('cl:') || data.length > 64) return null;
  const parts = data.split(':');
  if (parts[1] === 't' && parts[2] && /^[a-z_]{2,16}$/.test(parts[2])) return { kind: 'topic', topic: parts[2] };
  if (parts[1] === 'td' && parts.length === 2) return { kind: 'topics_done' };
  if (parts[1] === 'r' && parts[2] && READ_ID_RE.test(parts[2]) && (parts[3] === 'u' || parts[3] === 'd')) return { kind: 'rate', readId: parts[2], rating: parts[3] };
  if (parts[1] === 'y' && parts[2] && READ_ID_RE.test(parts[2]) && parts[3] && REASONS.has(parts[3])) return { kind: 'why', readId: parts[2], reason: parts[3] };
  return null;
}

/** A read's id: its kind's initial and its Sydney date, e.g. m20261118. */
export function readIdFor(kind: 'morning' | 'evening', sydneyDate: string): string {
  return `${kind === 'morning' ? 'm' : 'e'}${sydneyDate.replace(/-/g, '')}`;
}
