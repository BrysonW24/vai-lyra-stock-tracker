/**
 * The feedback buttons under every message Lyra's workers send - the web app's half. [v0.137.0]
 *
 * The workers attach the first row, 👍 Useful / 👎 Not for me (workers/stock_scanner/feedback.py).
 * A tap reaches the Telegram webhook as a callback_query; this module turns its data into an
 * action and builds the next keyboard:
 *
 *   👍 / 👎            -> six reason chips (the nightly review's pillars) and Skip
 *   a chip or Skip     -> one "✓ Noted · change" button (it keeps the generation id on the
 *                         message, so a later reply can still be matched to it)
 *   change             -> back to 👍 / 👎
 *
 * Both halves read contracts/feedback/telegram-feedback.json, so button text and the data grammar
 * `fb:<generation id>:<step>[:<pillar code>]` cannot drift. All callback data is untrusted input:
 * it is parsed against a closed grammar and a uuid pattern, never interpreted further.
 */
import contract from '../../../contracts/feedback/telegram-feedback.json';

export type Rating = 'up' | 'down';
export type Pillar = 'correctness' | 'relevance' | 'breadth' | 'insight' | 'clarity' | 'freshness';
type Step = 'u' | 'd';

export interface InlineButton {
  text: string;
  callback_data: string;
}
export interface InlineKeyboard {
  inline_keyboard: InlineButton[][];
}

export type FeedbackAction =
  | { kind: 'rate'; generationId: string; rating: Rating }
  | { kind: 'reason'; generationId: string; rating: Rating; pillar: Pillar | null }
  | { kind: 'change'; generationId: string };

export const FEEDBACK_PREFIX: string = contract.prefix;
export const TELEGRAM_ALLOWED_UPDATES: string[] = contract.allowed_updates;
export const PILLAR_NAMES: readonly Pillar[] = ['correctness', 'relevance', 'breadth', 'insight', 'clarity', 'freshness'];
const PILLAR_CODES: Record<string, string> = contract.pillars;
const isPillar = (value: string | undefined): value is Pillar => PILLAR_NAMES.includes(value as Pillar);
const RATING_OF: Record<Step, Rating> = { u: 'up', d: 'down' };
const STEP_OF: Record<Rating, Step> = { up: 'u', down: 'd' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SKIP_CODE = '-';
const CHANGE_STEP = 'c';

/** Parse callback data. Anything outside the closed grammar is null - the caller just stops the spinner. */
export function parseFeedbackData(data: string | undefined | null): FeedbackAction | null {
  if (!data || data.length > 64) return null;
  const parts = data.split(':');
  if (parts[0] !== FEEDBACK_PREFIX || parts.length < 3 || parts.length > 4) return null;
  const [, generationId, step, code] = parts;
  if (!UUID_RE.test(generationId)) return null;
  if (step === CHANGE_STEP && parts.length === 3) return { kind: 'change', generationId };
  if (step !== 'u' && step !== 'd') return null;
  const rating = RATING_OF[step];
  if (parts.length === 3) return { kind: 'rate', generationId, rating };
  if (code === SKIP_CODE) return { kind: 'reason', generationId, rating, pillar: null };
  const pillar = PILLAR_CODES[code];
  return isPillar(pillar) ? { kind: 'reason', generationId, rating, pillar } : null;
}

const data = (...parts: string[]) => [FEEDBACK_PREFIX, ...parts].join(':');

/** The first row - identical to what the workers attach (pinned by a test on both sides). */
export function voteKeyboard(generationId: string): InlineKeyboard {
  return { inline_keyboard: [contract.vote.map((button) => ({ text: button.text, callback_data: data(generationId, button.step) }))] };
}

/** Six reasons in two rows of three, then Skip. */
export function reasonKeyboard(generationId: string, rating: Rating): InlineKeyboard {
  const step = STEP_OF[rating];
  const chips = contract.reasons[step].chips.map(([code, text]) => ({ text, callback_data: data(generationId, step, code) }));
  return { inline_keyboard: [chips.slice(0, 3), chips.slice(3, 6), [{ text: contract.skip, callback_data: data(generationId, step, SKIP_CODE) }]] };
}

/** After a reason: one button that says it was noted, keeps the generation id on the message, and lets the reader change it. */
export function notedKeyboard(generationId: string): InlineKeyboard {
  return { inline_keyboard: [[{ text: contract.noted, callback_data: data(generationId, CHANGE_STEP) }]] };
}

/** The toast Telegram shows for a tap, and the keyboard the message should carry next. */
export function nextStep(action: FeedbackAction): { toast: string; keyboard: InlineKeyboard } {
  switch (action.kind) {
    case 'rate':
      return { toast: contract.reasons[STEP_OF[action.rating]].toast, keyboard: reasonKeyboard(action.generationId, action.rating) };
    case 'reason':
      return { toast: contract.done_toast, keyboard: notedKeyboard(action.generationId) };
    case 'change':
      return { toast: '', keyboard: voteKeyboard(action.generationId) };
  }
}

/**
 * The generation a message belongs to, read from the buttons it still carries. A reply to a Lyra
 * message arrives with that message attached (reply_to_message), keyboard included, so a reply can
 * be filed against the right generation without storing a message-id map anywhere.
 */
export function generationFromMarkup(markup: { inline_keyboard?: Array<Array<{ callback_data?: string }>> } | undefined | null): string | null {
  for (const row of markup?.inline_keyboard ?? []) {
    for (const button of row) {
      const action = parseFeedbackData(button.callback_data);
      if (action) return action.generationId;
    }
  }
  return null;
}

export const NOTE_REPLY: string = contract.note_reply;
export const MAX_NOTE_CHARS = 1_000;
