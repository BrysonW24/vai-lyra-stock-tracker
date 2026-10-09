/**
 * The AI briefing's shapes and the pure mapping from a stored run row to a briefing. Client-safe:
 * no Supabase, no `next/headers` - the client component imports this; the server read lives in
 * briefing-live.ts (same split as intelligence.ts / intelligence-live.ts).
 *
 * The worker (workers/stock_scanner/ai_briefing.py) stores the checked items on the
 * `stock_scanner_runs` row's payload; this maps what it stored and nothing more - a row that does
 * not parse is skipped, never patched, and a source that is not a web address is not a link.
 *
 * Since v0.136.0 the briefing's spine is the app's own themes (the /themes pages: the slugs here
 * are pinned equal to src/lib/generated/themes.json by a test) plus four standing desks that print
 * every evening - IPOs and filings, venture, government money, small caps - with the model's
 * one-line note when a desk has no item.
 */

export type BriefingTheme =
  | 'agi-infrastructure'
  | 'semiconductors'
  | 'power-grid'
  | 'nuclear-uranium'
  | 'critical-minerals'
  | 'robotics-automation'
  | 'quantum-computing'
  | 'space-economy'
  | 'defence-drones'
  | 'cybersecurity'
  | 'other';

export type BriefingDesk = 'news' | 'ipo' | 'venture' | 'government' | 'small_cap';
export type StandingDesk = Exclude<BriefingDesk, 'news'>;

/** Reading order of the sections - the briefing's own, not the themes page's. */
export const BRIEFING_THEME_STYLE: Record<BriefingTheme, { emoji: string; label: string }> = {
  'agi-infrastructure': { emoji: '🤖', label: 'AI labs and infrastructure' },
  semiconductors: { emoji: '💾', label: 'Semiconductors' },
  'power-grid': { emoji: '⚡', label: 'Power grid' },
  'nuclear-uranium': { emoji: '☢️', label: 'Nuclear and uranium' },
  'critical-minerals': { emoji: '⛏️', label: 'Critical minerals' },
  'robotics-automation': { emoji: '🦾', label: 'Robotics and automation' },
  'quantum-computing': { emoji: '⚛️', label: 'Quantum computing' },
  'space-economy': { emoji: '🚀', label: 'Space economy' },
  'defence-drones': { emoji: '🛡️', label: 'Defence and drones' },
  cybersecurity: { emoji: '🔐', label: 'Cybersecurity' },
  other: { emoji: '🧭', label: 'Elsewhere in tech' },
};

export const BRIEFING_DESK_STYLE: Record<StandingDesk, { emoji: string; label: string }> = {
  ipo: { emoji: '📜', label: 'IPOs and filings' },
  venture: { emoji: '💸', label: 'Venture' },
  government: { emoji: '🏛️', label: 'Government money' },
  small_cap: { emoji: '🔬', label: 'Small caps' },
};

export const BRIEFING_THEMES = Object.keys(BRIEFING_THEME_STYLE) as BriefingTheme[];
export const STANDING_DESKS = Object.keys(BRIEFING_DESK_STYLE) as StandingDesk[];
export const DEFAULT_DESK_NOTE = 'Nothing new found tonight.';

const THEMES: ReadonlySet<string> = new Set(BRIEFING_THEMES);
const DESKS: ReadonlySet<string> = new Set<BriefingDesk>(['news', ...STANDING_DESKS]);

export interface BriefingSource {
  label: string;
  url: string;
}

export interface BriefingItem {
  headline: string;
  theme: BriefingTheme;
  desk: BriefingDesk;
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
  /** The model's one-line note per standing desk ('' when it wrote none - the view prints the default). */
  deskNotes: Record<StandingDesk, string>;
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

/** One stored item, or null when it lacks what a reader must see. A label is never a reason to lose
 * a checked item: an unknown theme files under "other", an unknown desk is ordinary news. */
export function itemFromPayload(raw: unknown): BriefingItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const headline = text(record.headline);
  const whatHappened = text(record.what_happened);
  const whyItMatters = text(record.why_it_matters);
  const risks = text(record.risks);
  if (!headline || !whatHappened || !whyItMatters || !risks) return null;
  const sources = Array.isArray(record.sources) ? record.sources.map(sourceFrom).filter((s): s is BriefingSource => s !== null) : [];
  if (sources.length === 0) return null;
  const symbols = Array.isArray(record.lyra_symbols) ? record.lyra_symbols.map(text).filter((s) => /^[A-Z0-9.\-]{1,10}$/.test(s)) : [];
  const theme = text(record.theme).toLowerCase();
  const desk = text(record.desk).toLowerCase();
  return {
    headline,
    theme: THEMES.has(theme) ? (theme as BriefingTheme) : 'other',
    desk: DESKS.has(desk) ? (desk as BriefingDesk) : 'news',
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

/** The desk notes as stored (a row from before v0.136.0 carried a single ipo_note). */
export function deskNotesFromPayload(payload: Record<string, unknown>): Record<StandingDesk, string> {
  const raw = payload.desk_notes && typeof payload.desk_notes === 'object' ? (payload.desk_notes as Record<string, unknown>) : {};
  const notes = Object.fromEntries(STANDING_DESKS.map((desk) => [desk, text(raw[desk])])) as Record<StandingDesk, string>;
  if (!notes.ipo) notes.ipo = text(payload.ipo_note);
  return notes;
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
    deskNotes: deskNotesFromPayload(payload),
    model: text(payload.model),
    effort: text(payload.effort),
    searches: count(payload.searches),
    pagesOpened: count(payload.fetches),
    costUsd: typeof cost === 'number' && Number.isFinite(cost) ? cost : null,
    removed: count(payload.removed),
  };
}

export interface BriefingSection {
  kind: 'theme' | 'desk';
  id: BriefingTheme | StandingDesk;
  emoji: string;
  label: string;
  items: BriefingItem[];
  /** The desk's note when it has no items. */
  note: string;
}

/** The same grouping the messages use: a section per theme that has items, in the briefing's order,
 * then every standing desk - its items, or its note. An item on a desk is not repeated under its theme. */
export function briefingSections(briefing: Briefing): BriefingSection[] {
  const onDesk = new Set<string>(STANDING_DESKS);
  const byTheme = briefing.items.filter((item) => !onDesk.has(item.desk));
  const sections: BriefingSection[] = [];
  for (const theme of BRIEFING_THEMES) {
    const items = byTheme.filter((item) => item.theme === theme);
    if (items.length) sections.push({ kind: 'theme', id: theme, ...BRIEFING_THEME_STYLE[theme], items, note: '' });
  }
  for (const desk of STANDING_DESKS) {
    const items = briefing.items.filter((item) => item.desk === desk);
    sections.push({ kind: 'desk', id: desk, ...BRIEFING_DESK_STYLE[desk], items, note: items.length ? '' : briefing.deskNotes[desk] || DEFAULT_DESK_NOTE });
  }
  return sections;
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
