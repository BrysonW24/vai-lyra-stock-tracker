# Lyra Design Tokens

```
version: 1.0.0
date: 2026-08-02
mirrors: src/styles/lyra-tokens.css · tailwind.config.ts (both carry this version)
check:   node lyra-ux/check-tokens.mjs
```

The canonical token table. Values were EXTRACTED from the app's proven de-facto palette
(usage-counted across ~40k lines of view code, 2026-08-02) and ratified against the
founder-approved Model Lab target design - they are not an invention. Components consume tokens
only: Tailwind names (preferred) or CSS variables (plain-CSS contexts like the glass panel
classes). **Ad-hoc hex in a component is a defect.** Missing value? Add it to all three files in
one change with a version bump and a changelog line below.

## Palette

| Token (CSS var) | Tailwind name | Hex | Role |
|---|---|---|---|
| `--lyra-ground` | `ground` | `#07090c` | Page background |
| `--lyra-chrome` | `chrome` | `#0b1016` | Nav/chrome fill |
| `--lyra-panel` | `panel` | `#0d141c` | Panel card fill |
| `--lyra-panel-deep` | `panel-deep` | `#0d1117` | Deep/inner panel |
| `--lyra-well` | `well` | `#0a0e13` | Inset wells, segments |
| `--lyra-line` | `line` | `#1b2530` | Soft divider |
| `--lyra-line-strong` | `line-strong` | `#263241` | Panel border |
| `--lyra-hairline` | `line-hair` | `#3a4754` | Hairline emphasis |
| `--lyra-ink` | `ink` | `#eef3f8` | Primary text |
| `--lyra-ink-title` | `ink-title` | `#dbe5ee` | Headings |
| `--lyra-ink-2` | `ink-2` | `#a8b5c2` | Secondary text |
| `--lyra-ink-3` | `ink-3` | `#8190a0` | Muted labels |
| `--lyra-ink-dim` | `ink-dim` | `#5e6b78` | Dim/disabled text |
| `--lyra-accent` | `accent` | `#f3a33a` | Amber accent (active, highlight) |
| `--lyra-accent-border` | `accent-border` | `#9a6a1f` | Amber borders |
| `--lyra-accent-tint` | `accent-tint` | `#2a1f0f` | Amber tint fill |
| `--lyra-positive` | `positive` | `#43d18b` | Green: gain, available, verified |
| `--lyra-positive-tint` | `positive-tint` | `#0d251b` | Green tint fill |
| `--lyra-negative` | `negative` | `#ff6b6b` | Red: loss, blocked, danger |
| `--lyra-negative-soft` | `negative-soft` | `#f0758a` | Softer red |
| `--lyra-pending` | `pending` | `#8aa2ff` | Violet: queued, pending, in-flight |
| `--lyra-blue` | `blue` | `#1e63ff` | Primary blue |
| `--lyra-blue-deep` | `blue-deep` | `#3b5bdb` | Deep blue |
| `--lyra-blue-info` | `blue-info` | `#7fb0ff` | Info text blue |
| `--lyra-blue-focus` | `blue-focus` | `#60a5fa` | Focus rings, selection |
| `--lyra-blue-tint` | `blue-tint` | `#0e1e3a` | Blue tint fill |

## Gradient, shape, motion

| Token | Value | Rule |
|---|---|---|
| `--lyra-cta-gradient` | `linear-gradient(90deg, #43d18b 0%, #1e63ff 100%)` | THE primary CTA. One per view, maximum. |
| `--lyra-radius-panel` / `rounded-panel` | `0.75rem` | Panel cards |
| `--lyra-radius-cell` / `rounded-cell` | `0.5rem` | Stat cells, inputs, small cards |
| `--lyra-radius-chip` | `9999px` | Pills and chips |
| `--lyra-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | Standard easing |
| `--lyra-dur-fast` / `--lyra-dur` | `120ms` / `200ms` | Micro / standard transitions |

## Status semantics (colours carry meaning, never decoration)

- **positive/green** = verified, available, gain, completed
- **accent/amber** = limited, caution, attention, active-selection
- **pending/violet** = queued, pending, in-flight, count badges
- **negative/red** = blocked, loss, danger, risk-high
- Never repurpose a status colour as "series 4" of a chart or a decorative accent.

## Panel primitives (plain CSS, in globals.css)

`.terminal-panel` (standard glass panel) and `.terminal-panel-soft` (subdued) remain the panel
primitives - they are the app's established vocabulary with backdrop-filter fallbacks and
reduced-transparency support. Dialect ruling (v1.0.0): the target surface language is the Model
Lab's - panels on near-black ground, subtle `line-strong` borders, `rounded-panel`, chip
vocabulary, ONE gradient CTA - expressed through THESE tokens. The older raw-hex dialect and the
newer `bg-white/[0.03]` dialect both converge here: white/opacity literals migrate to token
names during the restyle, not to new ad-hoc values.

## Changelog

- **1.0.0 (2026-08-02)** - initial extraction from the de-facto palette + Model Lab target.
  Removed the dead "warm paper" light palette (cream/paper/ink/muted/line/cobalt/mint/slate +
  soft/insetGlass shadows) from tailwind.config.ts - zero usages existed. Repurposed `ink` and
  `line` names for the real dark palette.
