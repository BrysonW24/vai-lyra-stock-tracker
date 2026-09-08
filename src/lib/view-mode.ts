/**
 * Simple view vs Full view - the one switch that decides how much of Lyra you see.
 *
 * Lyra grew to 56 routes and 40 nav entries. That density is the product for a power
 * user mid-session, and it is a wall for everyone else (founder, 2026-09-09: "I'm not
 * drawn to use it at the moment, and I think that's due to the complexity"). Simple view
 * is the calm front door: your book, what moved, where government money went, the small
 * caps riding it, and which themes are running - then quiet links into the full app.
 *
 * Stored in a COOKIE, not localStorage, so the server renders the right shell on the
 * first paint. A localStorage flag would mean shipping the dense view and then swapping
 * it client-side - the exact flash-of-complexity this feature exists to remove.
 *
 * SIMPLE IS THE DEFAULT (no cookie -> simple). A new visitor should meet the calm
 * version; the dense one is a deliberate step up, not the thing you land in.
 */

export type ViewMode = 'simple' | 'full';

export const VIEW_MODE_COOKIE = 'lyra_view';

/** No stored choice = simple. The founder's decision, 2026-09-09. */
export const DEFAULT_VIEW_MODE: ViewMode = 'simple';

/** One year - a view preference should outlive a browser restart. */
export const VIEW_MODE_MAX_AGE = 60 * 60 * 24 * 365;

/** Narrow any cookie/query string to a ViewMode, falling back to the default. */
export function parseViewMode(raw: string | undefined | null): ViewMode {
  return raw === 'full' ? 'full' : raw === 'simple' ? 'simple' : DEFAULT_VIEW_MODE;
}

/**
 * Simple view's whole nav: the five places the calm front door talks about, plus Home.
 * Deliberately NOT user-customisable - customising the bar is a Full-view power, and the
 * point of Simple is that there is nothing to configure (founder brief, 2026-09-09).
 *
 * Lives here rather than in AppShell so the drift guard in the tests can assert the REAL
 * list resolves to real routes, instead of a copy that can silently disagree with it.
 */
export const SIMPLE_NAV_HREFS = ['/', '/portfolio', '/intelligence', '/awards', '/small-caps', '/themes'] as const;
