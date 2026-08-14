/**
 * Demo-mode watchlist persistence - the missing twin of local-portfolio.ts.
 *
 * When Supabase isn't configured, `/api/watchlist` answers {demo:true} and DROPS the
 * items, so watchlist tickers entered in onboarding silently evaporated (while the
 * getting-started banner still showed "Watchlist done"). This stores them in the
 * browser, exactly like holdings. In live (Supabase) mode this is ignored - the DB is
 * the source of truth. Browser-local only; never a secret, never synced.
 */

export interface LocalWatchItem {
  symbol: string;
  targetBuyPrice?: number;
  /** The user's own signal-score trigger threshold. Absent on rows saved before it was
   *  persisted - buildLocalWatchlistRows falls back to the form's stated default (60). */
  targetSignalScore?: number;
  notes?: string;
}

const KEY = 'lyra.watchlist.items';
const SYMBOL_RE = /^[A-Z0-9.-]{1,12}$/;

/** Fire after any local-watchlist mutation so mounted views re-read without a reload. */
export const WATCHLIST_CHANGED_EVENT = 'lyra:watchlist-changed';

export function loadLocalWatchlist(): LocalWatchItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normaliseWatchItem).filter((item): item is LocalWatchItem => item !== null);
  } catch {
    return [];
  }
}

function normaliseWatchItem(input: unknown): LocalWatchItem | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<LocalWatchItem>;
  const symbol = String(raw.symbol ?? '').toUpperCase().trim();
  if (!SYMBOL_RE.test(symbol)) return null;
  const target = raw.targetBuyPrice === undefined ? undefined : Number(raw.targetBuyPrice);
  const score = raw.targetSignalScore === undefined ? undefined : Number(raw.targetSignalScore);
  return {
    symbol,
    ...(target !== undefined && Number.isFinite(target) && target > 0 ? { targetBuyPrice: target } : {}),
    ...(score !== undefined && Number.isFinite(score) && score > 0 && score <= 100
      ? { targetSignalScore: Math.round(score) }
      : {}),
    ...(typeof raw.notes === 'string' ? { notes: raw.notes.slice(0, 500) } : {}),
  };
}

/** Add or replace a single item by symbol (used by the watch-rule form, chat, and quick actions). */
export function addLocalWatchItem(item: LocalWatchItem): boolean {
  const cleaned = normaliseWatchItem(item);
  if (!cleaned) return false;
  const rest = loadLocalWatchlist().filter((w) => w.symbol !== cleaned.symbol);
  return saveLocalWatchlist([...rest, cleaned]);
}

/** Remove a single item by symbol (local undo path). */
export function removeLocalWatchItem(symbol: string): boolean {
  const upper = String(symbol).toUpperCase().trim();
  return saveLocalWatchlist(loadLocalWatchlist().filter((w) => w.symbol !== upper));
}

/** Replace the whole local watchlist (used by onboarding finish). Deduped by symbol. */
export function saveLocalWatchlist(items: LocalWatchItem[]): boolean {
  if (typeof window === 'undefined') return false;
  const seen = new Set<string>();
  const cleaned = items
    .map(normaliseWatchItem)
    .filter((item): item is LocalWatchItem => item !== null)
    .filter((item) => {
      if (seen.has(item.symbol)) return false;
      seen.add(item.symbol);
      return true;
    });
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cleaned));
    window.dispatchEvent(new Event(WATCHLIST_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}
