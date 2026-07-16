# /ux-surface - bring one feature surface to premium quality

You are Claude Code running in the Lyra repo. Pick ONE feature surface and bring it to
the premium bar: renders in demo mode, holds at 375px, accessible, every state designed
(loading/empty/error), branded, titled, and showing only engine-owned numbers. This chain
owns the page + component estate: `src/app/` feature pages (radar, tickers, portfolio,
trades, paper, intelligence, education, calculators, and the rest) and `src/components/`.
Doctrine: **frontend formats, sorts and colors - it never recalculates engine truth; the
UI is dense and compact, never airy.**

## Scope discipline

One surface per loop (a page + its components). "Everything is a bit better" ships
nothing; one surface at premium raises the bar the next loop inherits.

## The audit checklist (run against the chosen surface)

1. **Demo render** - `npm run dev` with no env: the surface shows real demo content.
   Blank panels, spinners-forever, or login walls are P0s.
2. **Mobile** - LOOK at it at 375px (not just resize-ish): no horizontal scroll, touch
   targets >= 44px, tables get a mobile presentation (the SignalTable pattern: cards or
   scroll container), nothing clipped.
3. **States** - loading (skeleton, not spinner-only), empty (helpful copy + an action,
   see SignalTable's clear-filters empty state), error (branded boundary already exists
   at `src/app/error.tsx` - surface-level errors still need in-place handling).
4. **A11y** - interactive elements are buttons/links with accessible names; form controls
   have labels/aria-labels; focus states visible; color never the only signal.
5. **Metadata + branding** - the page exports a `metadata` title (template in
   `src/app/layout.tsx`); brand components (`BrandLogo`, `VersionBadge`) where the
   surface is an entry point; plain hyphens in copy, never em dashes; no advicey copy.
6. **Engine truth** - grep the surface for arithmetic on market data. Formatting
   (`src/lib/format.ts`) is fine; recalculating RSI/score/risk client-side is a P0 -
   move it behind the engine and fetch the result.
7. **Consistency** - reuse `AppShell`, `CommandLayout`, `ChartPrimitives`, existing
   card/strip patterns; a new one-off layout needs a reason.

## Fix, verify, ship

1. Fix what the checklist surfaced, worst first. Component tests where the harness
   exists (`tests/*.test.ts` for lib logic the surface leans on).
2. `npm run type-check && npm run lint && npm run test && npm run build`.
3. Walk the surface once more in the browser (demo mode) before claiming done - a green
   build is not a seen-working surface.
4. Version bump via `RELEASES`, `npm run release`, commit, push, `npm run announce`.

**Done means:** one named surface passes all seven checks, verified by looking at it,
shipped under a version. Explainability: the report shows the checklist with pass/fixed
per item - and names the next-worst surface so the following loop starts aimed.
