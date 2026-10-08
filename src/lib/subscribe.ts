/**
 * The subscribe-by-link flow's shapes and pure rules - client-safe (the form imports this; the
 * signing, the store and the senders live in subscribe-server.ts / subscribe-store.ts).
 *
 * Three questions, no account: what you hold, which topics, where to send it. Topics mirror the
 * worker's briefing categories (workers/stock_scanner/briefing_guard.py CATEGORIES) plus
 * 'holdings' = only the items that touch what I hold. Holdings are symbols as typed; the worker
 * matches them against each item's ticker and Lyra tags - nothing here looks a symbol up or
 * prices it, so a typo costs nothing and invents nothing.
 */

export type SubscribeChannel = 'telegram' | 'email';

export const SUBSCRIBE_TOPICS = [
  { id: 'ai_release', label: 'AI releases', blurb: 'New models and products from the labs' },
  { id: 'investment', label: 'Deals and listings', blurb: 'Funding, M&A, IPOs, earnings, contracts' },
  { id: 'infrastructure', label: 'Infrastructure', blurb: 'Chips, memory, networking, data centres, power' },
  { id: 'emerging', label: 'Emerging companies', blurb: 'Private names worth knowing before they list' },
  { id: 'developer', label: 'Developer tools', blurb: 'APIs, agents and platforms builders use' },
  { id: 'holdings', label: 'Just my holdings', blurb: 'Only the items that touch what I hold' },
] as const;

export type SubscribeTopic = (typeof SUBSCRIBE_TOPICS)[number]['id'];

const TOPIC_IDS: ReadonlySet<string> = new Set(SUBSCRIBE_TOPICS.map((topic) => topic.id));

export const MAX_HOLDINGS = 20;
/** A ticker as people type it: NVDA, BRK.B, RIO.AX, QQQ. Upper-cased before the check. */
const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;

/** The deep-link start parameter says which flow a /start belongs to: a subscriber token or an account pairing code. */
export const TELEGRAM_START_PREFIX = { subscriber: 's', pairing: 'p' } as const;

/** Symbols from a text box or a list: split on commas and whitespace, drop a leading $, upper-case, dedupe, cap. */
export function normaliseHoldings(raw: unknown): string[] {
  const parts = Array.isArray(raw)
    ? raw.filter((value): value is string => typeof value === 'string')
    : typeof raw === 'string'
      ? raw.split(/[\s,;]+/)
      : [];
  const seen = new Set<string>();
  for (const part of parts) {
    const symbol = part.trim().replace(/^\$/, '').toUpperCase();
    if (symbol && SYMBOL_RE.test(symbol)) seen.add(symbol);
    if (seen.size >= MAX_HOLDINGS) break;
  }
  return [...seen];
}

/** Only known topic ids, in the order given, each once. */
export function normaliseTopics(raw: unknown): SubscribeTopic[] {
  if (!Array.isArray(raw)) return [];
  const out: SubscribeTopic[] = [];
  for (const value of raw) {
    if (typeof value === 'string' && TOPIC_IDS.has(value) && !out.includes(value as SubscribeTopic)) out.push(value as SubscribeTopic);
  }
  return out;
}

/** A plausible address, lower-cased by the caller. Deliverability is proven by the confirmation link, not here. */
export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** The button a Telegram subscriber taps: Telegram opens the bot and sends `/start s<token>` for them. */
export function telegramDeepLink(botUsername: string, token: string): string {
  return `https://t.me/${botUsername.replace(/^@/, '')}?start=${TELEGRAM_START_PREFIX.subscriber}${token}`;
}

/** Plain-language summary of a subscription for confirmation copy. */
export function describeSubscription(topics: readonly string[], holdings: readonly string[]): string {
  const labels = SUBSCRIBE_TOPICS.filter((topic) => topics.includes(topic.id)).map((topic) => topic.label.toLowerCase());
  const what = labels.length ? labels.join(', ') : 'everything in the briefing';
  return holdings.length ? `${what}, with ${holdings.join(', ')} flagged first` : what;
}
