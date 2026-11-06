/**
 * The offer that goes with a confirm card, written by code.
 *
 * With actions switched on, a reader can ask Lyra to add a ticker to their watchlist or portfolio;
 * the model proposes it and the reader confirms on a card. A model asked to do that tends to answer
 * "Add NVDA to your watchlist? Tap confirm below." - which, word for word, is an instruction to act
 * on a named stock, and the advice guard stops the whole answer. No wording rule could tell that
 * sentence from "Add NVDA to your watchlist and go long" without being talked around (three review
 * passes tried), so the guard stays strict and the offer is not left to the model: when its wording
 * is stopped and the reader asked for the action in so many words, chat shows this text with the
 * card instead of a refusal.
 *
 * Two limits keep that from becoming a way around the guard:
 *   * ONLY RECORD-KEEPING ACTIONS. Adding a ticker to a watchlist, or recording a holding the
 *     reader already has. Never a buy: a "log a $5,000 buy" card whose amount the model chose,
 *     shown after the guard stopped the model's advice, would be a position size delivered by code.
 *     (A reader who types "log a $1,500 buy in AMD" is handled before any model is asked.)
 *   * ONLY WHAT WAS ASKED FOR. The reader's own message must name the ticker AND say where it is to
 *     go. "Should I add NVDA?" names no watchlist and no portfolio, so nothing is offered.
 */
export interface OfferedAction {
  type: 'add_watchlist' | 'add_portfolio';
  symbol: string;
}

/** Tickers are letters, digits, dots and hyphens; only the dot means something to a regex. */
const literal = (symbol: string) => symbol.toUpperCase().replaceAll('.', '\\.');

/** What the reader must have said, in their own words, for each action to count as asked for. */
const ASKED_FOR: Record<OfferedAction['type'], RegExp> = {
  // "add NVDA to my watchlist", "watch NVDA", "track NVDA", "alert me on NVDA"
  add_watchlist: /\b(?:WATCH ?LIST|WATCH|TRACK|ALERTS?)\b/,
  // "add NVDA to my portfolio", "put NVDA in my holdings", "record NVDA in my book"
  // (within one sentence - a full stop inside a ticker such as BRK.B does not end it)
  add_portfolio: /\b(?:ADD|PUT|SAVE|RECORD|TRACK)\b(?:[^.?!]|\.(?=\S))*\b(?:PORTFOLIO|HOLDINGS?|MY BOOK)\b/,
};

/**
 * A message that asks WHETHER to, or says not to, is not a request to do it. "Should I add NVDA to
 * my portfolio?" is a question the guard has just stopped the model answering; a card offering to
 * add it would read like a yes.
 */
const NOT_A_REQUEST = /\b(?:SHOULD (?:I|WE)|SHALL (?:I|WE)|OUGHT|DO YOU THINK|IS IT|WORTH|WHETHER|DON'?T|DO NOT|NOT|NEVER)\b/;

/** Whether an action is one that code may offer at all - a buy never is. */
export function isOfferable(action: { type: string; symbol: string }): action is OfferedAction {
  return action.type === 'add_watchlist' || action.type === 'add_portfolio';
}

/**
 * The reader asked, in so many words, for this app action on this ticker: their message names the
 * ticker and says where it is to go. A proposal the reader did not ask for is never offered.
 */
export function explicitlyAsked(question: string, action: OfferedAction): boolean {
  if (!/^[A-Za-z0-9.-]{1,12}$/.test(action.symbol)) return false;
  const asked = question.toUpperCase().replaceAll('’', "'");
  if (NOT_A_REQUEST.test(asked)) return false;
  const named = new RegExp(`(?<![A-Z0-9.])${literal(action.symbol)}(?![A-Z0-9])`).test(asked);
  return named && ASKED_FOR[action.type].test(asked);
}

/** First person, about the app, never about the stock - so it reads as an offer and passes the guard. */
export function offerText(action: OfferedAction): string {
  if (action.type === 'add_watchlist') return `I can add ${action.symbol} to your watchlist. Confirm below and it is done - you can undo it.`;
  return `I can add ${action.symbol} to your portfolio so Lyra tracks it. Enter the quantity and your buy price below, then confirm - you can undo it.`;
}
