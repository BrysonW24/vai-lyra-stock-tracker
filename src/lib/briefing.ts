/**
 * The AI briefing's shapes and the pure mapping from a stored run row to a briefing. Client-safe:
 * no Supabase, no `next/headers` - the client component imports this; the server read lives in
 * briefing-live.ts (same split as intelligence.ts / intelligence-live.ts).
 *
 * The worker (workers/stock_scanner/ai_briefing.py) stores the checked items on the
 * `stock_scanner_runs` row's payload; this maps what it stored and nothing more - a row that does
 * not parse is skipped, never patched, and a source that is not a web address is not a link.
 */

export type BriefingCategory = 'investment' | 'infrastructure' | 'ai_release' | 'emerging' | 'developer';

export const BRIEFING_CATEGORY_STYLE: Record<BriefingCategory, { emoji: string; label: string }> = {
  investment: { emoji: '💰', label: 'Investment' },
  infrastructure: { emoji: '⚡', label: 'Infrastructure' },
  ai_release: { emoji: '🧠', label: 'AI release' },
  emerging: { emoji: '🌱', label: 'Emerging' },
  developer: { emoji: '🛠️', label: 'Developer' },
};

const CATEGORIES: ReadonlySet<string> = new Set<BriefingCategory>(Object.keys(BRIEFING_CATEGORY_STYLE) as BriefingCategory[]);

export interface BriefingSource {
  label: string;
  url: string;
}

export interface BriefingItem {
  headline: string;
  category: BriefingCategory;
  listed: boolean;
  exchange: string;
  ticker: string;
  whatHappened: string;
  whyItMatters: string;
  risks: string;
  notDisclosed: string;
  sources: BriefingSource[];
  lyraSymbols: string[];
  catchUp: boolean;
}

export interface Briefing {
  /** The reader-local date the briefing is for (yyyy-mm-dd). */
  date: string;
  generatedAt: string | null;
  items: BriefingItem[];
  ipoNote: string;
  model: string;
  effort: string;
  searches: number;
  pagesOpened: number;
  costUsd: number | null;
  /** Items the worker's checks removed before anyone saw them. */
  removed: number;
}

/** A row from public.stock_scanner_runs as the briefing page selects it. */
export interface BriefingRunRow {
  started_at?: string | null;
  finished_at?: string | null;
  payload?: unknown;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

/** Only a web address can be a source link; anything else is dropped rather than rendered. */
function sourceFrom(raw: unknown): BriefingSource | null {
  if (!raw || typeof raw !== 'object') return null;
  const url = text((raw as { url?: unknown }).url);
  if (!/^https?:\/\/\S+$/i.test(url)) return null;
  return { label: text((raw as { label?: unknown }).label) || 'Source', url };
}

/** One stored item, or null when it lacks what a reader must see. */
export function itemFromPayload(raw: unknown): BriefingItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const headline = text(record.headline);
  const whatHappened = text(record.what_happened);
  const whyItMatters = text(record.why_it_matters);
  const risks = text(record.risks);
  const category = text(record.category);
  if (!headline || !whatHappened || !whyItMatters || !risks || !CATEGORIES.has(category)) return null;
  const sources = Array.isArray(record.sources) ? record.sources.map(sourceFrom).filter((s): s is BriefingSource => s !== null) : [];
  if (sources.length === 0) return null;
  const symbols = Array.isArray(record.lyra_symbols) ? record.lyra_symbols.map(text).filter((s) => /^[A-Z0-9.\-]{1,10}$/.test(s)) : [];
  return {
    headline,
    category: category as BriefingCategory,
    listed: record.listed === true,
    exchange: text(record.exchange),
    ticker: text(record.ticker).toUpperCase(),
    whatHappened,
    whyItMatters,
    risks,
    notDisclosed: text(record.not_disclosed),
    sources,
    lyraSymbols: Array.from(new Set(symbols)),
    catchUp: record.catch_up === true,
  };
}

/** One stored briefing, or null when the row holds no delivered briefing. */
export function briefingFromRow(row: BriefingRunRow): Briefing | null {
  const payload = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : null;
  if (!payload) return null;
  const date = text(payload.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const items = Array.isArray(payload.items) ? payload.items.map(itemFromPayload).filter((item): item is BriefingItem => item !== null) : [];
  if (items.length === 0) return null;
  const cost = payload.cost_usd;
  return {
    date,
    generatedAt: text(row.finished_at) || text(row.started_at) || null,
    items,
    ipoNote: text(payload.ipo_note),
    model: text(payload.model),
    effort: text(payload.effort),
    searches: count(payload.searches),
    pagesOpened: count(payload.fetches),
    costUsd: typeof cost === 'number' && Number.isFinite(cost) ? cost : null,
    removed: count(payload.removed),
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Wed 7 Oct" from yyyy-mm-dd - spelled here, not by a locale (Node's en-AU adds a comma), and
 * without a timezone shift: the date is already the reader's. */
export function briefingDayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime()) || !MONTHS[month - 1]) return date;
  return `${WEEKDAYS[parsed.getUTCDay()]} ${day} ${MONTHS[month - 1]}`;
}
