# lyra-ux - the design system workspace

The single home for how Lyra looks and feels: the versioned token spec, the component pattern
vocabulary, and the restyle notes. Surfaces implement; this workspace is the contract.

Reference implementation: the Model Lab three-panel surface (founder-approved target, 2026-08-02).
Every other view converges on its language - dark ground, quiet panel cards, chip vocabulary,
status accents, one gradient CTA per view, honest data or no data.

## Files

| File | What it is |
|---|---|
| `TOKENS.md` | **The versioned token spec** - palette, surfaces, borders, radii, type scale, status colours, gradients, motion. Semver'd; the app builds from it. |
| `PATTERNS.md` | Component vocabulary (PanelCard, StatCell, StatusPill, ChipRow, GradientCTA, Stepper, CandidateCard...) with usage + honesty rules. |
| `notes/` | Dated working notes per restyle package - what changed, what was deferred, screenshots refs. |

## Versioning contract (tokens are versioned, like releases)

- `TOKENS.md` carries `version: X.Y.Z` in its header and a changelog section at the bottom.
- The app consumes tokens from `src/styles/lyra-tokens.css`, whose header comment states the
  SAME version. A change to either file without the other is drift - fix before shipping.
- Patch = value tweak (a hex nudge). Minor = new tokens/patterns. Major = breaking rename or
  removal (requires a sweep of usages in the same change).
- Never restyle a view with ad-hoc values: if a needed value is missing, ADD it to the spec
  (version bump) and then use the token. Ad-hoc hexes in components are the drift this
  workspace exists to prevent.

## Honesty rules that survive every restyle

- Provenance banners (shadow-live, demo labelling, "Research only - never advice") are part of
  the design, never casualties of it.
- Status colours carry meaning (green = verified/available, amber = limited/caution,
  violet = pending/queued, red = blocked/risk) and are never used decoratively.
- Empty/insufficient states say so ("not enough evidence") - a beautiful surface never fakes a
  number. Loading states are skeletons, not spinners.
