# Changelog

All notable changes to Lyra are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/releases/tag/v0.1.0
