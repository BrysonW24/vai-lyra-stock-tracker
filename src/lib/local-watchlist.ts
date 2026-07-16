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
  notes?: string;
}

const KEY = 'lyra.watchlist.items';

/** Fire after any local-watchlist mutation so mounted views re-read without a reload. */
export const WATCHLIST_CHANGED_EVENT = 'lyra:watchlist-changed';

export function loadLocalWatchlist(): LocalWatchItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is LocalWatchItem => !!item && typeof (item as LocalWatchItem).symbol === 'string')
      .map((item) => ({
        symbol: String(item.symbol).toUpperCase().trim(),
        targetBuyPrice: item.targetBuyPrice !== undefined ? Number(item.targetBuyPrice) || undefined : undefined,
        notes: item.notes,
      }))
      .filter((item) => item.symbol.length > 0);
  } catch {
    return [];
  }
}

/** Replace the whole local watchlist (used by onboarding finish). Deduped by symbol. */
export function saveLocalWatchlist(items: LocalWatchItem[]): void {
  if (typeof window === 'undefined') return;
  const seen = new Set<string>();
  const cleaned = items
    .map((item) => ({ ...item, symbol: String(item.symbol).toUpperCase().trim() }))
    .filter((item) => {
      if (!item.symbol || seen.has(item.symbol)) return false;
      seen.add(item.symbol);
      return true;
    });
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cleaned));
    window.dispatchEvent(new Event(WATCHLIST_CHANGED_EVENT));
  } catch {
    /* storage unavailable - ignore */
  }
}
