# Changelog

All notable changes to Lyra are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.1] - 2026-07-16

Review hardening: honest copy, fresh fill prices, smarter doc answers.

### Changed

- The BYOK copy now tells the exact truth: your AI key is held by your browser and sent only with your own requests to your own deployment - never stored server-side.
- Logged trade fills are priced fresh: the trade-confirm path bypasses the 60s quote cache, so a recorded fill price can never come from a cached preview.
- In-app doc answers got sharper and safer: natural questions ("what is lyra?", "how much does this cost?", "how do I set this up?") now find the right doc, while market and advice questions can never pull doc examples into the prompt.
- /api/health now verifies the Redis cache with a real PING (reports upstash-unreachable when it is down), and cache writes are awaited so serverless deploys cannot silently drop them.
- Goal-card accessibility: only the visible face is read by screen readers, keyboard focus survives the Setup Companion refresh, all animation respects reduced-motion - and cost badges no longer wrap broken on phones.

## [0.9.0] - 2026-07-16

Continuous intelligence + a robust agent harness.

### Changed

- New Signal Intelligence board on Small Caps: it scans every independent signal across the universe - government backing, big-tech capital, smart money, supply-chain bottlenecks and turning momentum - and ranks the names where several converge at once. Convergence of independent signals is the highest-conviction "look here," and it is scored deterministically, never guessed.
- The government-backing signal is now LIVE, not static: Lyra pulls real US federal contract awards for the small-cap watchlist from USAspending.gov (a free, keyless source), caches them, and shows exactly whether each award is live or an illustrative sample - so official spend, an early pre-consensus read, is continuously fetched rather than hand-curated.
- The AI co-pilot can now reason over that convergence intelligence as a first-class, read-only tool - it finds and cites the most effective data points instead of narrating a single fixed snapshot, while still only explaining what the engine computed.
- A hardened safety layer around every AI answer: one unified guardrails verdict (blocks trade advice, prompt-injection echoes, and ungrounded numbers; flags predictive overclaims) is enforced at the answer boundary, backed by an eval-gate - a safety test set that turns the build red if any guard is ever weakened.
- Under the hood, the AI gateway is more resilient: transient provider failures are retried with backoff, and a concurrency limiter plus spend budget stop a burst of requests from running away. Plus a new roadmap pitch - your private Digital Trading Twin (docs/strategy + README).

## [0.8.0] - 2026-07-16

Setup Companion, agent onboarding, Redis cache + a knowledge layer.

### Changed

- Running /setup now opens a live Setup Companion in your browser - a premium spec of the whole stack (real logos, honest cost badges) plus a stage-by-stage progress board your agent updates as it builds. Also served in-app at /setup-companion.html.
- Six animated "ultimate goal" cards - punchy on the front, tap to flip for the detail - on the companion AND the landing page, alongside the full stack grid with per-technology costs.
- Agents get a front door: AGENT-ONBOARDING.md (mission, setup contract, security ground rules, verification gates) plus ONBOARDING.md, the ledger of every onboarding asset and experience.
- The AI co-pilot now answers questions about Lyra itself with citable sources: a deterministic knowledge layer compiles the reference docs at build time and retrieves the relevant sections into chat - no embeddings, no new services, works in demo mode.
- Optional Redis caching (Upstash REST) for market quotes and hot reads - a pure optimisation with an in-process fallback, so nothing new is ever required. /api/health reports the active cache backend.
- Deploying is agent-friendly: walkthrough 04 and /setup include the full Vercel CLI path (login, link, env, deploy) so an agent can put Lyra online end to end.

## [0.7.0] - 2026-07-16

Replicate it: walkthroughs, /setup agent, Docker/Coolify, full costs.

### Changed

- Share the repo link and anyone can run their own Lyra: six adversarially fact-checked walkthroughs (docs/walkthroughs/) cover what it is, running it in 5 minutes, going live on your own Supabase, deploying, reading the score, and getting alerts on your phone.
- Claude Code users can skip the manual path entirely: run /setup in a fresh clone and the bundled agent playbook (.claude/commands/setup.md) sets everything up end to end, with a verification gate at every stage and costs shown before anything paid.
- Self-hosting is now first-class: a production Dockerfile (Coolify/Docker), a public /api/health probe that reports the running version and mode, and a Coolify deploy runbook (docs/runbooks/coolify-deploy.md).
- COSTS.md itemises every service in the stack with prices verified on provider pages - demo is $0, a fully live always-on setup runs on free tiers, self-hosting is about US$13/mo.
- Setup truth fixes: supabase/migrations/ is documented as the canonical schema (with the one sql/ reconciliation script that follows it), and the README quick start now matches the real dev port.

## [0.6.0] - 2026-06-27

TradingView Copilot + Pine strategy export.

### Changed

- Export any name as a TradingView strategy - click "Pine" on the chart toolbar to copy a backtestable Pine v5 strategy that reproduces Lyra's exact oversold-recovery score. Paste it into TradingView and backtest the same logic that surfaced the setup.
- The generated Pine is a faithful, drift-guarded mirror of the scanner engine (signal_engine.py): same RSI reset band, MACD-histogram recovery, 60-period-low distance, trend and volume rules, capped at 100.
- New TradingView Copilot runbook (docs/tradingview-copilot.md): drive your TradingView Desktop from Claude over the Chrome DevTools Protocol - read the live chart, switch symbol/timeframe, inject + backtest the Lyra strategy, run replay, and screenshot back into a Finding. All local, research only.

## [0.5.1] - 2026-06-20

Brand + UI polish, Find/Graph fixes.

### Changed

- Fixed Find and Graph: push-test and system notifications were showing up as "findings" (and left the graph blank). Those are now filtered out, so Find shows real setups (or the demo set until the scanner surfaces yours) and the graph is never empty.
- Find and Graph moved down the navigation - they were over-promoted to the #2/#3 mobile slots; your daily surfaces (Portfolio, Trades, Watchlist) now come first.
- New Lyra logo - the app-icon arrow (a white up-right arrow on the gradient square) is now the in-app logo, the loading screen and the browser-tab icon, matching your home-screen and email icon.
- The Getting started checklist is now collapsible (and renamed from "Get started").
- The app version and its release date are now visible on the landing page and in the account menu, both linking to this changelog.

## [0.5.0] - 2026-06-20

Dogfooding gap-closers from the functionality audit, plus a visible version number on the landing
page and a version-numbered in-app changelog (`/whats-new`) so what is deployed is always legible.

### Added

- **App version + in-app changelog.** The landing page shows the current version (so you can tell at
  a glance whether the deploy updated), and `/whats-new` leads with a version history. Single source of
  truth: `src/lib/version.ts` (kept in lockstep with this file + `package.json`).
- **Finding lifecycle controls.** The finding drawer now has live promote/dismiss actions (Watchlist
  candidate / Deep research / Paper-bot queue / Review risk, plus "Dismiss as noise") wired to the
  lifecycle API; they appear only on live findings and refresh the feed on save. (Were display-only.)
- **Account currency in onboarding.** The capital step now captures your base currency (defaults AUD)
  and writes it to your profile, so AUD/`.AX` trades log straight away instead of being rejected until
  you visit Account settings.
- **Two-week rating prompt.** After ~2 weeks of use, a compact "Has Lyra helped you trade?" 5-star
  prompt appears once (never on day one); the rating routes through the existing feedback intake.
  "Maybe later" snoozes a week. Preview any time with `?rate=now`.

### Changed

- **`/graph` is now live-wired** - the relationship map builds from your real findings (demo fallback
  when none), and both `/findings` and `/graph` render at request time so per-user data actually shows
  (they were being served from a build-time demo snapshot).

## [0.4.0] - 2026-06-18

Currency-safe trade logging + the Investigation System taken from a single feed to a full
investigation surface (the relationship graph, live data, and AI-generated views). Every change in
this release was put through an adversarial multi-dimension review before merge; the seven defects it
confirmed (including a critical cross-currency one) were fixed in the same pass - that history is
recorded below under "Caught in review." Still research software, no live execution.

### Added

- **Investigation Graph at `/graph`** - one explorable relationship map across every finding.
  Shared nodes collapse, so the map shows what the per-finding drawer cannot: which names sit on the
  same supply-chain bottleneck, theme, or government buyer. Tap any node to open its drawer and walk
  its evidence + connections; the drawer state is URL-persisted (shareable, reload-safe). Deterministic
  layout, deterministic data.
- **Live findings** - `/findings` now projects real `notification_events` (scanner signals, theme
  moves, discoveries, portfolio risk) into the investigable Finding shape via a pure adapter, with a
  lifecycle table (`findings`) for reversible promote/dismiss. Falls back to demo findings when signed
  out or before the scanner has surfaced anything. The projection never invents a number.
- **Generated views in the drawer (GenUI)** - "want to see what this looks like?" composes a compact
  view on the spot: the AI chooses the layout + prose, but every number is engine-owned and pulled
  from the deterministic finding. Guarded so the AI cannot smuggle a figure (digit OR spelled-out) or
  an advice/"Buy" phrase into the view; with no model connected it renders a deterministic default,
  never a blank.
- **Richer entity drawers** - an entity now shows the evidence that touches it, walkable from both the
  feed and the graph.

### Changed

- **Currency-aware trade logging.** Account cash is held in a base currency (owned by your profile).
  A trade priced in a different currency (e.g. an ASX `.AX` name quoted in AUD against a USD account)
  is now rejected with a clear message instead of silently corrupting the cash pool and average cost -
  FX conversion is a later phase. Trade currency is stamped on positions + logs. The chat trade
  preview declines a cross-currency buy up front rather than offering a confirm card that would fail.

### Caught in review (fixed pre-merge)

- **Cross-currency guard read the wrong table.** The base currency is written to `profiles`, but the
  guard read `operator_profiles` (never written -> stuck at the `USD` default). For the default AUD
  user this inverted the guard: it would have rejected valid AUD trades and *allowed* a USD trade to
  corrupt an AUD book - the exact failure the feature exists to prevent. Now both the RPC and the chat
  preview read the base currency from `profiles`. (Known limitation: base currency is set in Account
  settings; until set it defaults to `USD`, so the guard fails safe by rejecting, never by corrupting.)
- **GenUI advice + spelled-out numbers.** The fabrication guard checked digits only, so "strong buy,
  load up" or "doubles to a forty dollar target" passed. Added a lexical advice/quantity filter; a hit
  drops the block to the deterministic default.
- **Live finding scores.** `relevance_score` (DB-defaults to 100) was being shown as the headline
  composite, making non-scanner findings read a false 100/100. It is now kept as confidence only;
  findings with no real composite read "NR" (not rated).
- **Dismiss was permanent.** The lifecycle RPC never cleared `dismissed_at`, so a re-promote was a
  silent no-op. A promote now clears the dismissal.
- **Graph theme nodes overlapped.** Multiple zero-radius (center) theme nodes stacked on the exact
  same point, rendering as one unclickable blob; they now spread on a small inner ring.
- **GenUI breadcrumb** showed the raw finding id instead of "Generated view".

### Ops

- New migrations: `027_trade_currency.sql` (currency columns + currency-aware `log_buy_trade`),
  `028_findings.sql` (findings lifecycle table + `set_finding_lifecycle`). Apply with 026 against the
  live DB.

## [0.3.0] - 2026-06-18

Dogfooding-readiness pass. A deep adversarial audit found the deterministic core was excellent but
the app was "unplugged" - built fast in pieces and never wired end to end (each part passed in
isolation; the seams did not). This release closes that last mile across nine systems and adds the
Investigation surface. Still research software, no live execution.

Design ethos worth recording: Lyra holds a strict dense / compact command-centre standard - small
type scale, hairline dividers, miniaturised stat tiles, no wasted space. Density is a forcing
function. It resists generic, padded "AI slop" layouts and lands on something production-grade far
faster.

### Added

- **Investigation System (Phase 1)** at `/findings` - every surfaced setup is an Opportunity
  Finding you can investigate by peeling back layers: finding -> evidence -> source record ->
  entity -> connected pattern, in a nested drawer stack whose state is persisted in the URL
  (shareable, reload-safe). Every evidence item carries an explicit "what it does not prove."
- **Persistent Trade Log** at `/trades` - a durable view of logged buys with per-row undo, so
  reversal is no longer trapped in an ephemeral chat bubble.
- **Education in context** - jargon defined inline on the Signal Radar, Ticker Detail, and the
  analytical spaces (tooltips + glossary drawers), each linking into the academy.
- Conversational buy logging now previews the live quote (shares, fill price, cash left) before you
  confirm; declarative sell-log requests get an honest "not yet" reply instead of a generic answer.

### Fixed

- **Notifications now actually deliver.** Signal alerts route multi-channel (web push / Telegram /
  WhatsApp) stamped with the user id, not a hardcoded legacy channel; quiet hours are evaluated in
  the user's timezone (was server UTC, which inverted the window); deferred alerts are held and
  released on the next tick (was a digest queue with no drainer - silent loss); the hourly cron now
  passes the dispatch env (was inert in production); chat channels are verified before delivery;
  WhatsApp uses approved templates; push renders the full message (data + why + disclaimer);
  demo_logged no longer counts as delivered.
- **Trade undo can no longer corrupt a position** - undo is now reverse-chronological per symbol
  (the prior absolute-snapshot restore wiped a later buy when an earlier one was undone).
- **Onboarding no longer silently drops your book** - watchlist/portfolio saves check the result
  and surface a retry instead of showing "all set"; typed tickers persist; the push toggle registers
  a real browser subscription; beginner answers reach the AI's constraints.
- **AI correctness** - the default Anthropic model was a retired id (a hard failure for BYO Claude
  users); the fabrication guard is now actually called; education modules feed the AI corpus; the
  run audit trail persists instead of evaporating on cold start.
- **Signal honesty** - StrategyLab unit mismatch fixed (the default strategy showed 0 matches);
  per-component score bars no longer read 0 in the live path; a dead or stale scan now shows an
  amber/red badge instead of a confident green "Live"; fabricated backtest stats relabelled
  illustrative.

### Changed

- **Renamed the strategy from "momentum" to "oversold-recovery"** end to end. The engine rewards an
  RSI reset, an improving-but-still-negative MACD histogram, and price near its 60-day low, so a
  high score means "a beaten-down name turning up," not "breaking out to new highs." The words now
  match the math.
- One shared page-title token for consistent typography; worker dependencies pinned to ranges; dead
  code (GlassMomentumChart) and a dead env flag removed.

### Ops

- Vercel env + GitHub Actions secrets fully wired (the two-store model: app env vs scanner/CI
  secrets, environment-scoped where needed); live DB migrated 022-026 (onboarding capture,
  conversational trade logs, multi-channel push, the undo-order guard).

## [0.2.0] - 2026-06-12

Lyra grows from a momentum scanner into a thematic-intelligence + research platform, with
the security-first foundations a future trading bot would sit on. Still research software,
no live execution.

### Added

- **World Radar** - thematic intelligence that scans the causal chain behind returns: 10
  secular themes (AGI infrastructure, space, power grid, nuclear, semiconductors, critical
  minerals, and more), each with a first-principles supply-chain map, ranked companies, and
  a "what would prove this wrong" falsifier. AGI infrastructure and space are mapped deepest.
- **Small-cap discovery engine** - deterministic opportunity scoring (theme fit, bottleneck
  exposure, evidence, momentum) that sorts under-discovered names into honest buckets,
  including an explicit "avoid - dilution / hype risk" list.
- **Investor Radar** - tracked managers' disclosed 13F moves with first-class delay caveats;
  surfaces which small caps elite money is touching. Research context, never copy-trading.
- **Signal events engine** - deterministic detection of the major timing events: MACD
  crosses, RSI oversold/overbought crossings and the behavioural recovery/rollover, plus
  Bollinger breaks. Each event pins as a static SIGNAL for 24h and is then tracked as a
  story (price/score move since the trigger). Unit-tested for accuracy.
- **Paper trading** - a simulated account with realistic fees + slippage, a trade journal,
  and honest per-strategy readiness gates that say "not ready for automation" until the
  evidence exists.
- **Bot Readiness** - the deterministic pre-trade risk engine (kill switches, position /
  loss / liquidity / staleness checks, fail-closed), shown refusing a demo order. Live
  broker execution is intentionally not implemented; AI never creates orders.
- **Chart studies** - independent Bollinger / RSI / MACD toggles on the Command holdings
  charts and the ticker page, plus a one-tap **Full Setup** button that jumps to a stock
  with all three studies pre-activated.
- **AI-native content layer expansion** - themes, supply-chain nodes, companies, capital
  events, and investors all live in agent-editable JSONL compiled to importable JSON.
- **Security + messaging foundations** - secret-verified Telegram webhook + pairing flow,
  signature-verified WhatsApp architecture, a unified notification router (quiet hours,
  dedupe, safety-critical bypass), and AI guardrails (prompt-injection isolation, tool
  permissions, citation enforcement). Evidence-store + trading Supabase migrations with RLS.
- **Documentation system** - architecture, security (threat model, OWASP LLM mapping,
  webhooks, trading risk controls, incident response), runbooks, testing, product, and the
  broker-adapter spec.

### Changed

- **Living Command** - the executive strip rotates Your Book / Watchlist leaders / losers /
  picks; metric and IPO tiles roll through three faces on a calm cadence; the Daily Brief
  "listens" and injects NEW/HOT lines; the watchlist board explains its two-gate trigger
  mechanic; the market and AU-macro strips became Intel-style ticker tapes with plain-English
  reads and tappable sources (renamed MARKETS / AU MACRO).
- **Collapsible Holdings Momentum** - collapse-all + per-card collapse; compact currency
  chips ($13.1K) that fit one line.
- App-wide one-eye-line density pass across stat grids; nav icons ramp through the Lyra
  palette; education gained a proper beginner/intermediate/advanced learning path.

### Fixed

- TradingView studies now actually apply - switched from the raw embed iframe (which ignored
  the `studies` and toolbar params) to the official advanced-chart widget script.

## [0.1.0] - 2026-06-08

Initial public release. Lyra is a research-first, mobile-dense momentum console for US
technology stocks. Runs on built-in demo data with zero setup.

### Added

- **Momentum engine** - deterministic 0-100 recovery score from RSI, MACD histogram, price
  location, trend context, and volume participation, on an hourly cadence.
- **Command centre** with executive strip, daily brief, holdings momentum board, and signal
  table; **Signal Radar** and **Live Wire** feed.
- **Personal surfaces** - Portfolio, Watchlist, and a **Comparison Lab** with an adaptive
  axis (time-only intraday, day-only over longer windows) and a hover/drag date scrubber.
- **Research surfaces** - Simulation Lab, Strategy Lab, Calculators, Calendar, IPO Radar
  and deep-dive, Intelligence feed, Smart Money, Commodities, and Fundamentals.
- **Learn** - a beginner/intermediate/advanced learning path with inline topic drawers, plus
  a glossary hub.
- **Three run modes** - demo (no keys), live (Supabase + market data + Telegram alerts), and
  an optional AI explanation layer.
- **AI-native content layer** - editorial data (IPOs, smart money, commodities) lives in
  `content/*.jsonl` and compiles to importable JSON, so facts are updated by editing one line.
- **Ultra-compact, mobile-first density** across every stat surface.
- **Product updates timeline** (What's New) - a vertical chain with a colour-coded dot per
  update (feature / improvement / mobile / data / fix), filterable and searchable.
- Project docs: README, LICENSE (MIT), SECURITY, PRIVACY, DISCLAIMER, CONTRIBUTING, and a
  Code of Conduct.

### Fixed

- First-time visitors now land on the marketing page (then step into onboarding) instead of
  being dropped straight into setup.

### Notes

- Research software, not financial advice. See [`DISCLAIMER.md`](DISCLAIMER.md).

[Unreleased]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.9.1...HEAD
[0.9.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/releases/tag/v0.1.0
