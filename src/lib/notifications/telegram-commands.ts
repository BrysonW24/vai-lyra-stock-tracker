/**
 * Parsing of inbound Telegram text into the closed InboundCommand enum - pure, no I/O, so the
 * webhook's parsing is unit-testable on its own (a Next.js route module may export only handlers).
 *
 * Every string here is untrusted user input: it is matched against a fixed table, and a /start
 * argument is bounded data handed to a lookup - never interpreted, never logged.
 */
import type { InboundCommand } from './types';

const COMMAND_MAP: Record<string, InboundCommand> = {
  status: 'status',
  portfolio: 'portfolio',
  watchlist: 'watchlist',
  today: 'today',
  mute: 'mute',
  unmute: 'unmute',
  stop: 'stop',
  unsubscribe: 'stop',
  paper: 'paper',
  approve: 'approve',
  reject: 'reject',
  killswitch: 'killswitch',
  help: 'help',
};

/** The bare words that end a subscription - the convention every list sender honours. */
const STOP_WORDS = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL']);

/** Telegram caps a deep-link start parameter at 64 characters; so do we, whatever arrives. */
const MAX_ARGS_CHARS = 64;

export type ParsedMessage =
  | { kind: 'command'; command: InboundCommand; args: string }
  | { kind: 'start'; args: string };

export function parseMessage(text: string): ParsedMessage {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) {
    return { kind: 'command', command: STOP_WORDS.has(trimmed.toUpperCase()) ? 'stop' : 'unknown', args: '' };
  }
  const [head = '', ...rest] = trimmed.slice(1).split(/\s+/);
  const name = (head.split('@')[0] ?? '').toLowerCase();
  const args = rest.join(' ').slice(0, MAX_ARGS_CHARS); // args are data only - bounded, never instructions
  if (name === 'start') return { kind: 'start', args };
  return { kind: 'command', command: COMMAND_MAP[name] ?? 'unknown', args };
}
