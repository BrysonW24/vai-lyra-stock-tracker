/**
 * Demo-mode portfolio persistence.
 *
 * When Supabase isn't configured (demo mode), `/api/portfolio` is a no-op, so holdings
 * entered in onboarding or the Add-holding form have nowhere to live. This stores them
 * in the browser so the command centre can surface the user's real book instead of the
 * static demo holdings. In live (Supabase) mode this is ignored - the DB is the source
 * of truth. Browser-local only; never a secret, never synced.
 */

export interface LocalHolding {
  symbol: string;
  quantity: number;
  averageBuyPrice: number;
  purchaseDate?: string;
  notes?: string;
}

const KEY = 'lyra.portfolio.holdings';

/** Fire after any local-holdings mutation so mounted views re-read without a reload. */
export const PORTFOLIO_CHANGED_EVENT = 'lyra:portfolio-changed';

export function loadLocalHoldings(): LocalHolding[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((h): h is LocalHolding => !!h && typeof (h as LocalHolding).symbol === 'string')
      .map((h) => ({
        symbol: String(h.symbol).toUpperCase().trim(),
        quantity: Number(h.quantity) || 0,
        averageBuyPrice: Number(h.averageBuyPrice) || 0,
        purchaseDate: h.purchaseDate,
        notes: h.notes,
      }))
      .filter((h) => h.symbol.length > 0);
  } catch {
    return [];
  }
}

function persist(holdings: LocalHolding[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(holdings));
    window.dispatchEvent(new Event(PORTFOLIO_CHANGED_EVENT));
  } catch {
    /* storage unavailable - ignore */
  }
}

/** Replace the whole local book (used by onboarding finish). */
export function saveLocalHoldings(holdings: LocalHolding[]): void {
  persist(
    holdings
      .filter((h) => h.symbol && String(h.symbol).trim().length > 0)
      .map((h) => ({
        symbol: String(h.symbol).toUpperCase().trim(),
        quantity: Number(h.quantity) || 0,
        averageBuyPrice: Number(h.averageBuyPrice) || 0,
        purchaseDate: h.purchaseDate,
        notes: h.notes,
      })),
  );
}

/** Add or replace a single holding by symbol (used by the Add-holding form). */
export function addLocalHolding(holding: LocalHolding): void {
  const all = loadLocalHoldings();
  const symbol = holding.symbol.toUpperCase().trim();
  const next = all.filter((h) => h.symbol !== symbol);
  next.push({ ...holding, symbol });
  persist(next);
}
