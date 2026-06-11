# Integration Plan — Stock Momentum Radar

**Status:** build-ready spec · **Date:** 2026-06-03 · **Owner:** Bryson

This is the third doc in the set. It does not restate the product vision — it grounds it.

- [`vision.md`](./vision.md) — the "personal market operating system" (12 sections, four brains, AI cost control). The *what* and *why*.
- [`horizons.md`](./horizons.md) — H1→H4 sequencing and the H1A–H1D delivery plan. The *order*.
- [`onboarding.md`](./onboarding.md) — the guided 7–9 step setup flow (Quick Start / Watchlist-first / Portfolio-first), progressive enrichment, the **Trade Day Snapshot** engine, and the onboarding data model. The *first-run experience*.
- **`integration-plan.md`** (this doc) — maps that vision onto the **code that actually exists today**, names exactly **what to harvest** from the three reference apps, and turns each horizon into concrete files to create / edit / port with done-when criteria. The *how*.

Anchored to the ethos rule that overrides everything else:

> **The backend is truth. AI is interpretation.** Deterministic mathematics owns every score, state, and number. AI may explain, summarise, compare, and teach — it may never fabricate a signal.

---

## 0. Build log — shipped 2026-06-03 (demo-safe scaffolds)

A full vision build pass landed. All new surfaces render with deterministic demo data and graceful fallback (no backend/keys required); live wiring is the remaining step per surface. Verified: full `tsc --noEmit` clean, RSC boundaries correct, 51 Python worker tests passing.

```text
FRONTEND PAGES (new, demo-safe):  /comparison  /simulation  /calendar  /intelligence
                                  /fundamentals  /education  /strategy-lab
WRITE PATHS (now live):           /api/portfolio + /api/watchlist route handlers + wired
                                  AddHoldingForm / AddWatchRuleForm (demo-safe if no Supabase)
COMMAND CENTRE:                   MarketContextStrip (regime + indices/VIX/10Y/BTC/Fear&Greed)
TICKER DETAIL:                    OutcomeHistoryPanel ("past similar setups returned…")
NAV:                              AppShell rail expanded to the full 12-section map
WORKER (Python, tested):          market_context.py (free no-key sources) + guarded main.py hook
                                  outcome_engine.py (forward 1D/5D/20D/60D returns + DD/upside)
                                  backtest_engine.py + paper_trading.py (research only, NO broker)
SQL migrations added (not yet run on live DB): 002_market_context, 003_signal_outcomes,
                                  004_backtesting
```

Still dormant pending the operator's Supabase + a live data source: persisting market-context/outcomes/backtests to Supabase, running migrations 002–004, and flipping each demo lib (`market-context.ts`, `outcomes.ts`, `backtest.ts`) to read live. Horizon-2 news/fundamentals/calendar pages currently render demo data; they light up when a Finnhub key + ingestion worker are added.

---

## 1. Grounded current state (verified 2026-06-03)

This is what is **real** in `vdapp42-stock-momentum-radar`, confirmed by reading the code — not aspiration.

**Stack:** Next.js 15 + React 19 + TS frontend (custom SVG charts, dark terminal theme, Tailwind, no chart library). Python worker (`workers/stock_scanner/`, 18 modules) using pandas + `ta` + yfinance. Supabase Postgres. Telegram alerts. Hourly GitHub Actions cron. Frontend reads Supabase **read-only** with a demo-data fallback.

**Pages that exist (7):** Command Centre (`/`), Signal Radar (`/radar`), Portfolio (`/portfolio`), Watchlist (`/watchlist`), Ticker Detail (`/tickers/[symbol]`), Alerts (`/alerts`), Settings (`/settings`).

**Worker pipeline that runs hourly:** universe load → yfinance OHLCV → `indicators.py` (RSI-14, MACD 12/26/9 + histogram + slope, SMA 20/50/200, EMA 12/26, volume ratio, distance-from-low) → `signal_engine.py` (5-component 0–100 score: RSI/MACD/price-location/trend/volume) → lifecycle + action state + status → `portfolio_engine.py` / `watchlist_engine.py` overlays → `alert_engine.py` → `telegram.py` → Supabase persistence + `stock_scanner_runs` log.

**Schema that exists (already strong):** `stock_tickers`, `stock_candles`, `stock_indicators`, `stock_signal_scores`, `stock_signals` (with lifecycle + explanation JSON), `portfolio_positions`, `portfolio_signal_overlay`, `watchlist_items`, `watchlist_signal_overlay`, `stock_alerts`, `stock_scanner_runs`. This already matches the `vision.md` "core tables" list almost exactly.

**Tests:** Python unit tests for signal, indicators, portfolio, watchlist, alert, scheduler-guard engines.

### What is stubbed or missing (the honest gap list)

This list was the pre-build baseline. Items closed in this session are struck through and re-stated in §0.

```text
Universe:     43 tech tickers seeded, not the target ~100                          [still open]
Pages:        Comparison/Simulation/Calendar/Intelligence/Fundamentals/Education/
              Strategy Lab                                                          [DONE — demo-safe §0]
Write paths:  Add-holding + add-watch-rule                                          [DONE — live routes §0]
Charts:       Custom SVG line/bar/heatmap; no candlestick / dedicated RSI-MACD-vol  [still open]
Timeframe:    1h only (hardcoded). No 1D / 1W.                                       [still open]
Trigger:      Hourly cron only. No "Run scan now" button. Header search inactive.    [still open]
Context:      Market-regime strip                                                   [DONE — demo §0]
              News / fundamentals / events / hype                                    [scaffolded demo; live = H2]
AI:           Deterministic template explanations (good). No LLM layer.              [still open — H3]
Outcome loop: Forward-return feedback                                               [DONE — engine + panel §0]
Onboarding:   No first-run flow; app is single-operator (no auth / user_id)          [open — see §4 phase]
```

**Headline:** the deterministic spine and the read-only cockpit were already aligned to the vision. This session closed the write-paths, the seven net-new pages (demo-safe), the market-regime strip, and the outcome feedback loop. What remains is live data wiring, multi-timeframe, the AI layer (H3), and the onboarding/auth layer (below).

---

## 2. Harvest map — what to take from the reference apps

Critical architecture constraint: **vdapp42's frontend only reads Supabase; all data is produced by Python workers.** The two newsletter apps are Node/TypeScript/Prisma, so their logic ports as **patterns reimplemented in Python**, not copy-paste. The trading bot is already Python, so it ports far more directly.

### vdapp22-trading-bot → highest-value, ports directly (Python)

```text
market_summary.py   → new worker module: market_context.py
                      Drop-in. requests-only. Pulls indices (^GSPC ^IXIC ^DJI...),
                      forex, commodities, bonds (^TNX ^TYX), crypto (CoinGecko),
                      and the Fear & Greed index (alternative.me).
                      ALL FREE ENDPOINTS, NO API KEY → demo-safe today.
                      Feeds market-regime context beside per-ticker scores.

intelligence.py     → new worker module: ai_summary.py
                      Adapt. Claude capital-brief / regime-read / theme / risk-scan,
                      each with a 30-min in-memory cache and graceful no-key fallback.
                      CHANGES REQUIRED on port: model must be configurable (repo rule
                      00-repo-principles forbids hardcoded model versions; vdapp22
                      hardcodes claude-sonnet-4-5). Wire to the AI cost-control tiers
                      in vision.md (Tier 0 templates → Tier 1 cheap → Tier 2 deep).

risk.py             → reference for Horizon 4 only (kill-switch, daily-loss gate,
                      position sizing). Do NOT wire execution before H4.

bybit_client.py     → reference only. vdapp42 is research-first; no broker until H4.
```

### vdapp38-ai-newsletter → patterns for the Intelligence Feed (reimplement in Python)

```text
ingest.ts connector pattern   → intelligence_worker/news_provider.py
                                 (RSS / API / page normalised into one news row)
triage.ts + citation system   → relevance_engine.py + sentiment_engine.py
                                 (relevanceScore 0–100, sourceType, confidence,
                                  ticker mapping — sits BESIDE the technical score)
taxonomy.ts                    → deterministic tag/lens assignment before any LLM call
SourceFavicon.tsx              → port to a small React component for company logos
                                 (this one IS a near drop-in for the frontend)
```

### vdapp3-financial-newsletter-gekkos → schema shapes + free-data patterns

```text
Yahoo v8 + CoinGecko fetch helpers → confirm/borrow patterns (already proven in
                                      vdapp22's Python; gekkos versions are TS)
NewsAlert model shape              → news_items / ticker_news_map tables
                                      (relevantSymbols, matchedKeywords, relevanceScore)
EconomicIndicator + earnings shape → company_events / market_calendar_events tables
                                      NOTE: gekkos calendar/news data is ~70% MOCK.
                                      Borrow the SHAPE; wire a live source separately.
```

**One-line harvest verdict:** vdapp22 gives a working market-context engine and a production Claude layer (both Python, near-immediate value). vdapp38 gives the Intelligence-Feed blueprint (patterns, reimplemented). vdapp3 gives schema shapes for calendar/news (mostly shapes, not live data).

---

## 3. Gap → Horizon mapping

```text
HORIZON 1  Technical console      → close write-paths, add Comparison Lab + Simulation Lab,
(now)                               grow universe toward 100, multi-timeframe, manual scan,
                                    market-context strip (vdapp22 market_context.py),
                                    signal-outcome tracking (the feedback loop)
HORIZON 2  Market context         → Intelligence Feed page + news/sentiment/hype workers
                                    (vdapp38 patterns), Calendar page + events worker
                                    (vdapp3 shapes), fundamentals worker, event-risk badges
HORIZON 3  AI + education          → ai_summary.py contained explain-drawers + daily digest
                                    (vdapp22 intelligence.py), Education Hub, Strategy Lab,
                                    metric-recommendation engine, ai_explanations cache table
HORIZON 4  Controlled execution    → backtest worker, paper trading, risk-policy engine
                                    (vdapp22 risk.py), broker connector, semi-auto trade review
ONBOARDING (cross-cutting)         → guided 7–9 step setup, progressive enrichment, Trade Day
(onboarding.md)                     Snapshot engine (reuses outcome_engine), onboarding data model;
                                    PREREQUISITE: a per-user/auth layer (app is single-operator today)
```

---

## 4. Sequenced build plan

Each step names the **files to create/edit/port** and a **done-when**. Steps inside a horizon are ordered for lowest-risk, highest-leverage first. Everything stays demo-safe (graceful fallback) and respects tenant/secret rules: worker-only secrets stay unprefixed; never expose `SUPABASE_SERVICE_ROLE_KEY` or `ANTHROPIC_API_KEY` to the frontend.

### Horizon 1A — Write-paths + market context (start here)

The single biggest unlock: make Portfolio and Watchlist actually personal, and add regime context that's free and immediate.

```text
1. Portfolio + Watchlist write paths
   - CREATE  src/app/api/portfolio/route.ts        (POST/DELETE → Supabase)
   - CREATE  src/app/api/watchlist/route.ts        (POST/DELETE → Supabase)
   - EDIT    src/app/portfolio/page.tsx            (wire the stub form, enable button)
   - EDIT    src/app/watchlist/page.tsx            (wire the stub form, enable button)
   - SAFETY  write via a server route using service key, never anon-from-browser;
             validate inputs; these are user-owned rows so no cross-tenant concern
   DONE WHEN: a holding/watch-rule added in the UI persists and shows an overlay next scan.

2. Market-context engine (harvest vdapp22 market_summary.py)
   - CREATE  workers/stock_scanner/market_context.py   (port, requests-only, free APIs)
   - CREATE  sql/00X_market_context.sql                (market_context_snapshots table)
   - EDIT    workers/stock_scanner/main.py             (call once per run, persist snapshot)
   - EDIT    src/app/page.tsx                          (Command Centre regime strip:
                                                        indices, VIX-proxy, Fear & Greed)
   DONE WHEN: Command Centre shows live market regime beside the setups, demo-safe.
```

### Horizon 1B — Comparison Lab + multi-timeframe + manual scan

```text
3. Comparison Lab (vision §6, horizons H1D)
   - CREATE  src/app/comparison/page.tsx
   - CREATE  src/components/charts/ComparisonChart.tsx  (extend ChartPrimitives.tsx SVG)
   - EDIT    src/components/AppShell.tsx                (add nav item)
   DONE WHEN: checkbox N tickers → normalised return + relative RSI/MACD/score overlay.

4. Multi-timeframe (1D / 1W alongside 1H)
   - EDIT    workers/stock_scanner/config.py           (timeframe list, not single)
   - EDIT    workers/stock_scanner/main.py + indicators (loop timeframes)
   - EDIT    schema unique keys already include timeframe — verify, no migration likely
   - EDIT    src/components/AppShell.tsx               (make the 1H badge a selector)
   DONE WHEN: radar + ticker detail switch between 1H/1D/1W from stored data.

5. Manual scan trigger
   - CREATE  src/app/api/scan/route.ts                 (guarded trigger; respect cooldown)
   DONE WHEN: a "Run scan now" control kicks a run and the Last-Scan badge updates.
```

### Horizon 1C — Simulation Lab + signal-outcome feedback loop

```text
6. Simulation Lab (vision §7) — pure deterministic math, no AI
   - CREATE  src/app/simulation/page.tsx
   - CREATE  src/lib/simulation.ts        (R/R, position weight, exposure-after-trade,
                                           bull/base/bear, compounding projection)
   DONE WHEN: enter cash+entry+stop+target → R/R, portfolio weight, exposure shift,
              and scenario outcomes render instantly.

7. Signal-outcome tracking (the feedback loop — vision §8, the eventual edge)
   - CREATE  sql/00X_signal_outcomes.sql   (forward 1D/5D/20D/60D return + max DD/upside)
   - CREATE  workers/stock_scanner/outcome_engine.py  (backfill returns onto past signals)
   - EDIT    src/app/tickers/[symbol]/page.tsx        ("past similar setups returned…")
   DONE WHEN: a triggered setup shows historical forward-return distribution for its type.
```

### Horizon 2 — Context layer (Intelligence Feed, Calendar, Fundamentals)

```text
8. Intelligence Feed (vdapp38 patterns, reimplemented in Python)
   - CREATE  workers/intelligence_worker/{main,news_provider,sentiment_engine,
             relevance_engine,hype_engine}.py
   - CREATE  sql/00X_intelligence.sql   (news_items, ticker_news_map, hype_scores)
   - CREATE  src/app/intelligence/page.tsx + src/components/SourceFavicon.tsx (port)
   - CREATE  .github/workflows/...daily-intelligence.yml
   SAFETY:   deterministic relevance/sentiment first; LLM only on top-ranked items (cost control)
   DONE WHEN: dense feed of ticker-tagged, relevance-scored items sits beside scores.

9. Calendar + event risk (vdapp3 shapes, live source wired separately)
   - CREATE  sql/00X_calendar.sql   (company_events, market_calendar_events)
   - CREATE  workers/intelligence_worker/company_events.py
   - CREATE  src/app/calendar/page.tsx + event-risk badges on radar/detail
   DONE WHEN: "earnings in N days → event risk elevated" shows on setups.

10. Fundamentals layer
   - CREATE  workers/fundamentals_worker/* + sql/00X_fundamentals.sql
   - EDIT    ticker detail → Fundamentals tab
   DONE WHEN: revenue/growth/margins/EV-EBITDA render per ticker.
```

### Horizon 3 — Contained AI + education

```text
11. AI explanation + daily digest (harvest vdapp22 intelligence.py)
   - CREATE  workers/intelligence_worker/ai_summary.py   (configurable model, cached)
   - CREATE  sql/00X_ai_cache.sql   (ai_explanations: ticker, signal_id, input_hash, model)
   - EDIT    ticker detail → AI Explain drawer (structured 7-part format from vision)
   SAFETY:   Tier 0 templates → Tier 1 cheap → Tier 2 deep; cache by input hash;
             AI never overrides a deterministic number; eval notes per repo AI rules.
   DONE WHEN: top-5 setups get a cached structured brief; cost stays bounded.

12. Education Hub + Strategy Lab
   - CREATE  src/app/education/page.tsx (+ contextual "Explain this" buttons)
   - CREATE  src/app/strategy-lab/page.tsx + packages/strategies/*.py
   DONE WHEN: metrics explained against live examples; strategies definable + backtestable.
```

### Onboarding phase — first-run experience (onboarding.md)

Best sequenced after H1 write-paths (which now exist) and alongside H2, because the Trade Day Snapshot engine depends on historical reconstruction + the outcome engine (already built). Core principle from the doc: **let the user get value before asking for perfect data** — ticker-only entries are valid; everything else is progressive enrichment.

```text
PREREQUISITE — auth / multi-user (architecture decision):
   The app is single-operator today (no user_id, no auth; portfolio/watchlist are global rows).
   onboarding.md's data model is per-user. Decide one of:
     (a) keep single-operator → drop user_id, treat onboarding as local setup state, OR
     (b) add Supabase Auth + user_id columns + RLS (bigger change, true multi-user).
   Do NOT build the onboarding tables until this is chosen — it determines every schema below.

1. Onboarding flow (frontend, demo-safe)
   - CREATE  src/app/onboarding/page.tsx + src/components/onboarding/*
             (OnboardingShell, OnboardingProgress, WelcomeHero, SetupPathCards,
              OperatorProfileForm, MarketUniverseSelector, TickerChipCloud,
              WatchlistBuilder, PortfolioBuilderTable, TradeSnapshotExplainer,
              CapitalContextForm, AlertPreferencePanel, SetupSummaryCard)
   - Reuse the existing /api/portfolio + /api/watchlist write routes for the
     watchlist/portfolio steps (already live). Skippable at every step.
   - "Setup completeness" widget + progressive-enrichment cards post-onboarding.
   DONE WHEN: a new operator can go Welcome → universe → watchlist → (optional) holdings →
              alerts → generated Command Centre, skipping anything, demo-safe.

2. Trade Day Snapshot engine (Python worker — reuses outcome_engine.py)
   - CREATE  workers/stock_scanner/trade_snapshot_engine.py
             (given a holding + buy date: reconstruct entry-day RSI/MACD/vol/MA position +
              signal score from stored history, then forward 5D/20D/60D/120D returns +
              max DD/upside via the existing outcome math, + a deterministic learning summary)
   - CREATE  sql/00X_onboarding.sql  (operator_profiles, operator_preferences,
             trade_day_snapshots, onboarding_progress — schema per onboarding.md, adjusted
             for the auth decision above)
   - CREATE  src/lib/onboarding.ts + src/lib/trade-snapshots.ts (types + demo)
   - Best-trade / worst-trade cards on the Command Centre once snapshots exist.
   DONE WHEN: a holding with a buy date produces a Trade Day Snapshot with entry context +
              forward performance + a plain-English learning note.

VISUAL: onboarding.md calls for premium glass/3D objects (radar orb, ticker constellation,
        portfolio stack, snapshot lens, signal beacon). Build these as lightweight inline SVG
        components to match the existing no-chart-library, custom-SVG house style.
COPY:   professional, never hypey — "review opportunities / understand risk / learn from your
        history", never "beat the market / guaranteed". Australian English.
```

### Horizon 4 — Controlled execution (only after H1–H3 mature)

```text
13. Backtest worker + paper trading        (workers/backtest_worker/*)
14. Risk-policy engine                     (harvest vdapp22 risk.py)
15. Broker connector + semi-auto review    (reference vdapp22 bybit_client.py pattern)
GUARDRAIL: no real order path until backtest + paper-trade validation exist. Kill-switch first.
```

---

## 5. Cross-cutting rules (already baked in — keep them)

```text
Action language:  Buy Review / Add Review / Hold / Watch / Do Not Add / Trim Review /
                  Exit Review / Invalidated / Overextended / Event Risk. Never "buy/sell now".
Deterministic:    backend owns every score, state, number. AI explains only.
AI cost control:  deterministic filter → top-N only → compact payloads → cache → cheap-vs-deep tiers.
Secrets:          service-role + Anthropic keys are worker-only; frontend uses anon read + demo fallback.
Demo-safe:        every new surface degrades gracefully when env/keys are absent.
Mobile-first:     dense but not overwhelming; Command/Radar/Portfolio/Watchlist/Alerts on mobile.
AU English; not financial advice (research software).
```

---

## 6. Recommended first move

Start with **Horizon 1A**: write-paths + the market-context strip. Rationale — write-paths convert the existing read-only cockpit into a personal one (unblocks everything downstream), and `market_context.py` is a near drop-in from vdapp22 using only free endpoints, so it adds regime density to the Command Centre today with zero new API keys and full demo-safe fallback. Both are low-risk, high-visibility, and wire cleanly into the running prototype at `127.0.0.1:3042`.
