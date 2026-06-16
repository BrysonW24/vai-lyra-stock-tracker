I inspected the current repo and latest shipped state. The clean summary is:

**Lyra / Vivacity.ai is now a research-first, AI-native investing intelligence app with a deterministic stock scanner, thematic research layer, chart-pack/macro dashboard, portfolio/watchlist surfaces, grounded AI agent system, secured messaging architecture, and a paper-bot spine that simulates the future trading workflow without touching live money.**

I also prepared a brand-aligned architecture visual in the Vivacity style you showed:
[Download the architecture overview image](sandbox:/mnt/data/lyra_ai_architecture_overview.png)

## 1. What the app is now

The repo still describes Lyra’s core as an hourly tech-stock momentum scanner that identifies recovery setups and explains them in plain English as “research, not advice.” The scanner scores stocks using RSI lift, MACD histogram recovery, price location, trend context, and volume participation, while the deterministic engine owns the numbers and AI only phrases/explains them. 

But the current app has moved well beyond “scanner”. The latest commit says the public deploy now includes the Paper Bot spine, CLI, flags/notifications, equity curve, Live Bot explainer, fail-closed AI tool loop, research analyst agent, listening layer, AU-English behaviour, and eval harness. 

So the actual product is now closer to:

> **A mobile-first investing command centre that scans technical momentum, layers in thematic intelligence, lets users monitor portfolio/watchlist exposure, asks grounded AI questions, reviews macro/chart context, and simulates paper trades through the exact safety pipeline a future bot would need.**

## 2. What users can do

The app now exposes a broad navigation system, not just one dashboard. The current app shell includes Command, Portfolio, Watchlist, Charts, Saved, Live Wire, Intelligence, Calendar, Signal Radar, Smart Money, Themes/World Radar, Supply Chain, Small Caps, Investor Radar, Gov Awards, Capital Flows, Filings, IPO Radar, Commodities, Fundamentals, Comparison Lab, Simulation Lab, Strategy Lab, Calculators, Paper Trading, Paper Bot, Live Bot, Education, What’s New, and Strategy Rules. 

In practical user terms, this means a user can:

* see strongest momentum setups
* track portfolio holdings and watchlist names
* inspect stock-level technical scores
* view macro and market chart packs
* browse AI/AGI/space/supply-chain themes
* discover small-cap candidates
* monitor capital events, investor moves, commodities, IPOs and filings
* ask Lyra AI grounded questions
* run a proposed paper trade
* approve it manually
* simulate a fill
* watch paper P/L, positions and equity curve
* receive in-app flags and Telegram-deliverable notifications
* inspect how far the system is from live-bot readiness

## 3. Core technical stack

The app is built on:

* **Frontend:** Next.js 15, React 19, TypeScript, Tailwind.
* **Backend/data:** Supabase/Postgres with RLS.
* **Worker:** Python scanner using pandas, yfinance, `ta`, Supabase and pytest.
* **AI:** provider/model agnostic gateway.
* **Testing:** Vitest plus Python pytest.
* **Content layer:** JSONL records compiled into importable JSON before dev/build/type-check.

The package file confirms Next, React, Supabase, Zod, Tailwind, Vitest and the content build pipeline.  

The environment model still supports three modes: demo mode with no keys, live mode with Supabase + market data, and AI mode. It also explicitly keeps service-role keys and tokens out of `NEXT_PUBLIC_*` variables. 

## 4. Architecture layers

### Layer 1 — User experience

This is now a full investing OS surface.

There is a command centre for the daily view, a radar for technical signals, a chart-pack style section for macro/markets/portfolio, thematic research pages, small-cap discovery, smart-money/investor tracking, commodities, fundamentals, portfolio/watchlist, paper trading, paper bot, live bot readiness, and education.

The app shell is mobile-aware: desktop gets an icon rail, while smaller screens get a horizontally scrollable bottom nav so the whole product remains accessible on mobile. 

### Layer 2 — Market data and deterministic scanner

The core scanner remains the foundation.

It computes:

* RSI
* MACD
* trend context
* volume participation
* score breakdown
* signal status
* lifecycle state
* action state
* portfolio overlays
* watchlist overlays
* alerts

The README describes the user-facing value: momentum radar, deterministic engine, command centre, portfolio/watchlist overlays, Telegram alerts, optional AI co-pilot, and demo-safe behaviour. 

The important design principle remains correct:

> **The app does not ask AI whether a stock is good. It computes a signal first, then lets AI explain what the deterministic engine found.**

### Layer 3 — Data and persistence

The current data model has two paths:

1. **Demo/session path:** the app works without Supabase.
2. **Authenticated Supabase path:** real user data and paper-bot persistence can be saved under RLS.

The paper account persistence layer now binds simulated paper fills to Supabase tables for authenticated users: `paper_accounts`, `paper_orders`, `paper_trades`, `paper_positions`, and `paper_equity_snapshots`. It uses the cookie-aware, RLS-enforced server client, never the service role, so users only touch their own rows. If Supabase or a session is missing, it falls back to the in-memory demo store. 

The actual paper fill persistence records a paper order, a paper trade, updates the averaged position, and snapshots equity.   

That means the system is no longer only “visual simulation”. For signed-in users, it has the early shape of a durable paper-trading track record.

### Layer 4 — AI-native content and research layer

This is one of the biggest changes.

The `content/` directory is now treated as the editable AI-native reference layer. It holds JSONL records for commodities, IPOs, smart money, themes, supply-chain nodes, theme companies, capital events and investors. Those records compile into `src/lib/generated/*` during build so the frontend can import them safely. 

The reason this matters: it lets humans or agents update the app’s research knowledge without editing component code. The repo explicitly says the content layer is the single source of truth for editorial/reference content and is designed to be editable by an agent or human. 

This supports the strategic direction we wanted: AGI infrastructure, space, supply chains, commodities, investor moves, capital events and small-cap discovery.

### Layer 5 — World Radar / thematic investing engine

The `world-radar.ts` layer is the thematic intelligence engine. Its own file description says Lyra’s expansion thesis is to scan the real-world causal chain behind future returns: themes → physical bottlenecks → supply-chain nodes → companies → evidence. It also states that deterministic scoring owns every score and AI only explains. 

It models:

* themes
* supply-chain nodes
* theme companies
* capital events
* investor moves
* opportunity scoring
* small-cap buckets
* filing caveats

The opportunity score rewards theme fit, bottleneck exposure, evidence, momentum, financial quality, capital flow, liquidity and theme confidence, while penalising crowding, hype and dilution risk.  

It then classifies names into research states like “Deep research candidate”, “Watchlist candidate”, “Momentum confirmed”, “Early but unproven”, “Interesting but risky”, and “Avoid - hype/dilution risk” — deliberately avoiding buy/sell language. 

That is exactly the right safety/product line: **rank research quality, not tell users what to trade.**

### Layer 6 — Charts and macro dashboard

The new Charts section is the start of your “RBA chart pack inside the app” idea.

The chart-pack module explicitly describes itself as an RBA/FRED-style macro indicator layer for Economy and Markets tabs, plus commodities. It is currently using curated illustrative values until live FRED/RBA/market feeds are wired. 

It includes examples across:

* US GDP
* US CPI
* core CPI
* unemployment
* manufacturing PMI
* housing starts
* AU CPI
* AU unemployment
* 10Y–2Y yield spread
* US 10Y
* US 2Y
* investment-grade credit spreads
* high-yield spreads
* VIX
* MOVE bond volatility
* financial stress index
* natural gas
* lithium
* nickel
* iron ore

The UI component describes the section as a dedicated RBA-chart-pack-style visual space. The Portfolio tab uses real portfolio/watchlist data, while Economy/Markets/Commodities provide the macro backdrop. 

The Charts tabs currently include Portfolio, Economy, Markets and Commodities, with mobile-first swipable tabs.  

This is still early, but architecturally it is pointed correctly.

## 5. The AI system

This is now one of the best-built parts of the app.

### What the AI currently does

The AI system now has:

* central policy
* agent registry
* fail-closed tool runtime
* evidence retrieval
* schema validation
* citation enforcement
* audit logging
* research analyst
* trade readiness agent
* AI run tracking
* listening layer

The run-agent file describes the flow clearly: gather evidence through the fail-closed tool runtime, prompt the model for structured JSON, validate the output including citation enforcement, then audit the run. It explicitly states that the model phrases and cites, never chooses to place an order, and its output is rejected if it does not match the schema. 

The research analyst agent retrieves evidence through `search_evidence` and returns a cited, schema-valid summary with `{ summary, keyPoints, citations, confidence }`. 

The trade readiness agent is specifically designed for the paper bot. It outputs only one of: `research_only`, `paper_trade_eligible`, or `blocked_missing_evidence`. It never outputs an order, side, quantity or price. 

### What the AI is allowed to do

The AI policy allows the model to summarise evidence, explain deterministic outputs, classify documents/news, compare entities, retrieve evidence through read-only tools, draft research notes, ask clarifying questions, flag risks, and propose paper-trade candidates for deterministic validation. 

### What the AI is forbidden from doing

The AI policy explicitly forbids it from creating orders, changing broker state, mutating portfolio/watchlist/holdings without explicit user action, exposing secrets, bypassing RLS, using another user’s data, treating external content as instructions, executing code from documents, treating Telegram/WhatsApp messages as system instructions, presenting stale data as current, or giving personalised financial advice. 

### Tool runtime safety

The tool runtime checks `canAgentUseTool()` before dispatch. Forbidden tools like `create_order` and `modify_position` have no case in the runtime at all, making them structurally unrunnable. 

The permission matrix is least-privilege per agent. For example, `trade_readiness` can use `search_evidence`, `read_signals`, `read_portfolio_own`, and `explain_order_intent`, but cannot create or submit orders. 

That is a very good architecture. It means safety is enforced in code, not just prompt wording.

## 6. Paper Bot and future trading spine

This is the biggest milestone from “research app” toward “future bot architecture”.

The paper bot file says the pipeline is:

> signal → trade readiness verdict → deterministic OrderIntent → risk gate → approval gate → simulated paper fill → audit.

It also states: no broker, no live path. 

### Paper Bot lifecycle

The shipped docs define the paper-bot spine as deterministic, auditable and paper-only. The model may explain why a candidate exists, but only deterministic code may create an `OrderIntent`, and only paper-execution code may simulate a fill. 

The implementation includes:

* `trade_readiness` agent
* deterministic `OrderIntent` builder
* risk gate
* approval gate
* paper executor
* `POST /api/trading/paper-bot`
* spine tests



### Paper fill simulation

The paper executor simulates a fill from a reference price, applies slippage, calculates notional, fee and simulated slippage, and records the source order intent. 

### Paper account analytics

The paper bot UI now shows:

* paper account summary
* invested amount
* market value
* equity
* realised P/L
* win rate
* expectancy
* average win/loss
* live equity curve
* per-position rows
* P/L bars
* data source tag: saved vs session

The UI explicitly labels whether the account data is persisted or session-only. 

### Close position support

The paper bot now supports closing a full position at market as a risk-reducing sell. It re-runs the risk gate, simulates a sell fill, books realised P/L, persists the close when authenticated, and records a flag.  

That means it is no longer just “open fake positions”. It has the beginning of a full paper trade lifecycle.

## 7. Risk engine

The pre-trade risk engine is deterministic, pure, side-effect free and fail-closed. Its comments state that every future order must pass this engine before approval or eventual execution, and that AI has no write path into it. 

It checks:

* trading mode
* no live execution
* kill switches
* strategy allowlist
* symbol/theme blocks
* market open
* symbol tradable
* broker/paper venue connected
* quote freshness
* max order notional
* max position percentage
* max daily loss
* max drawdown
* liquidity
* spread
* earnings blackout
* news blackout
* duplicate idempotency key
* intent sanity

The live-execution hard block is especially important: the engine only accepts disabled, paper-only, or approval-required modes. Anything beyond that fails. 

This is why the system is not “dangerous bot code”. It is a **bot-readiness pipeline**.

## 8. Notifications, Telegram and WhatsApp

This area has also moved forward significantly.

### In-app flags and CLI

The paper-bot notifications doc says the bot now raises flags, exposes a CLI, and can deliver flags to a chat channel. It emphasises that every path reuses the same paper-only engine and does not add a live trading path. 

The CLI supports:

* `status`
* `positions`
* `pnl`
* `propose <SYM> <QTY>`
* `approve`
* `execute`
* `flags`
* `channels`
* `help`



It also explicitly refuses live/real-money language and has no live command in the allowlist. 

### Telegram

Telegram now has two concepts:

1. Existing scanner alerts.
2. Paper-bot/channel delivery and secure webhook architecture.

The paper-bot notification layer can push flags to Telegram when server-only `TELEGRAM_BOT_TOKEN` and `TELEGRAM_PAPER_CHAT_ID` are configured. 

The inbound Telegram webhook is secured with `X-Telegram-Bot-Api-Secret-Token`, checked using constant-time comparison. It validates payloads with Zod, treats all inbound text as untrusted, parses into a closed command enum, rate-limits per chat, and never forwards free-form Telegram text to an LLM as instructions. 

The route rejects missing/mismatched secrets with 401 before parsing anything. 

### WhatsApp

WhatsApp webhook architecture exists too. It supports Meta’s verification challenge on GET and signed inbound intake on POST, verifying `X-Hub-Signature-256` HMAC against the raw body before parsing. 

The WhatsApp route states the core security rules: inbound text is untrusted, normalised, matched against a closed grammar, logged redacted, and no free-form path reaches business logic. It also blocks account creation from inbound messages and keeps pairing in the authenticated web app. 

WhatsApp delivery is still a next slice rather than fully wired for production use. The paper-bot doc says the interface exists, but the provider adapter is not wired yet. 

## 9. What problems the app solves

At a user/product level, Lyra now solves five problems.

### Problem 1 — “I do not know what matters today.”

The Command, Live Wire, Intelligence and notifications surfaces are becoming the daily briefing layer. The app tries to compress market movement, portfolio relevance, signal changes, news and research into one place.

### Problem 2 — “I can see stocks, but I cannot see the causal chain.”

World Radar, Supply Chain, Small Caps, Commodities, Capital Flows and Investor Radar start solving this. The system maps themes to bottlenecks to companies to evidence, rather than only showing ticker charts.

### Problem 3 — “AI gives confident nonsense.”

The AI layer has been built around evidence retrieval, citation enforcement, strict schemas, audit logs and forbidden tools. That makes the AI useful without letting it become the source of trading truth.

### Problem 4 — “I do not know whether a signal would actually work.”

The Paper Bot creates a flight simulator. It lets users test the proposed workflow with fake money and real prices, then track P/L, equity curve, win rate and expectancy.

### Problem 5 — “How close are we to automation?”

The Live Bot / Paper Bot split gives users a clear path: research → paper intent → risk gate → approval → paper fill → track record → validation → only later broker adapter.

## 10. How far off a live trading bot is

You are now **architecturally on the correct path**, but still **not ready for live trading**.

The good news:

* Signal engine exists.
* AI evidence loop works.
* AI cannot trade.
* OrderIntent concept exists.
* Risk engine exists.
* Approval gate exists.
* Paper fill simulation exists.
* Paper account analytics exist.
* Supabase paper persistence exists for authenticated users.
* Telegram/WhatsApp security architecture is in place.
* Live execution is structurally blocked.

The remaining gap is not “can we call a broker API?” That is easy. The gap is whether the system has earned the right to call a broker.

Before live trading, I would still require:

1. **Durable strategy-level analytics**
   Per-strategy equity curves, closed-trade performance, drawdown, expectancy, win rate, average win/loss, time in trade and regime performance.

2. **Backtesting + walk-forward validation**
   The paper bot proves the pipeline works. It does not yet prove the strategy has edge.

3. **Full idempotency hardening**
   The docs still note that fill idempotency needs a unique constraint/key before retry-heavy execution. 

4. **Production-grade persistent kill switches**
   Kill switches exist in the risk engine, but durable user/platform kill-switch state and audit history need to be fully operational.

5. **Broker adapter sandbox only first**
   A broker adapter should begin with paper/sandbox, never live.

6. **Manual approval mandatory**
   First live mode should not be autonomous. It should be approval-required with tiny notional limits.

7. **Monitoring and incident runbooks**
   Error-rate kill switch, stale-data kill switch, slippage kill switch, duplicate-order protection, alerting on failures.

My honest estimate:

**As an architecture, you are maybe 50–60% of the way to a responsible live-bot framework.
As something that should trade real money, you are still maybe 20–30% there.**

That is a good place to be. The app is no longer a toy, but it is also not pretending to be ready for real execution.

## 11. Current limitations

The main current limitations are:

* The chart pack is still illustrative/sample until live RBA/FRED/market feeds are wired. 
* WhatsApp send path is not fully wired yet. 
* Telegram pairing is still stubbed; commands can respond, but full account-linked command execution is not enabled yet. 
* Paper persistence works for authenticated Supabase users, but demo/sim still falls back to session/in-memory. 
* Strategy validation/backtesting needs to become first-class before any bot should go live.
* The current app visual system is still more dark terminal/glass-chrome than the cream Vivacity brand you showed. The architecture graphic I generated follows the brand direction, but the product UI itself would need a design-token/theme pass to fully align.

## 12. Best technical positioning

I would describe the product like this:

> **Vivacity.ai / Lyra is a research-first, AI-native investing intelligence system. It combines deterministic market scanning, portfolio/watchlist monitoring, macro chart packs, thematic supply-chain research, grounded AI agents, secure messaging architecture, and a paper-only bot simulator. AI explains and cites; deterministic systems score, gate, simulate and audit. Live trading is intentionally blocked until paper performance, backtesting, risk controls and execution infrastructure prove the system is ready.**

That is the full technical story.
