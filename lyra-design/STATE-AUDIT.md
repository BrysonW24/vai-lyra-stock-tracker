# lyra-design - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
Lyra's design system and experience quality: the glassmorphism surface vocabulary, the Tailwind
token + font layer, the AppShell navigation shell, the dense/compact density doctrine, the 44px
mobile touch floor, and accessibility fallbacks (reduced-transparency / reduced-motion / iOS
focus-zoom). Maps to V3 (Command Centre & Dashboard Shell) and V16 (Landing & Acquisition Surfaces).

## Lyra as it is today
The design system is a single, coherent, code-defined vocabulary that is already wired across the
whole app - not a spec awaiting build. Two layers hold it:

- **Token layer** (`tailwind.config.ts:7-39`): a light brand palette (`cream #f7f1e8`, `paper`,
  `ink #201f1b`, `muted`, `amber #f07c2b`, `cobalt`, `mint`, `slate`), two named shadows
  (`soft`, `insetGlass`), and an Apple-native font stack (`-apple-system`/`SF Pro Text` for sans,
  `SF Mono` for mono, `tailwind.config.ts:22-38`). These light tokens back the premium light
  landing/onboarding surface (`BrandHeroGlass.tsx` - "Brand hero for the light premium landing").
- **Runtime glass layer** (`src/app/globals.css`): the dark glassmorphism the app actually runs in
  (`color-scheme: dark`, `globals.css:6`; deep navy canvas with aurora glows + engineering grid,
  `:67-83`). The workhorse class vocabulary is defined once here: `.terminal-panel` (frosted panel,
  `backdrop-filter: blur(14px) saturate(118%)`, `:116-124`), `.terminal-panel-soft` (`:127`),
  `.glass-chrome` (shell/header/nav, `:145`), `.glass-well` (recessed fields, deliberately
  blur-free to save GPU at 375px, `:151-161`), `.glass-segment` + `.glass-thumb` (segmented
  controls, `:164-177`), `.glass-hero` (marquee halo, `:136`), `.glass-row` (hover lift, `:180`).

Reach on disk (grep, `src/**/*.tsx`): `.terminal-panel` appears in **104** component files,
`.glass-hero` in 12, `.glass-well`/`.glass-row` in 3 each, `.glass-chrome` in 2. The estate has
**188** `.tsx` components across ~40 feature directories plus ~40 top-level components.

The navigation shell (`AppShell.tsx`, 577 lines) is the design system's centre of gravity: a fixed
72px icon rail (xl+), a sticky glass header with an honest live/demo/stale market badge
(`:315-364`), an always-on horizontally-scrollable mobile bottom nav (`:430-466`), and a grouped
"Explore" drawer (`:470-569`). Nav is grouped **by job** into five buckets (desk/discover/research/
practice/learn) each carrying a Lyra accent colour (`:121-127`), and the primary bar is
user-customisable (persisted + sanitised via the unit-tested `sanitizePrimaries`, `:140`).

## How it works
Glass is an **enhancement, never a legibility dependency**. Three fallback tiers collapse every
translucent surface to a solid, AA-safe fill: `@supports not (backdrop-filter...)`
(`globals.css:193-198`) and `@media (prefers-reduced-transparency: reduce)` (`:200-214`) both swap
`.terminal-panel` -> `#161d27`, `.glass-chrome` -> `#0b1016`, etc.; `@media (prefers-reduced-motion:
reduce)` disables the orbital animations (`:324-326`) and every marquee track (`:357-362`).

Density is engineered, not incidental: a global **15px** rem base shrinks every rem-based size
(`globals.css:28`), placeholders are `0.75rem` (`:39-42`), and 9px micro-labels run across the stat
components. The critical companion rule is the iOS focus-zoom guard - `@media (pointer: coarse)`
pins every text input to `16px !important` (`globals.css:52-59`) so density never triggers Safari's
non-reversible focus-zoom. This is a hard-won invariant documented as "never undo" in
`docs/product/mobile-experience.md`.

The 44px touch floor is met on primary controls by `h-11 w-11` with a `sm:` denser desktop override
(e.g. rail/bottom-nav items `AppShell.tsx:268,285`; header Wire/What's-new controls
`:374,388` at `h-11 w-11 ... sm:h-9 sm:w-9`). Across components `h-11` appears in 21 spots and
`min-h-[44px]`/`min-w-[44px]` in 26. The `/ux-surface` skill chain encodes the rule ("targets >=
44px", `.claude/commands/ux-surface.md:21`).

## Strengths (verified)
- **One source of truth for the surface language.** Every panel, chrome, well and segment is a class
  in `globals.css:102-186`; 104 component files consume `.terminal-panel` rather than re-rolling
  blur/border/shadow - low drift risk by construction.
- **Accessibility fallbacks are real, not aspirational.** Two independent paths (`@supports` +
  `prefers-reduced-transparency`) plus a motion path degrade to solid AA fills / no animation
  (`globals.css:193-214,324-326,357-362`).
- **The iOS focus-zoom guard ships and is documented as load-bearing** (`globals.css:52-59`;
  `docs/product/mobile-experience.md`) - a genuine cross-platform correctness fix, not cosmetics.
- **44px floor is met on the primary journey with a responsive dense split** - `h-11 w-11` on touch,
  `sm:h-9` on desktop (`AppShell.tsx:374,388`), 26 `min-h/w-[44px]` anchors estate-wide.
- **Density doctrine is grounded and specific** - 15px base, 9px labels, one-eye-line grids, always-on
  bottom nav - documented in `docs/product/product-principles.md:41-43` and traced to real code.
- **Deliberate dual-theme intent** - dark glass runtime (`globals.css`) + light premium landing
  (`BrandHeroGlass.tsx`), and an Apple-native font stack for a system-native premium feel.

## Gaps, risks, what is missing
The residual gaps are polish and test-debt, not missing capability. From the 2026-07-29 gap-to-95
audit, three items map to this domain and are **verified on disk**:

- **[polish, S] Explore-drawer close button is a 32px tap target** - `AppShell.tsx:504` is
  `grid h-8 w-8`, below the 44px floor the rest of the shell meets, on a mobile-primary surface
  (gap-to-95 V3 finding 2). Fix: `h-11 w-11` on touch with a `sm:` denser override.
- **[polish, S] Add-form inputs sit below the touch floor** - `AddHoldingForm.tsx` inputs are `h-8`
  (`:123,172,185,198,210,221`) and `AddWatchRuleForm.tsx` inputs are `h-9`
  (`:133,183,197,208`); the desktop portfolio remove is `h-8 w-8` while the mobile remove is already
  44px, so the surface is **internally inconsistent** (gap-to-95 V4 finding 4). Fix: 44px hit area on
  touch, keep desktop dense.
- **[polish, S] Flip-card viz captions fail AA contrast** - `#8290a0` on white is ~3.26:1 at
  `UltimateGoals.tsx:58,128,143,271,323,334` (6 occurrences confirmed; 7 estate-wide) - the exact
  defect fixed on the page copy but missed inside the SVG graphics (gap-to-95 V16 finding 2). Fix:
  raise to `#5A6B82`.

Additional findings from this pass:

- **Thin render-test coverage of the visual layer.** Design-relevant tests are the pure helpers
  (`nav-prefs.test.ts` for `sanitizePrimaries`, `scan-freshness.test.ts`) plus two thin component
  tests (`product-tour.test.ts`; `landing/__tests__/StackSection.test.tsx`, 31 lines, solo tile-filter
  only). The glass CSS itself and most of the 188 components have no render/visual-regression gate -
  drift is caught by eye. This is consistent with the house pattern (pure extraction over heavy RTL),
  but it means contrast/spacing regressions can ship green. gap-to-95 V16 finding 1 (Solo/Community
  conditional copy unpinned) and V3 finding 1 (`MetricStrip` reimplements `scanFreshness` inline as a
  two-source-of-truth) both sit in this domain.
- **Doc pointer drift.** `docs/product/mobile-experience.md` references `app-aesthetic-system.md`,
  which is not present on disk - a dangling design-doctrine pointer.
- **The `lyra-design/` operating folder is greenfield beyond its README.** No `ROADMAP.md`,
  `decision-register.json`, or dated working docs yet - the design *system* lives in code
  (`globals.css` + `tailwind.config.ts` + components), while this founder-facing *home* is unfilled.

## Where to find it
- Runtime glass vocabulary + density base + a11y fallbacks: `src/app/globals.css` (classes `:102-186`,
  fallbacks `:193-214,324-326,357-362`, density `:28,39,52-59`).
- Tokens + fonts + shadows: `tailwind.config.ts:7-39`.
- Navigation shell + Explore drawer + market badge: `src/components/AppShell.tsx` (buckets `:121-127`,
  close button `:504`, badge `:315-364`).
- Brand surfaces: `src/components/BrandHeroGlass.tsx`, `BrandLogo.tsx`; landing:
  `src/components/landing/{UltimateGoals,StackSection}.tsx`.
- Residual polish targets: `AppShell.tsx:504`, `portfolio/AddHoldingForm.tsx`,
  `watchlist/AddWatchRuleForm.tsx`, `landing/UltimateGoals.tsx`.
- Doctrine: `docs/product/mobile-experience.md`, `docs/product/product-principles.md:41-43`,
  `.claude/commands/ux-surface.md`.
- Tests: `src/lib/__tests__/{nav-prefs,scan-freshness}.test.ts`,
  `src/components/__tests__/product-tour.test.ts`, `src/components/landing/__tests__/StackSection.test.tsx`.
- Domain audit source: `lyra-audits/2026-07-29-gap-to-95-audit.md` (V3, V4, V16).

## Posture
Strong and wired - one coherent glass system reused across 104 components with real AA/motion
fallbacks; thinly render-tested, with three S-effort polish stragglers (32px close button, h-8/h-9
inputs, `#8290a0` flip-card contrast) as the only design blockers to 95.
