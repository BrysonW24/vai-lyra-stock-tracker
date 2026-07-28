/**
 * Command-centre layout state. The section *order* lives in the page (the order the
 * sections array is built in = the default), this module owns the human labels, the
 * default-hidden set, and the persisted per-device overrides (reorder + hide).
 */
export interface CommandLayoutState {
  order: string[];
  hidden: string[];
}

export const COMMAND_LAYOUT_KEY = 'lyra.commandLayout.v1';

/** Human labels for the reorder panel. */
export const COMMAND_SECTION_LABELS: Record<string, string> = {
  runners: 'Watchlist leaders',
  'daily-brief': 'Daily brief',
  metrics: 'Metric tiles',
  context: 'Market context tapes',
  prime: 'Prime setups',
  countdown: 'Big moments',
  signals: 'Signals',
  charts: 'Holdings momentum',
  catalysts: 'Catalyst radar',
  watchlist: 'Watchlist triggers',
  'portfolio-exposure': 'Portfolio exposure',
  'compact-feed': 'Compact ticker feed',
  strongest: 'Strongest setups',
};

/** Sections hidden by default - secondary signal tables the founder did not prioritise. */
export const DEFAULT_HIDDEN = ['compact-feed', 'strongest'];

/**
 * Merge a saved id order with the known sections: keep the saved order for ids that
 * still exist, append any new sections (in their default position), drop unknown ids.
 */
export function resolveOrder(saved: string[] | null | undefined, known: string[]): string[] {
  if (!saved || saved.length === 0) return [...known];
  const knownSet = new Set(known);
  // Dedupe as we go so a corrupted saved layout with a repeated id can never render a card twice.
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of saved) {
    if (knownSet.has(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const id of known) if (!seen.has(id)) ordered.push(id);
  return ordered;
}

/** The deterministic default (no saved state) - used as the SSR/first-paint state too. */
export function defaultLayout(known: string[]): CommandLayoutState {
  return { order: [...known], hidden: DEFAULT_HIDDEN.filter((id) => known.includes(id)) };
}

export function loadCommandLayout(known: string[]): CommandLayoutState {
  try {
    const raw = window.localStorage.getItem(COMMAND_LAYOUT_KEY);
    if (!raw) return defaultLayout(known);
    const parsed = JSON.parse(raw) as Partial<CommandLayoutState>;
    return {
      order: resolveOrder(parsed.order, known),
      hidden: (parsed.hidden ?? []).filter((id) => known.includes(id)),
    };
  } catch {
    return defaultLayout(known);
  }
}

export function saveCommandLayout(state: CommandLayoutState): void {
  try {
    window.localStorage.setItem(COMMAND_LAYOUT_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
