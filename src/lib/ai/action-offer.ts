/**
 * The offer that goes with a confirm card, written by code.
 *
 * With actions switched on, a reader can ask Lyra to add a ticker to their watchlist or portfolio,
 * or to log a buy; the model proposes it and the reader confirms on a card. A model asked to do
 * that tends to answer "Add NVDA to your watchlist? Tap confirm below." - which, word for word, is
 * an instruction to act on a named stock, and the advice guard stops the whole answer. No wording
 * rule could tell that sentence from "Add NVDA to your watchlist and go long" without being talked
 * around (three review passes tried), so the guard stays strict and the offer is not left to the
 * model: when its wording is stopped and the reader asked for the action in so many words, chat
 * shows this text with the card instead of a refusal.
 */
export interface OfferedAction {
  type: 'add_watchlist' | 'add_portfolio' | 'log_trade';
  symbol: string;
  notional?: number;
}

const usd = (amount: number) => `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** Tickers are letters, digits, dots and hyphens; only the dot means something to a regex. */
const literal = (symbol: string) => symbol.toUpperCase().replaceAll('.', '\\.');

/**
 * The reader asked, in so many words, for an app action on this ticker: their message names the
 * ticker and uses one of the verbs the actions answer to. A proposal the reader did not ask for is
 * never offered this way.
 */
export function explicitlyAsked(question: string, action: OfferedAction): boolean {
  if (!/^[A-Za-z0-9.-]{1,12}$/.test(action.symbol)) return false;
  const asked = question.toUpperCase();
  const named = new RegExp(`(?<![A-Z0-9.])${literal(action.symbol)}(?![A-Z0-9])`).test(asked);
  return named && /\b(?:ADD|TRACK|WATCH|SAVE|LOG|PUT)\b/.test(asked);
}

/** First person, about the app, never about the stock - so it reads as an offer and passes the guard. */
export function offerText(action: OfferedAction): string {
  if (action.type === 'add_watchlist') return `I can add ${action.symbol} to your watchlist. Confirm below and it is done - you can undo it.`;
  if (action.type === 'add_portfolio') {
    return `I can add ${action.symbol} to your portfolio so Lyra tracks it. Enter the quantity and your buy price below, then confirm - you can undo it.`;
  }
  return `I can log a ${usd(action.notional ?? 0)} buy in ${action.symbol}. Confirm below - Lyra re-prices it at the live quote, and you can undo it.`;
}
