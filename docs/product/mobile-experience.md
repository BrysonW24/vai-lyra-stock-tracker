# Mobile experience - the density standard

> **Purpose:** Lyra's mobile-first density standard (the 15px base, 9px labels, one-eye-line grids, accordions, drawers, rotating tiles), the navigation structure including the Lyra colour ramp, the 390px rule, and the current surface list. | **Audience:** Anyone touching Lyra UI. | **Status:** Active | **Owner:** Bryson Walter | **Last updated:** 2026-06-11

## The standing standard

Lyra defaults to MAXIMUM density - "compact compact compact" is the standing directive. The goal is a command-centre feel: a phone screen that answers "what changed and does it matter?" in one glance, with calm glassmorphism keeping the density premium instead of overwhelming (`app-aesthetic-system.md`: "density that legitimises severity, not density that overwhelms").

## The density levers (all shipped)

### 1. The 15px global base

`src/app/globals.css` sets `html { font-size: 15px }` - one lever that tightens every rem-based size and spacing across the whole app:

```css
/* Global density baseline: shrink the rem base a touch so every rem-based size
   (text + spacing) is a couple pixels tighter across the whole app. */
font-size: 15px;
```

Critical companion rule in the same file: on touch devices, every text-entry control is pinned to `16px !important` (`@media (pointer: coarse)`), because iOS Safari auto-zooms on focus of any input below 16px and will not zoom back out. **Never undo this pin to make an input denser** - density on inputs costs the entire viewport.

### 2. 9px micro-labels

Labels, chips, and captions sit at `text-[9px]` to `text-[11px]`; stat VALUES stay `text-sm md:text-base` (never lg/xl). In code today: `text-[9px]` appears across `src/components/MetricStrip.tsx`, `ChartPrimitives.tsx`, `FeatureTiles.tsx`, `DailyBriefCard.tsx`, `SmartMoneyCard.tsx`, `WhatsNewFeed.tsx`, and more. Page-level disclaimers run `text-[10px]` (`src/app/trading/page.tsx`, `src/app/paper/page.tsx`).

### 3. One-eye-line stat grids

Key numbers render as single-row grids readable in one eye sweep:

- `src/components/ExecutiveStrip.tsx` - `grid grid-cols-4 gap-1.5` executive strip
- `src/components/MetricStrip.tsx` - `grid grid-cols-3 gap-1.5 xl:grid-cols-6` metric strip

Pattern rule: a stat box is label-over-value, tight gap (`gap-1.5`), no decoration that adds height. Signal rows stay single-line.

### 4. Accordions for depth

Deep content collapses behind native-feel accordions so pages stay short: `src/components/themes/ThemeDossier.tsx`, `src/components/smallcaps/SmallCapDiscovery.tsx`, `src/components/education/LearningPath.tsx`. Summary first, expansion on intent.

### 5. Drawers for detail

Tapping a dense row opens a drawer instead of navigating away: `src/components/DetailDrawer.tsx`, `src/components/SignalDrawer.tsx`. The list keeps its scroll position; the detail carries the full evidence.

### 6. Rotating tiles for breadth

Where breadth exceeds space, tiles rotate on timers instead of stacking: `src/components/DailyBriefCard.tsx` (14s rotation), `src/components/RotatingFaces.tsx`, `src/components/LandingShowcase.tsx` (interval-driven slides), plus swipeable carousels (`PanelCarousel.tsx`, `HoldingChartCarousel.tsx`, `education/EducationCarousel.tsx`). Ticker-tape context strips (`ExchangeStrip.tsx`, `MarketContextStrip.tsx`, `IntelligenceTicker.tsx`) move breadth horizontally.

## The 390px rule

Every surface must be fully usable at a 390px-wide viewport (iPhone-class), meaning:

- no horizontal page overflow - the ONLY things allowed to scroll horizontally are deliberate strips (bottom nav, ticker tapes, carousels)
- one-eye-line grids stay on one line (that is why mobile is `grid-cols-3`/`grid-cols-4`, expanding only at `xl:`)
- bottom padding `pb-28 xl:pb-6` on page bodies so content clears the fixed bottom nav (see `src/app/trading/page.tsx`)
- test at 390px before claiming any UI change done; the post-deploy checklist (`docs/runbooks/deploy.md`) includes it

## Navigation structure

`src/components/AppShell.tsx` renders ONE `navItems` list two ways:

- **Desktop (xl+):** a vertical icon rail on the left.
- **Mobile:** an always-on, horizontally-scrollable, snap-aligned bottom bar - every surface (Education included) permanently reachable without opening a menu. Each page re-mounts the shell, so a `useEffect` re-scrolls the active item into view to keep orientation.

### The Lyra colour ramp

Nav icons ascend through the brand palette and descend back (ping-pong), so the rail reads as one continuous gradient wave:

```ts
const LYRA_RAMP = ['#3b5bdb', '#5bc8ff', '#43d18b', '#f3a33a', '#f0758a', '#a78bfa'];
// rampColor(index): period = LYRA_RAMP.length * 2 - 2 (ping-pong indexing)
```

New nav items inherit their colour from position automatically - do not hand-pick nav icon colours.

### Two-surface aesthetic

The world is split deliberately: landing + onboarding are LIGHT and cinematic; the command centre is DARK glassmorphism (deep navy canvas, aurora glows, engineering grid - `src/app/globals.css` body background; doctrine in `app-aesthetic-system.md`). Do not leak the dark shell into onboarding or the light look into the console.

## Current surface list (the 24 nav surfaces)

From `navItems` in `src/components/AppShell.tsx`:

| Route | Label | Route | Label |
|---|---|---|---|
| `/` | Command | `/calendar` | Calendar |
| `/radar` | Signal Radar | `/ipos` | IPO Radar |
| `/wire` | Live Wire | `/intelligence` | Intelligence |
| `/themes` | World Radar | `/smart-money` | Smart Money |
| `/small-caps` | Small Caps | `/commodities` | Commodities |
| `/investors` | Investor Radar | `/fundamentals` | Fundamentals |
| `/portfolio` | Portfolio | `/education` | Education |
| `/watchlist` | Watchlist | `/strategy-lab` | Strategy Lab |
| `/comparison` | Comparison Lab | `/alerts` | Alerts |
| `/paper` | Paper Trading | `/whats-new` | What's New |
| `/trading` | Bot Readiness | `/settings` | Strategy Rules |
| `/simulation` | Simulation Lab | `/calculators` | Calculators |

Off-nav surfaces: `/welcome` (landing), `/onboarding` + `/onboarding/activation` (cinematic onboarding), `/auth/login`, `/auth/signup`, `/account`, `/privacy`, `/tickers/[symbol]`, `/themes/[slug]`, `/ipos/[symbol]`.

## Review checklist for any UI change

- [ ] Renders at 390px with no horizontal page overflow
- [ ] Stat values no larger than `text-sm md:text-base`; labels in the 9-11px band
- [ ] Inputs untouched by density (16px pin intact on coarse pointers)
- [ ] Depth behind accordion/drawer, breadth behind rotation/carousel - page height did not balloon
- [ ] New nav entries added to `navItems` only (colour comes from the ramp; both rails update automatically)
- [ ] Dark-shell components not used on light surfaces and vice versa
- [ ] Page body has `pb-28 xl:pb-6` (or equivalent) so the bottom nav never covers content
