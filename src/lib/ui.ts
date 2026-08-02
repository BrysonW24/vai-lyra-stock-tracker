/**
 * Shared UI class tokens.
 *
 * Single source of truth for repeated Tailwind class strings so daily-visited
 * surfaces stop drifting in size, case, and colour page to page. Colour names
 * are the Lyra design tokens (lyra-ux/TOKENS.md); shapes follow the pattern
 * vocabulary in lyra-ux/PATTERNS.md. Compose with template strings; never fork
 * a copy with one hex changed - extend here instead.
 */

/**
 * Canonical page-title (h1) class.
 *
 * Apply to the single primary heading at the top of every page/view so titles
 * render identically across surfaces. This is the dense "command centre"
 * plurality: small, uppercase, wide-tracked, muted near-white.
 */
export const pageTitleClass =
  'text-sm font-semibold uppercase tracking-[0.14em] text-ink-title';

/* ---------------------------------------------------------------------------
 * Panels (PATTERNS.md "Panels and cells")
 * ------------------------------------------------------------------------- */

/** Standard glass panel card - the workhorse surface. */
export const panelClass = 'terminal-panel rounded-panel';

/** Subdued glass panel for secondary / nested cards (never nest deeper than one level). */
export const panelSoftClass = 'terminal-panel-soft rounded-panel';

/* ---------------------------------------------------------------------------
 * Stat cells
 * ------------------------------------------------------------------------- */

/** Inset stat cell: label over value on a dark well. Grids of 2-4. */
export const statCellClass = 'rounded-cell bg-well px-3 py-2';

/** Tiny uppercase label above a stat value. */
export const statLabelClass =
  'text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3';

/** Stat value - tabular digits so columns align. A queued/absent value renders "-", never a fake 0. */
export const statValueClass = 'font-mono text-ink tabular-nums';

/* ---------------------------------------------------------------------------
 * Chips and pills
 * ------------------------------------------------------------------------- */

/** ChoiceChip - selected state (single-select rows). Amber = active-selection. */
export const chipActiveClass =
  'rounded-full border border-accent-border bg-accent-tint px-2.5 py-1 text-[11px] font-medium text-accent';

/** ChoiceChip - unselected state. */
export const chipIdleClass =
  'rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2';

/** TagPill - muted metadata (theme, cap tier, country). Never carries status colour. */
export const tagPillClass =
  'rounded-full border border-line px-2 py-0.5 text-[10px] text-ink-3';

/* ---------------------------------------------------------------------------
 * Actions (PATTERNS.md "Actions")
 * ------------------------------------------------------------------------- */

/** Ghost button - secondary actions. */
export const ghostButtonClass =
  'rounded-cell border border-line px-3 py-2 text-xs font-medium text-ink-2 transition hover:bg-panel hover:text-ink';

/** Primary (non-gradient) button - blue fill. */
export const primaryButtonClass =
  'rounded-cell bg-blue px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110';

/**
 * THE gradient CTA (--lyra-cta-gradient). One per view, maximum - white bold
 * label, usually with a trailing arrow icon and a muted caption underneath.
 */
export const ctaGradientClass =
  'inline-flex items-center justify-center gap-1.5 rounded-cell bg-[image:var(--lyra-cta-gradient)] px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110';
