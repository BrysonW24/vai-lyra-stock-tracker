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

/**
 * Validate a stored/edited primary list against the live section map, dedupe, and clamp to the cap.
 * Pure (the caller supplies the valid-href set + cap) so the shell decision seam is testable (audit
 * V3): a corrupted or over-long saved bar can never render an unknown link, a duplicate, or overflow
 * the rail. Order is preserved for the user's choices.
 */
export function sanitizePrimaries(hrefs: string[], validHrefs: ReadonlySet<string>, max: number): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const href of hrefs) {
    if (validHrefs.has(href) && !seen.has(href)) {
      seen.add(href);
      valid.push(href);
    }
  }
  return valid.slice(0, Math.max(0, max));
}
