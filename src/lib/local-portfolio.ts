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
  /** Brokerage / fees paid, folded into cost basis so Solo P/L matches the worker's
   *  fee-inclusive cost base (audit V4 fix). Optional; older stored books omit it. */
  brokerageFee?: number;
  purchaseDate?: string;
  notes?: string;
}

const KEY = 'lyra.portfolio.holdings';
const SYMBOL_RE = /^[A-Z0-9.-]{1,12}$/;

/** Fire after any local-holdings mutation so mounted views re-read without a reload. */
export const PORTFOLIO_CHANGED_EVENT = 'lyra:portfolio-changed';

export function loadLocalHoldings(): LocalHolding[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normaliseHolding).filter((h): h is LocalHolding => h !== null);
  } catch {
    return [];
  }
}

function normaliseHolding(input: unknown): LocalHolding | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<LocalHolding>;
  const symbol = String(raw.symbol ?? '').toUpperCase().trim();
  const quantity = Number(raw.quantity);
  const averageBuyPrice = Number(raw.averageBuyPrice);
  if (
    !SYMBOL_RE.test(symbol) ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(averageBuyPrice) ||
    averageBuyPrice < 0
  ) {
    return null;
  }
  const brokerageFee = Number(raw.brokerageFee);
  return {
    symbol,
    quantity,
    averageBuyPrice,
    ...(Number.isFinite(brokerageFee) && brokerageFee > 0 ? { brokerageFee } : {}),
    ...(typeof raw.purchaseDate === 'string' ? { purchaseDate: raw.purchaseDate.slice(0, 32) } : {}),
    ...(typeof raw.notes === 'string' ? { notes: raw.notes.slice(0, 500) } : {}),
  };
}

function persist(holdings: LocalHolding[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(holdings));
    window.dispatchEvent(new Event(PORTFOLIO_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** Replace the whole local book (used by onboarding finish). */
export function saveLocalHoldings(holdings: LocalHolding[]): boolean {
  return persist(holdings.map(normaliseHolding).filter((h): h is LocalHolding => h !== null));
}

/** Add or replace a single holding by symbol (used by the Add-holding form). */
export function addLocalHolding(holding: LocalHolding): boolean {
  const cleaned = normaliseHolding(holding);
  if (!cleaned) return false;
  const all = loadLocalHoldings();
  const next = all.filter((h) => h.symbol !== cleaned.symbol);
  next.push(cleaned);
  return persist(next);
}

/** Remove a single holding by symbol (local undo path). */
export function removeLocalHolding(symbol: string): boolean {
  const upper = String(symbol).toUpperCase().trim();
  return persist(loadLocalHoldings().filter((h) => h.symbol !== upper));
}
