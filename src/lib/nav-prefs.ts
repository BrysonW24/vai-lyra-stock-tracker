'use client';

/**
 * Nav preferences - which surfaces the user pins to their bottom bar / rail. Stored locally (no
 * account needed) so a fresh visitor gets sensible defaults and a returning one keeps their choices.
 * The AppShell owns the merge with the section map, the Home-is-always-pinned rule, and the cap; this
 * module is just the storage seam so it can be swapped for a server-synced source later.
 */

const KEY = 'lyra.nav.primaries.v1';

/** The user's pinned primary hrefs, or null when they have never customised (use the defaults). */
export function getPrimaryHrefs(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const hrefs = parsed.filter((h): h is string => typeof h === 'string');
    return hrefs.length ? hrefs : null;
  } catch {
    return null;
  }
}

export function setPrimaryHrefs(hrefs: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(hrefs));
  } catch {
    /* storage unavailable (private mode) - the in-memory choice still holds for this session */
  }
}

/** Forget the user's choices so the bar falls back to the built-in defaults. */
export function clearPrimaryHrefs(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
