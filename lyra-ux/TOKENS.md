# Lyra Design Tokens

```
version: 1.1.0
date: 2026-08-05
mirrors: src/styles/lyra-tokens.css · tailwind.config.ts (both carry this version)
check:   node lyra-ux/check-tokens.mjs
```

The canonical token table. Values were EXTRACTED from the app's proven de-facto palette
(usage-counted across ~40k lines of view code, 2026-08-02) and ratified against the
founder-approved Model Lab target design - they are not an invention. Components consume tokens
only: Tailwind names (preferred) or CSS variables (plain-CSS contexts like the glass panel
classes). **Ad-hoc hex in a component is a defect.** Missing value? Add it to all three files in
one change with a version bump and a changelog line below.

## Theming (v1.1.0) - Lyra is dark by nature, light is opt-in

Dark is the `:root` default. A light theme is applied **app-wide** by setting
`data-theme="light"` on `<html>` (Settings > Appearance; persisted in `localStorage`; a no-FOUC
script in `layout.tsx` sets it before paint). Every palette token carries two forms in
`lyra-tokens.css`: the hex (`--lyra-x`, for direct `var()` consumers) and the `"R G B"` channel
triplet (`--lyra-x-rgb`), so Tailwind's `rgb(var(--lyra-x-rgb) / <alpha-value>)` colours keep
opacity modifiers (`bg-panel/60`) working **and** re-theme. The light column below is the light
value; the `[data-theme="light"]` block overrides both forms. Glass panel surfaces (hardcoded
translucent gradients in `globals.css`) carry their own light overrides there.

## Palette

| Token (CSS var) | Tailwind name | Dark | Light | Role |
|---|---|---|---|---|
| `--lyra-ground` | `ground` | `#07090c` | `#f4f7fa` | Page background |
| `--lyra-chrome` | `chrome` | `#0b1016` | `#eef2f7` | Nav/chrome fill |
| `--lyra-panel` | `panel` | `#0d141c` | `#ffffff` | Panel card fill |
| `--lyra-panel-deep` | `panel-deep` | `#0d1117` | `#f2f5f9` | Deep/inner panel |
| `--lyra-well` | `well` | `#0a0e13` | `#e9eef4` | Inset wells, segments |
| `--lyra-line` | `line` | `#1b2530` | `#e2e8f0` | Soft divider |
| `--lyra-line-strong` | `line-strong` | `#263241` | `#cdd7e3` | Panel border |
| `--lyra-hairline` | `line-hair` | `#3a4754` | `#94a3b8` | Hairline emphasis |
| `--lyra-ink` | `ink` | `#eef3f8` | `#12222a` | Primary text |
| `--lyra-ink-title` | `ink-title` | `#dbe5ee` | `#0f1d24` | Headings |
| `--lyra-ink-2` | `ink-2` | `#a8b5c2` | `#46575f` | Secondary text |
| `--lyra-ink-3` | `ink-3` | `#8190a0` | `#5c6b73` | Muted labels |
| `--lyra-ink-dim` | `ink-dim` | `#5e6b78` | `#8a97a0` | Dim/disabled text |
| `--lyra-accent` | `accent` | `#f3a33a` | `#b45309` | Amber accent (active, highlight) |
| `--lyra-accent-border` | `accent-border` | `#9a6a1f` | `#cf9640` | Amber borders |
| `--lyra-accent-tint` | `accent-tint` | `#2a1f0f` | `#fef3e2` | Amber tint fill |
| `--lyra-positive` | `positive` | `#43d18b` | `#047857` | Green: gain, available, verified |
| `--lyra-positive-tint` | `positive-tint` | `#0d251b` | `#d1fae5` | Green tint fill |
| `--lyra-negative` | `negative` | `#ff6b6b` | `#dc2626` | Red: loss, blocked, danger |
| `--lyra-negative-soft` | `negative-soft` | `#f0758a` | `#e11d48` | Softer red |
| `--lyra-pending` | `pending` | `#8aa2ff` | `#4f46e5` | Violet: queued, pending, in-flight |
| `--lyra-blue` | `blue` | `#1e63ff` | `#2563eb` | Primary blue |
| `--lyra-blue-deep` | `blue-deep` | `#3b5bdb` | `#1d4ed8` | Deep blue |
| `--lyra-blue-info` | `blue-info` | `#7fb0ff` | `#1d4ed8` | Info text blue |
| `--lyra-blue-focus` | `blue-focus` | `#60a5fa` | `#2563eb` | Focus rings, selection |
| `--lyra-blue-tint` | `blue-tint` | `#0e1e3a` | `#dbeafe` | Blue tint fill |

## Gradient, shape, motion

| Token | Dark | Light | Rule |
|---|---|---|---|
| `--lyra-cta-gradient` | `linear-gradient(90deg, #43d18b, #1e63ff)` | `linear-gradient(90deg, #047857, #0e7490)` | THE primary CTA. One per view, maximum. |
| `--lyra-radius-panel` / `rounded-panel` | `0.75rem` | - | Panel cards |
| `--lyra-radius-cell` / `rounded-cell` | `0.5rem` | - | Stat cells, inputs, small cards |
| `--lyra-radius-chip` | `9999px` | - | Pills and chips |
| `--lyra-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | - | Standard easing |
| `--lyra-dur-fast` / `--lyra-dur` | `120ms` / `200ms` | - | Micro / standard transitions |

## Status semantics (colours carry meaning, never decoration)

- **positive/green** = verified, available, gain, completed
- **accent/amber** = limited, caution, attention, active-selection
- **pending/violet** = queued, pending, in-flight, count badges
- **negative/red** = blocked, loss, danger, risk-high
- Never repurpose a status colour as "series 4" of a chart or a decorative accent.

## Panel primitives (plain CSS, in globals.css)

`.terminal-panel` (standard glass panel) and `.terminal-panel-soft` (subdued) remain the panel
primitives - they are the app's established vocabulary with backdrop-filter fallbacks and
reduced-transparency support. Their translucent gradients are hardcoded, so their light-theme
appearance is defined by explicit `:root[data-theme="light"]` overrides in `globals.css` (frosted
white on pearl), not by the tokens alone. Dialect ruling (v1.0.0, unchanged): the target surface
language is the Model Lab's - panels on ground, subtle `line-strong` borders, `rounded-panel`,
chip vocabulary, ONE gradient CTA - expressed through THESE tokens.

## Changelog

- **1.1.0 (2026-08-05)** - app-wide theming. Every palette token gains a `--lyra-x-rgb` channel
  triplet; Tailwind colours now reference `rgb(var(--lyra-x-rgb) / <alpha-value>)` so utilities
  re-theme while opacity modifiers keep working. Added the light palette (pearl grounds, deep-ink,
  emerald accent) under `:root[data-theme="light"]`, plus light overrides for the glass panels in
  globals.css. Dark stays the `:root` default. Toggle lives in Settings > Appearance.
- **1.0.0 (2026-08-02)** - initial extraction from the de-facto palette + Model Lab target.
  Removed the dead "warm paper" light palette (cream/paper/ink/muted/line/cobalt/mint/slate +
  soft/insetGlass shadows) from tailwind.config.ts - zero usages existed. Repurposed `ink` and
  `line` names for the real dark palette.
