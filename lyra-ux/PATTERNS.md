# Lyra UI Patterns - the component vocabulary

Companion to [`TOKENS.md`](./TOKENS.md) (same versioning contract). The reference implementation
is the Model Lab three-panel surface; every pattern below is named there. Restyle agents: build
THESE shapes with TOKEN names - no ad-hoc hex, no new pattern without adding it here first.

## Page anatomy

- **Ground**: `bg-ground` page, content in a max-width column, generous vertical rhythm.
- **Tab row** (view switcher): underlined active tab with icon, muted inactive tabs.
- **Three-panel desktop grid** where a surface has configure/execute/results roles; stacks
  vertically below `lg` in that order. Panels never scroll the page horizontally.

## Panels and cells

- **PanelCard**: `.terminal-panel rounded-panel` + `border-line-strong` when emphasis is needed;
  `.terminal-panel-soft` for secondary cards. Title row: `text-ink-title` + optional status pill
  right-aligned. Never nest PanelCards more than one level.
- **StatCell**: `rounded-cell bg-well` label (`text-ink-3`, 11px uppercase tracking) over value
  (`text-ink`, tabular-nums). Grids of 2-4; queued/absent value renders "-", never a fake 0.
- **StatsStrip**: darker inset card of 4 StatCells summarising a run/list.

## Chips and pills

- **ChoiceChip** (single-select rows like Archetype/Vertical): active = filled `bg-accent-tint
  text-accent border-accent-border`; inactive = `border-line text-ink-2`.
- **StatusPill**: semantic only - `positive` (available/verified/live), `accent` (limited/
  caution), `pending` (queued/count), `negative` (blocked/risk). Icon + label, never colour alone.
- **TagPill**: muted metadata (theme, cap tier, country) - `border-line text-ink-3`, tiny.

## Actions

- **GradientCTA**: `--lyra-cta-gradient`, white bold label, arrow icon; ONE per view; muted
  caption underneath stating what the action uses ("This run will use the latest data...").
- **Primary/ghost buttons**: primary = `bg-blue` (or pending-violet in candidate contexts);
  ghost = `border-line text-ink-2 hover:bg-panel`. Disabled = dim + tooltip, never hidden.

## Progress and results

- **Stepper** (live execution): completed = `positive` ring + check + elapsed; running = pulsing
  `blue-focus` ring; queued = `line-hair` circle + "Queued". Per-stage metric right-aligned.
- **CandidateCard**: rank chip + monogram + ticker/name; expanded rank-1 gets a `pending`-tinted
  border glow; stat trio (probability large, percentile, confidence); domain chips; risk row
  (warning icon + severity in `accent`); action rows per Actions above.
- **Empty/insufficient states**: say "not enough evidence" / "no data yet" in `text-ink-3` -
  never a fake number, never a bare blank. Loading = skeleton blocks, not spinners.

## Honesty rules (design-level, non-negotiable)

- Provenance banners (shadow-live, demo labelling, "Research only - never advice") are part of
  every surface's composition. A restyle that loses one is a failed restyle.
- Numbers bind to real data flows; display formatting only. `tabular-nums` wherever digits align.
- Status colours never decorate. Charts use ink/blue scales, not status greens/reds, unless the
  value IS a gain/loss.

## Mobile

- Panels stack in role order; chip rows wrap (no horizontal page scroll); stat grids collapse to
  2 columns; tap targets >= 44px; sticky CTA only where the view's pattern already supports it.
