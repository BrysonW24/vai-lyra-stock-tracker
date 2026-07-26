/**
 * Demo -> account carryover snapshot.
 *
 * When a visitor explores the read-only demo tour on a CONFIGURED (prod) deployment, they build a
 * full setup - strategy, market universe, watchlist, portfolio, capital, alert preferences - that
 * is saved locally (the tour is session-less, so nothing hits the cloud). This snapshot preserves
 * that ENTIRE setup across the sign-up boundary so the account onboarding can rehydrate it in one
 * tap, instead of forcing a from-scratch (or holdings-only) re-entry.
 *
 * It is deliberately distinct from onboarding-progress (a resume checkpoint that is CLEARED on
 * completion): this snapshot is written AT demo completion and SURVIVES, until a real account save
 * consumes and clears it. Per-device localStorage; the durable per-user mirror is the account.
 *
 * Only meaningful on a configured deployment - the Solo (unconfigured) build has no account to
 * carry into, so callers gate on isSupabaseConfigured() before writing.
 */
import type { OnboardingState } from '@/lib/onboarding';

const KEY = 'lyra_demo_carryover_v1';

interface CarryoverEnvelope {
  savedAt: string;
  state: OnboardingState;
}

/** Snapshot the full onboarding state. Returns false if storage is unavailable (private mode/quota). */
export function saveDemoCarryover(state: OnboardingState, savedAt: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const envelope: CarryoverEnvelope = { savedAt, state };
    window.localStorage.setItem(KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the snapshot back. Returns null when absent or shape-invalid - the two required arrays
 * (watchlist, portfolio) must be present, so a corrupt/partial value degrades to "no carryover"
 * rather than crashing the onboarding mount.
 */
export function loadDemoCarryover(): OnboardingState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CarryoverEnvelope>;
    const state = parsed?.state as OnboardingState | undefined;
    if (!state || !Array.isArray(state.watchlist) || !Array.isArray(state.portfolio) || typeof state.path !== 'string') {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

/** Cheap presence check for the mount branch. */
export function hasDemoCarryover(): boolean {
  return loadDemoCarryover() !== null;
}

/** Drop the snapshot once a real account save has consumed it (or on an explicit reset). */
export function clearDemoCarryover(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* best-effort: a failed clear is harmless, the next real save clears again */
  }
}
