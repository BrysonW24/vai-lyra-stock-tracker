# 📈 Lyra - Stock Momentum Radar

> An hourly tech-stock momentum scanner that spots recovery setups before they're obvious - and explains them in plain English. **Research, not advice.**

Lyra watches the market on an hourly cadence and scores each stock on momentum recovery: RSI lift, MACD histogram turning up, price location, trend context, and volume participation. A deterministic engine owns every number; an optional AI layer just phrases it for you. Runs on **built-in demo data with zero setup**, and scales up to a live, alerting, AI-explained console when you want it.

> ### 🌐 Real-universe scan (Emerging Winner engine)
> Beyond the hourly momentum radar, Lyra's **Emerging Winner engine** scans the **real SEC-listed universe** - every US company that files with the SEC (**~10,400 tickers, small-caps included**), fetched **live so new listings are picked up automatically** - using **free public data** (the SEC's `company_tickers.json` + market data via the same provider the scanner uses). It runs the full six-model stack (domain scorecard → classifier → analogue → ranker → risk gates → timing) over that universe.
>
> It is **coverage-honest**: it populates the domains real market data can support (technical, liquidity, theme) and marks the deep domains it cannot yet source (SEC filings, insider Form-4/13F flow, government contracts, and **delisted history** - the survivorship-safe training gate) as `unavailable` rather than guessing. Enable a live run with `EW_REAL_UNIVERSE=1` (bound the slice with `EW_UNIVERSE_LIMIT`). Full assessment: [`lyra-audits/2026-08-01-model-analysis-harness-audit.md`](./lyra-audits/2026-08-01-model-analysis-harness-audit.md).

```bash
git clone https://github.com/BrysonW24/vai-lyra-stock-tracker.git
cd vai-lyra-stock-tracker
npm install && npm run dev -- -p 3042      # ✨ runs on demo data, no keys needed
```

Open http://localhost:3042 and you're in. 🎉

## 🧭 Make it yours - clone, set up, deploy, all guided

This repo is built to be **shared as a link and replicated end to end**. Four things get you from clone to your own live console:

1. **Setup instructions** - agent-paced or human-paced, your pick:
   - **Have [Claude Code](https://claude.com/claude-code)?** Open it in the clone and run **`/setup`** - the repo ships an agent playbook ([`.claude/commands/setup.md`](./.claude/commands/setup.md)) that sets everything up for you, stage by stage, with a verification gate at every step.
   - **Prefer to drive?** Follow the [walkthroughs](./docs/walkthroughs/README.md): [what Lyra is](./docs/walkthroughs/01-what-is-lyra.md) -> [run it in 5 minutes](./docs/walkthroughs/02-run-it-yourself.md) -> [go live with your own Supabase](./docs/walkthroughs/03-go-live-supabase.md) -> [put it online](./docs/walkthroughs/04-deploy-your-own.md) -> [understand the score](./docs/walkthroughs/05-understand-the-score.md).
2. **An AI key (optional)** - set `OPENAI_API_KEY` server-side for hosted explanations, or paste any provider's key in **Settings -> AI** (BYOK, stays in your browser). The console is fully usable with no AI key at all.
3. **Hosting (optional)** - free on Vercel, or your own server with **Coolify** using the included [`Dockerfile`](./Dockerfile): [deploy walkthrough](./docs/walkthroughs/04-deploy-your-own.md) + [Coolify runbook](./docs/runbooks/coolify-deploy.md).
4. **Alerts where you live** - urgent setups and hourly summaries pushed to you: web push with zero accounts, Telegram in ~10 minutes, Slack via your own incoming webhook (paste it in Settings -> Notifications), WhatsApp honestly scoped: [alerts walkthrough](./docs/walkthroughs/06-alerts-on-your-phone.md).
5. **Costs, fully itemised** - every service in the stack priced in [`COSTS.md`](./COSTS.md). Demo mode is $0; a fully live, always-on setup can run on free tiers - and [`DATA-ECONOMICS.md`](./DATA-ECONOMICS.md) shows the measured usage + how long the free tiers actually last.

## 0 - How to Access Lyra

**Two live links, depending on whether you want an account:**

- **Solo** - [solo.lyra.vivacityai.com.au](https://solo.lyra.vivacityai.com.au) - no sign-up, everything on your device, live signals recomputed on the spot for a curated list, bring-your-own AI key. Nothing is stored on our servers. When Solo hits something it cannot do without an account (background notifications, hosted AI) it offers a one-tap path to create a Full account.
- **Full account** - [lyra.vivacityai.com.au](https://lyra.vivacityai.com.au) - the full hourly-scanned universe, portfolio and watchlist saved and synced across devices, notifications (push, Telegram, Slack), and hosted AI free for your first 2 weeks then bring-your-own-key. Everything except the AI chat works forever regardless.

Where each side's numbers actually come from is documented, with a file-and-line citation behind every step, in [`DATA-FLOW.md`](./DATA-FLOW.md). A ready-to-send two-link blurb lives in [`SHARE.md`](./SHARE.md).

<p align="center">
  <img src="assets/how-lyra-works.png" width="80%" alt="How Lyra Works - Solo vs Full account, both powered by the same research engine" />
</p>

**The best way to share Lyra depends on who you are sharing with - and it is almost never "clone it".**

- **Anyone you want to _show_** (friends, prospects, "look what I built") - send the live link: **[vai-lyra-stock-tracker.vercel.app](https://vai-lyra-stock-tracker.vercel.app)** and tap **Explore the demo first** for the read-only tour, no account needed. (This link used to land straight in an open console; production now runs with accounts, so the tour is the honest no-signup path.) On mobile they can Add to Home Screen (below) for an app-like icon.
- **Anyone who wants to _use_ it without an account** - **Lyra Solo**: the `solo` branch deploys the same app with no Supabase and no server AI keys, so there is nothing to sign into, your watchlist/holdings/trade log live in your own browser, and AI runs on a key you bring in Settings -> AI. Install it to your home screen and it behaves like an app.
- **Developers who want their _own_ copy** - point them at this repo to **fork** (not clone-to-browse) and run the guided setup: Claude Code users run **`/setup`**, everyone else follows the [walkthroughs](./docs/walkthroughs/README.md). The path from demo to deployed is fully gated.
- **AI coding agents** (in case they do clone) - the front door is **[AGENT-ONBOARDING.md](./AGENT-ONBOARDING.md)**: it hands them the `/setup` contract and the verification gates, and if they change code, the enforcement map ([HARNESS.md](./HARNESS.md)), the skill-chain coverage map ([SKILL-CHAIN.md](./SKILL-CHAIN.md)), and the system motion map ([LOOPS.md](./LOOPS.md) - every loop end to end) that keep the repo honest.

_Rule of thumb: **link** for humans, **fork** for builders, **AGENT-ONBOARDING.md** for agents. The clone is for people who want to run their own Lyra, not for people who just want to see it._

---

## 1 - Landing Page

<p align="center">
  <img src="assets/landing-hero-see-the-setup.png" width="30%" alt="Landing - hero: see the setup before everyone else" />
  <img src="assets/landing-why-lyra-market-made-readable.png" width="30%" alt="Landing - why Lyra: the market, made readable" />
  <img src="assets/landing-ai-copilot-future-state.png" width="30%" alt="Landing - AI co-pilot future state" />
</p>

## 2 - Onboarding

<p align="center">
  <img src="assets/onboarding-splash-screen.png" width="30%" alt="Onboarding - splash, tap to continue" />
  <img src="assets/onboarding-path-selection.png" width="30%" alt="Onboarding - choose your path" />
  <img src="assets/onboarding-primer-command-centre-preview.png" width="30%" alt="Onboarding - primer, act from the console" />
</p>
<p align="center">
  <img src="assets/onboarding-market-universe-sectors.png" width="30%" alt="Onboarding - your market universe and sectors" />
  <img src="assets/onboarding-capital-add-holdings.png" width="30%" alt="Onboarding - add your holdings" />
  <img src="assets/onboarding-watchlist-targets.png" width="30%" alt="Onboarding - add your watchlist and targets" />
</p>

## 3 - Command Centre

<p align="center">
  <img src="assets/command-centre-kpi-tiles-market-context.png" width="30%" alt="Command centre - KPI tiles and market context" />
  <img src="assets/command-centre-daily-brief.png" width="30%" alt="Command centre - daily brief" />
  <img src="assets/command-centre-your-book-tiles.png" width="30%" alt="Command centre - your book tiles" />
</p>
<p align="center">
  <img src="assets/radar-signal-scores.png" width="30%" alt="Signal radar - ranked scores" />
  <img src="assets/intelligence-news-feed.png" width="30%" alt="Intelligence - ticker-tagged news feed" />
  <img src="assets/event-calendar-agenda.png" width="30%" alt="Calendar - event agenda" />
</p>
<p align="center">
  <img src="assets/ticker-universe-list.png" width="30%" alt="Ticker universe - tracked names by sector" />
  <img src="assets/explore-navigation-hub.png" width="30%" alt="Explore - navigation hub" />
  <img src="assets/account-settings-profile.png" width="30%" alt="Account and settings - profile" />
</p>

## 4 - Lyra AI

The AI explains; the deterministic engine decides. Bring your own key or use the hosted
beta - the model only ever answers from what is already on your dashboard.

<p align="center">
  <img src="assets/ai-chat-connect-model-prompt.png" width="30%" alt="Ask Lyra - connect a model to chat" />
  <img src="assets/ai-chat-watchlist-topic-prompts.png" width="30%" alt="Ask Lyra - grounded topic prompts" />
  <img src="assets/account-ai-settings-openai-model.png" width="30%" alt="AI settings - choose the model that powers Lyra" />
</p>

## 5 - Lyra Notifications

Strong setups and risk flags, delivered on the channels you pick - with quiet hours and
per-scope control so alerts stay worth the buzz. Every alert carries the engine's own
grain: the trigger reason, the symbol, a relevance score, and a link back into Lyra.

<p align="center">
  <img src="assets/notification-pwa-push-ios.jpg" width="30%" alt="Web push - an alert on the iOS lock screen, no app store needed" />
  <img src="assets/notification-slack-signal.png" width="30%" alt="Slack - a live signal alert delivered to a channel" />
  <img src="assets/notification-telegram-signal.png" width="30%" alt="Telegram - a signal with a relevance meter and the engine's trigger reason" />
</p>

## 6 - The Modelling Stack

Lyra's predictive layer: the **Emerging Winner Engine**, a six-model pipeline that scores small caps
against the structural shape of history's winners - then risk-gates every finding before it reaches
the research queue. It runs **shadow-live**: all six models execute end to end, every prediction lands
in an immutable append-only ledger, and a model is promoted only after its track record earns it.
Research only - the engine never says what to trade, never prints a price target, and what's missing
is always on the card. The honest catalogue of every model (its stage and where its numbers come from)
lives in-app at **/models**; the code lives in [`workers/emerging_winner/`](./workers/emerging_winner/)
and the full design docs in [`lyra-modelling/`](./lyra-modelling/).

### The six-model deck

<p align="center">
  <img src="lyra-modelling/deck-1of7-emerging-winner-engine-overview.png" width="30%" alt="Emerging Winner Engine overview - data sources, 10-domain summary, core model stack, user output" />
  <img src="lyra-modelling/deck-2of7-model-1-domain-score-engine.png" width="30%" alt="Model 1 - Domain Score Engine: 10 interpretable company scores from raw inputs" />
  <img src="lyra-modelling/deck-3of7-model-2-emerging-winner-classifier.png" width="30%" alt="Model 2 - Emerging Winner Classifier: 4-stage conviction ladder with SHAP explainability" />
</p>
<p align="center">
  <img src="lyra-modelling/deck-4of7-model-3-historical-analogue-model.png" width="30%" alt="Model 3 - Historical Analogue Model: closest past winners and failures with similarity scores" />
  <img src="lyra-modelling/deck-5of7-model-4-archetype-research-queue-ranker.png" width="30%" alt="Model 4 - Archetype and Research Queue Ranker: classify the opportunity type, rank what deserves research first" />
  <img src="lyra-modelling/deck-6of7-model-5-risk-gate-stack.png" width="30%" alt="Model 5 - Risk Gate Stack: five gates ending in PASS, REVIEW or BLOCK" />
</p>
<p align="center">
  <img src="lyra-modelling/deck-7of7-model-6-timing-network-intelligence.png" width="30%" alt="Model 6 - Timing and Network Intelligence: temporal and graph challengers for when the market starts to recognise the thesis" />
</p>

### The event-model families (designed)

The candidate architectures for the fast-follow event model - "will this name move +20% within
21 / 63 / 126 trading days?" Designed, not yet built; the in-app catalogue says so plainly.

<p align="center">
  <img src="lyra-modelling/families-1of5-gradient-boosted-trees.png" width="30%" alt="Gradient Boosted Trees - the first production champion candidate" />
  <img src="lyra-modelling/families-2of5-temporal-fusion-transformer.png" width="30%" alt="Temporal Fusion Transformer - multi-horizon sequence intelligence" />
  <img src="lyra-modelling/families-3of5-tcn-gru-lstm-sequence-models.png" width="30%" alt="TCN / GRU / LSTM - sequence models for pattern buildup" />
</p>
<p align="center">
  <img src="lyra-modelling/families-4of5-dynamic-graph-neural-network.png" width="30%" alt="Dynamic Graph Neural Network - find the second-order winners through supply chains and themes" />
  <img src="lyra-modelling/families-5of5-stacked-ensemble-uncertainty.png" width="30%" alt="Stacked Ensemble with Uncertainty - the final calibrated decision layer" />
</p>

### End-to-end architecture

<p align="center">
  <img src="lyra-modelling/architecture-predictive-modelling-graph-nn.png" width="47%" alt="Lyra predictive modelling architecture - ingestion, graph builder, training lifecycle, serving, app integration, feedback loop" />
  <img src="lyra-modelling/architecture-model-hosting-inference.png" width="47%" alt="Lyra model hosting and inference architecture - champion/challenger selection, GPU training, hosted serving, monitoring" />
</p>

---

## ✨ What you get

- 🛰️ **Momentum radar** - every tracked stock scored 0-100 with a clear signal state (strong setup / building / near trigger / invalidated)
- 🧮 **Deterministic engine** - RSI, MACD, trend, volume and score are computed in code, never guessed by an AI
- 📊 **Dense command center** - overview, signal radar, per-ticker detail, alerts, and settings
- 💼 **Portfolio + watchlist overlays** - on-the-spot valuation and price-alert thresholds (-10 / -5 / +5 / +10%)
- 🔔 **Alerts on your channels** - strong setups and invalidations pushed to Telegram, Slack (your own webhook), WhatsApp, or web push (all opt-in)
- 🤖 **Optional AI co-pilot** - plain-English briefs and explanations, grounded strictly in the engine's numbers
- 🧪 **Demo-safe everywhere** - no backend? It runs on realistic sample data so you can explore instantly

<p align="center">
  <em>Alerts, where you live:</em><br /><br />
  <a href="./docs/walkthroughs/06-alerts-on-your-phone.md#step-3---telegram-works-today-the-recommended-phone-channel"><img src="https://img.shields.io/badge/Telegram-26A5E4?logo=telegram&logoColor=white" alt="Set up Telegram alerts" /></a>
  <a href="./docs/walkthroughs/06-alerts-on-your-phone.md#step-4---slack-your-own-webhook-2-minutes"><img src="https://img.shields.io/badge/Slack-4A154B?logo=slack&logoColor=white" alt="Set up Slack alerts" /></a>
  <a href="./docs/walkthroughs/06-alerts-on-your-phone.md#step-5---whatsapp-architecture-only---read-before-spending-time-here"><img src="https://img.shields.io/badge/WhatsApp-25D366?logo=whatsapp&logoColor=white" alt="WhatsApp alerts (architecture)" /></a>
  <a href="./docs/walkthroughs/06-alerts-on-your-phone.md#step-2---web-push-zero-phone-number-needed"><img src="https://img.shields.io/badge/Web_Push-1E63FF" alt="Set up Web Push alerts" /></a>
</p>

---

## 🔑 Hosted OpenAI beta. Optional BYOK.

The beta AI layer is wired for a server-side hosted OpenAI key so friends can test Lyra without pasting provider credentials. User keys are still supported and override the hosted key.

- **Hosted default** - set server-side `OPENAI_API_KEY` and new users default to OpenAI (`gpt-5.5`, configurable with `LYRA_HOSTED_OPENAI_MODEL`).
- **Bring your own key (BYOK)** - paste your own API key in **Settings -> AI**. It stays in this browser and is never stored by Lyra.
- **Bring your own model (BYOM)** - pick the exact model you want. Leave it blank for the provider default, or name any model your key can access.
- **Provider-agnostic gateway** - OpenAI, Anthropic, OpenRouter, Gemini, and xAI all route through one server-side gateway.

> The AI **explains**; the deterministic engine **decides**. The model is only ever given facts the engine already computed - it never invents a number and never gives buy/sell advice.

Every brief and explanation has a deterministic fallback, so the app still works if a model call fails.

---

## 🛠️ Three modes - use as much as you want

| Mode | What you need | What you get |
|------|---------------|--------------|
| 🎮 **Demo** | nothing | The full console on built-in sample data. Just `npm run dev`. |
| 📡 **Live** | Supabase + a market-data source | Real hourly scanning, your own tickers, portfolio + watchlist overlays. |
| 🤖 **AI** | `OPENAI_API_KEY` server-side, or a user's BYOK | Hosted beta chat/briefs plus optional user-selected models. |

Run **`npm run doctor`** anytime to see exactly what's configured, what's missing, and which mode you're in. 🩺

Copy [`.env.example`](./.env.example) to `.env.local` and fill in only what you need. See [`QUICKSTART.md`](./QUICKSTART.md) for the friendly walkthrough and [`SECURITY.md`](./SECURITY.md) for key-handling rules (never put a secret in a `NEXT_PUBLIC_*` variable).

---

## ⏱️ How long setup takes

Lyra installs in tiers - stop wherever you want. Times assume you already have Node 20+, npm 10+, and git on the machine.

| Tier | You end up with | Fresh time |
|------|-----------------|------------|
| 🎮 **Demo** | The full console on built-in sample data, zero keys | **5-10 min** |
| 📡 **Live (local)** | Your own Supabase + real hourly scanning, still $0 | **+45-90 min** |
| ☁️ **Deployed** | Cloud always-on: Vercel/Coolify host + hourly GitHub Actions scanner | **+30-90 min** |

**In short:** seeing it run is about **5-10 minutes**; a real personal live instance is about **1 to 1.5 hours**; fully deployed and always-on is about **1.5 to 3 hours** (Vercel path - longer for a self-hosted Coolify box).

What tends to eat the time, and how the repo softens it:

- **Supabase schema is the biggest manual step** - apply the migrations in [`supabase/migrations/`](./supabase/migrations/) in numeric order in the SQL editor. This is most of the "live" time.
- **Silent auth trap:** a new Supabase project defaults its Site URL to `:3000`; Lyra runs on `:3042`, so the email-confirmation link fails until you set it to match.
- **The Python worker does not read `.env.local`** - run `set -a; source .env.local; set +a` before `npm run worker:scan`, or the scan runs green but writes nothing.
- **The first scan is slow** - yfinance pulls 180 days of hourly candles per symbol and occasionally rate-limits. A few minutes is normal.
- **`NEXT_PUBLIC_*` are build-time on Vercel/Coolify** - set them as build variables, not runtime, or the deploy silently runs in demo mode.

The [walkthroughs](./docs/walkthroughs/README.md) give a "you know it worked when" checkpoint plus a symptom-to-fix table after every step, and Claude Code users can run **`/setup`** to have an agent drive the whole thing. Full itemised costs: [`COSTS.md`](./COSTS.md).

---

## 🧰 Commands - the full set

Everything is an npm script; you never need to remember a raw command.

### Day to day

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (also wires the git hooks) |
| `npm run dev -- -p 3042` | Run the dashboard locally at http://localhost:3042 (demo data if no keys) |
| `npm run doctor` | Diagnose your setup: which mode you're in, what's configured, what's missing |
| `npm run build` | Production build of the frontend |
| `npm run type-check` | TypeScript strict check (run before committing) |
| `npm run test` | Frontend unit tests (Vitest) |

### Scanner (live mode)

| Command | What it does |
|---|---|
| `npm run worker:scan` | Run the Python scanner once, right now (needs worker deps: `pip install -r requirements.txt`) |
| `npm run worker:test` | Run the Python worker test suite (pytest) |

### Content + releases (contributors)

| Command | What it does |
|---|---|
| `npm run content:build` | Compile `content/*.jsonl` into importable JSON (runs automatically before dev/build) |
| `npm run release` | Cut a release: syncs `package.json` + `CHANGELOG.md` from `src/lib/version.ts` |
| `npm run check:version` | The pre-push version guard, runnable by hand |

Step-by-step instructions for every stage - from first clone to your own deployed, alerting Lyra - live in the [walkthroughs](./docs/walkthroughs/README.md), and Claude Code users can just run **`/setup`**.

---

## 📡 Going live (optional)

1. **Supabase** - apply the migrations in [`supabase/migrations/`](./supabase/migrations/) in numeric order (the canonical schema - auth, RLS, scanner, trades), then run [`sql/_apply_all_scanner_schema.sql`](./sql/_apply_all_scanner_schema.sql) once (idempotent worker-schema reconciliation). Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (read-only, frontend) and `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (worker only). Full guide: [go live with your own Supabase](./docs/walkthroughs/03-go-live-supabase.md).
2. **Scan** - `npm run worker:scan` runs the Python scanner once. The included GitHub Actions workflow at [`.github/workflows/hourly-stock-scanner.yml`](./.github/workflows/hourly-stock-scanner.yml) runs it hourly (add your secrets in the repo settings).
3. **Alerts** - add `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` to receive pushes, and/or paste your own Slack incoming-webhook URL in **Settings -> Notifications** (no server env needed - it persists per user).
4. **Host it** - free on Vercel, or self-host with Docker/Coolify: [deploy walkthrough](./docs/walkthroughs/04-deploy-your-own.md) + [Coolify runbook](./docs/runbooks/coolify-deploy.md). Verify any deploy with `/api/health` (returns the running version + mode). Costs: [`COSTS.md`](./COSTS.md).

---

## 🧱 Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Worker:** Python (pandas, yfinance, `ta`, Supabase client) + pytest
- **Data:** Supabase (Postgres) with row-level security; read-only on the frontend
- **Cache:** Upstash Redis over REST (optional) - a shared read-through cache across serverless instances; falls back to an in-process map when unset, so it is never required
- **AI:** provider/model-agnostic gateway in [`src/lib/ai/gateway.ts`](./src/lib/ai/gateway.ts)
- **Scheduler:** GitHub Actions (hourly)
- **Alerts:** Telegram Bot API, Slack incoming webhooks, WhatsApp Cloud API, Web Push

## 🏗️ Architecture - what runs where

Lyra runs across three hosts, each doing what it is best at. **Vercel is not just the frontend** - it also runs the entire per-request API layer as serverless functions. The heavy, scheduled compute lives on GitHub Actions, and all shared state lives in Supabase.

```
┌──────────────────────────────────────────────────────────────────┐
│ You   ·   browser / installable PWA                              │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ HTTPS
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ VERCEL   ·   region iad1                 the per-request backend │
│                                                                  │
│   Next.js 15 frontend  ─►  37 serverless API routes              │
│       src/app/api/**/route.ts : auth, Supabase reads,            │
│       AI gateway, notifications, twin capture,                   │
│       per-symbol signal refresh                                  │
│                                                                  │
│   calls out  ─►  AI: OpenAI / Anthropic / OpenRouter / Gemini    │
│       notify: Telegram / Slack / WhatsApp / Web Push             │
│                                                                  │
│   Vercel cron  ─►  /api/ingestion/gov-awards  (daily 13:00)      │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ reads state (anon)  ·  writes via API (service)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ SUPABASE   ·   Postgres + row-level security    the shared state │
│                                                                  │
│   Every table RLS-owned. The frontend reads with the anon        │
│   key; the scanner writes with the service key. Demo: none.      │
└────────────────────────────────┴─────────────────────────────────┘
                                 │ writes scan results
                                 │
┌────────────────────────────────┴─────────────────────────────────┐
│ GITHUB ACTIONS   ·   scheduled Python workers      the always-on │
│                                                                  │
│   hourly-stock-scanner.yml  ─►  Python scanner                   │
│       workers/stock_scanner/ : indicators, scoring,              │
│       overlays, alerts                                           │
│                                                                  │
│   nightly-maintenance.yml  ─►  horizon-2 workers,                │
│       outcomes, digests, notification sweep                      │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ pulls OHLCV
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ Market data   ·   yfinance / Finnhub                             │
└──────────────────────────────────────────────────────────────────┘
```

**In short:** Vercel serves the console and runs the 37 serverless API routes plus one light daily cron; GitHub Actions runs the always-on Python scanner and the nightly jobs; Supabase (Postgres + row-level security) is the shared state both tiers read and write. Demo mode needs none of it - it runs entirely on built-in sample data.

---

## 🧮 Deterministic engine vs AI - a hard boundary

Lyra is deterministic-first by design. **Every number, score, and decision is computed in code** - the same inputs always produce the same output, with no model in the loop. The AI layer is **optional and additive**: it phrases what the engine already decided in plain English. It is never allowed to compute, override, or invent.

| The deterministic engine (always on) | The AI layer (optional) |
|---|---|
| RSI, MACD, moving averages, volume ratios | Plain-English explanation of a signal |
| The 0-100 score and every component | Daily briefs and chat answers |
| Signal lifecycle and action state | Layout choice for GenUI views |
| Portfolio, watchlist, and alert thresholds | Framing tuned to your risk posture |
| Runs with zero keys (demo and live) | Needs a hosted key or your BYOK |
| The source of every fact | Given those facts, never the market |

**How they work together:** the engine runs first and owns the truth. When you ask for an explanation, the AI is handed *only the facts the engine already computed* - never raw market data, never a blank prompt - and its output passes a fabrication-and-advice guard (`guardProse`) before you see it. If the model is unconfigured, fails, or returns something the guard rejects, the console falls back to a deterministic view built from the same numbers. **The app is fully usable with no AI at all.**

```mermaid
flowchart TD
    U(["You ask in plain English"]) --> R["AI routes on Vercel<br/>src/app/api/ai/*"]
    ENG["Deterministic engine<br/>RSI · MACD · score · lifecycle"] -->|"computed facts, never guesses"| R
    R --> GW{"Provider-agnostic<br/>AI gateway"}
    KEY["Hosted OPENAI_API_KEY<br/>or your BYOK"] -. credentials .-> GW
    GW -->|"prompt = engine facts only"| M["Model<br/>OpenAI / Anthropic / OpenRouter / Gemini / xAI"]
    M --> GRD{"guardProse<br/>fabrication + advice guard"}
    GRD -->|"passes"| OUT(["Grounded explanation in the console"])
    GRD -->|"blocked, or model error"| FB["Deterministic fallback<br/>engine numbers, no AI"]
    FB --> OUT
```

> **AI explains; the engine decides.** The model never invents a number and never tells you what to buy or sell - that is what keeps Lyra research, not advice.

---

## 🛡️ How this repo stays honest

Lyra is maintained largely by AI agents, so the repo carries its own enforcement layer: deterministic gates that fail loudly ([HARNESS.md](./HARNESS.md)), a skill-chain ownership map ([SKILL-CHAIN.md](./SKILL-CHAIN.md)), and CI + pre-push hooks that make the rules non-optional. A few hard-won principles shape all of it:

- **A green must be able to go red.** Every gate exists because a green build once concealed a real failure - workers that failed nightly for months under `|| echo "(non-fatal)"`, migrations unapplied since 018 while a playbook politely said to check. Best-effort never means invisible, and a check that silently skips is the same lie as a check that always passes.
- **Every surface without a deterministic check is probably hiding rot.** Each new gate found real bugs on its first run: migrations-from-zero found nine schema fossils, deploy-smoke was born from six live-only bugs behind green CI.
- **One pipeline, whatever the mode.** Demo mode runs the whole product keyless, which means every forked demo/live code path is a bug waiting for a refactor. Paths stay shared; mode only changes inputs and sinks.
- **No silent caps.** Any limit over growing data must announce when it fills, and unbounded tables get retention - a cap nothing can notice is a green that cannot go red.
- **The version counter is shared state.** Multiple agent sessions can ship from one tree, so the version gate enforces that a moved version moves _up_ vs origin/main - a release can never regress the app version on a green push.

The full gate table, the layer map, and the incident-by-incident lessons live in [HARNESS.md](./HARNESS.md) - also rendered interactively at [`/harness-map.html`](https://vai-lyra-stock-tracker.vercel.app/harness-map.html).

---

## 📁 Project structure

```
src/app/                  Next.js pages (overview, radar, ticker, alerts, settings)
src/components/           Dashboard + analytics components
src/lib/                  Fetch helpers, demo data, env validation, AI gateway, Pine export
contracts/notifications/  JSON contracts for the AI notification layer
workers/stock_scanner/    Python scanner (indicators, scoring, overlays, alerts)
sql/                      Supabase schema + seed
tests/                    Worker tests
docs/walkthroughs/        Clone-to-live walkthroughs (start here to replicate)
docs/runbooks/            Deploy + operations runbooks (Coolify, kill switch, ...)
docs/                     Architecture, AI engine plan, production hardening
.claude/commands/         /setup - agent playbook for Claude Code users
Dockerfile                Self-hosting image (Coolify/Docker); Vercel ignores it
COSTS.md                  Every service in the stack, priced
```

---

## 🧬 On the roadmap - your Digital Trading Twin

A **digital trading twin** is a private, per-user model of *what you pay attention to, how you weigh risk, and which setups you actually act on* - learned quietly from how you use Lyra. It does two things: it **reflects your own habits back to you** (are you catching names early or chasing them late? do you size up right after a loss?), and it lets Lyra **compose the screen for you** instead of for everyone. Down the line, a twin becomes portable - a new user could be *onboarded into* an existing twin (your own across devices, or a mentor's) as a starting posture rather than a blank slate.

It stays strictly inside Lyra's contract: the twin is a **preference and attention model, never a decision model.** It learns *where you look*, never "what to buy"; it never places an order and never gives advice. The deterministic engine still owns every number and every decision - the twin only decides what to show you first and how to frame it for your risk posture, and it ships with an **anti-bubble guarantee** (personalisation may raise attention but may never lower the visibility of risk or disconfirming evidence).

📄 **Full pitch:** [`docs/strategy/2026-07-16-digital-trading-twin.md`](docs/strategy/2026-07-16-digital-trading-twin.md) - concept, what it learns, the onboarding-into-a-twin future, the architecture that keeps the contract, a phased roadmap, and an honest "what would make us not build this."

---

## 🗂️ Build history - features per build

Every shipped build and its headline feature, newest first. This table is **generated straight from [`src/lib/version.ts`](src/lib/version.ts)** (the single version source of truth) on every build, so it can never drift from what actually shipped. The full highlights for each build live in [`CHANGELOG.md`](CHANGELOG.md) and in-app at `/whats-new`.

<!-- BUILD-HISTORY:START (generated from src/lib/version.ts by scripts/build-content.mjs - do not edit by hand) -->
```text
BUILD    DATE        FEATURE THEME
-------  ----------  ----------------------------------------------------------------------
0.105.0  2026-08-01  Real SEC EDGAR fundamentals - the first deep-data domain, built without faking it
0.104.0  2026-08-01  Model Lab depth - more outcomes, inspectable step logs, a fuller board, and the small-cap universe made real
0.103.0  2026-08-01  Model Lab gains its visual half - see the data go in, read the results come out
0.102.0  2026-08-01  The Emerging Winner engine now scans the real SEC-listed universe with real fundamentals
0.101.0  2026-08-01  Model Lab made minimal - clean selectors, a collapsed catalogue, and every vertical on
0.100.0  2026-08-01  The Models page is now Model Lab - choose the question, watch it run, inspect why
0.99.0   2026-08-01  Run a model - pick an outcome, narrow the market, and rank your tracked universe
0.98.0   2026-07-31  Emerging Winners is now list-first, plain-English, and honest about what it is
0.97.0   2026-07-31  The signal detail view now has the chart in it - inspect a setup without leaving the drawer
0.96.0   2026-07-31  AI-written answers are now labelled as AI-generated, everywhere the AI writes
0.95.0   2026-07-31  The winner label learns from the evidence: durable-emergence definition, honest domain provenance
0.94.0   2026-07-31  The Emerging Winner model gets honest: leak-proof validation, per-cohort scoring, a floor gate, and a truthful headline
0.93.0   2026-07-31  The Emerging Winner model earns its way: a full training + deployment + monitoring lifecycle
0.92.0   2026-07-31  The modelling stack steps into the light: intro scene, landing section, README gallery
0.91.0   2026-07-30  A Models page: every model in Lyra, with its honest status, in one place
0.90.0   2026-07-29  The Emerging Winner Engine goes shadow-live: a research queue for small caps that resemble past winners
0.89.0   2026-07-28  Audit remediation wave 7: the last three verticals cleared - save safety, gate self-checks, and a fully accessible landing
0.88.0   2026-07-28  Audit remediation wave 6: the onboarding flow logic is pinned, and the quality gates now guard themselves
0.87.0   2026-07-28  Audit remediation wave 5: the radar is honest about its timeframe, and the numbers behind it are finally pinned
0.86.0   2026-07-28  Audit remediation wave 4: your data fence is now provably closed, and the AI can't dress a score up as a return
0.85.0   2026-07-28  Bigger tap targets on mobile + a hardened, tested nav bar
0.84.0   2026-07-28  Second remediation wave: more truthful defaults, hardened layout, deeper test coverage
0.83.0   2026-07-28  Honesty + polish pass: real search, truthful data labels, and controls that actually work
0.82.0   2026-07-27  A clear heads-up when you land: your first 2 weeks of AI are on us
0.81.1   2026-07-26  An always-there way back: keep your demo setup with a free account
0.81.0   2026-07-26  Explore the demo, then keep it - your whole setup now follows you into an account
0.80.1   2026-07-26  A one-image "How Lyra Works" explainer, for sharing at a glance
0.80.0   2026-07-26  Two ways to try Lyra, made official - Solo now points you to a Full account when you need one
0.79.0   2026-07-26  AI is now free for your first two weeks, then it is your own key - and the whole app works either way
0.78.0   2026-07-26  A "How Lyra Works" page in Settings - see the decision process for yourself
0.77.0   2026-07-26  The Ideas board now records where each idea came from - Solo or Community
0.76.0   2026-07-26  AI Settings tell the truth about hosted vs your-own-key on every deployment
0.75.0   2026-07-26  A Solo-to-account upgrade path, built behind a control and held dark
0.74.1   2026-07-26  A features-per-build table in the README, generated so it can never drift
0.74.0   2026-07-26  One codebase again - the Ideas board reaches Solo, and Solo's device-local polish reaches everyone
0.73.2   2026-07-24  Solo now behaves like one truthful device-local product from first run onward
0.73.1   2026-07-24  Solo BYOK credentials can be removed without wiping the console
0.73.0   2026-07-24  Solo first-run, install and BYOK grounding now tell one consistent truth
0.72.0   2026-07-20  Lyra Solo - the no-account, bring-your-own-key mode is now first-class
0.71.0   2026-07-20  Support and Terms pages, reachable without signing in
0.70.2   2026-07-18  Notch fix, without double-padding the ears
0.70.1   2026-07-18  Welcome screen clears the notch
0.70.0   2026-07-18  First-class inside the iOS app
0.69.1   2026-07-18  Home-Screen walkthrough polish
0.69.0   2026-07-18  Your phone stops buzzing: a real rate cap, and Quiet mode that means it
0.68.1   2026-07-18  A replay switch for the onboarding journey
0.68.0   2026-07-18  Onboarding now teaches you to put Lyra on your Home Screen
0.67.1   2026-07-18  Demo journey unblocked for everyone who tried the demo before
0.67.0   2026-07-18  The demo now takes you through the full onboarding journey
0.66.0   2026-07-18  Paper Bot page rebuilt from panels - same surface, half the moving parts
0.65.0   2026-07-18  The motion map - every loop, mapped and measured
0.64.0   2026-07-18  Thumb-sized tap targets everywhere, and the alert API contract is pinned
0.63.0   2026-07-18  Mute genuinely mutes, alerts never double-send, and reviews read right on WhatsApp
0.62.0   2026-07-18  Every AI call now shows its token cost
0.61.0   2026-07-18  Paper-bot approvals are tamper-proof, and your bot feed is private
0.60.0   2026-07-18  Retrieval quality: the right doc wins again
0.59.0   2026-07-18  The accumulator wave: five loops that store learnings and compound
0.58.0   2026-07-18  Prompt-injection fence on live news, resilient middleware pinned, honest copy
0.57.0   2026-07-18  The copilot can finally answer the macro questions it suggests
0.56.0   2026-07-18  Fabricated demo data can no longer masquerade as real
0.55.0   2026-07-17  The middleware can no longer take down the whole site
0.54.0   2026-07-17  The news intelligence layer can finally save, and the macro tapes stop showing frozen numbers
0.53.0   2026-07-17  AI spend controls that actually hold on serverless
0.52.0   2026-07-17  The scout loop closes: accepted cards queue a build, and your verdicts teach the machine
0.51.0   2026-07-17  Track Record: the real numbers, and one score that cannot silently drift
0.50.0   2026-07-17  Scout gets its own tab - perception and proposals, cleanly separated
0.49.0   2026-07-17  One doctrine for the copilot: research that checks your fit, never a trade to place
0.48.0   2026-07-17  See what the scout sees - the live feed, self-verifying evidence, and an AI read
0.47.0   2026-07-17  Honesty hardening: workers that store nothing now go red, and two privacy holes closed
0.46.0   2026-07-17  The macro fleet: RBA decisions in your channels, a live calendar, CGT radar, and your return in AUD
0.45.0   2026-07-17  The harness learns from its own gaps
0.44.1   2026-07-17  Scout demo-mode fix, proven by its first production run
0.44.0   2026-07-17  Your reviews now actually arrive - monthly, quarterly and yearly, with your real return
0.43.0   2026-07-17  Deploys verify themselves now - and a fresh clone is proven to build, on every push
0.42.0   2026-07-17  A background job that stores nothing now says so, instead of reporting success
0.41.0   2026-07-17  The calendar and fundamentals are storing real data for the first time
0.40.0   2026-07-17  The new reviews could never have been delivered - the API was rejecting them
0.39.0   2026-07-17  The AI scout: Lyra now reads the wide world nightly and files evidence-linked ideas on the board
0.38.0   2026-07-17  Weekly, monthly, quarterly and yearly reviews - see how you are actually doing
0.37.0   2026-07-17  Telegram alerts are readable now: colour-coded relevance, real formatting, no more wall of text
0.36.0   2026-07-17  The Ideas board can actually save your ideas now - four migrations had never reached production
0.35.0   2026-07-17  The chain explorer: every vertical traced end to end, and the chains are finally deep
0.34.0   2026-07-17  The nightly jobs were failing silently every night - your digest, calendar and fundamentals are fixed
0.33.0   2026-07-17  Product updates and Ideas get the premium glass treatment
0.32.0   2026-07-17  Settings split into three focused pages instead of one long scroll
0.31.0   2026-07-17  Lyra listens to your onboarding: the copilot now tailors itself to how YOU answered
0.30.0   2026-07-17  The floating button gently nudges Feedback into view now and then
0.29.0   2026-07-17  Product Updates gets an Ideas board: suggest features and upvote what we build next
0.28.0   2026-07-17  Clearer notifications: an honest per-device push badge, real Telegram and WhatsApp logos, and sharper alert copy
0.27.0   2026-07-17  Make it yours: a customisable bottom bar, a colourful Explore, cleaner type - and an honest goal bar
0.26.0   2026-07-17  Error monitoring verified live in production - and the setup scaffolding is removed
0.25.0   2026-07-17  Error monitoring: Sentry now catches crashes and server errors in production - optional and off by default
0.24.0   2026-07-17  Your Activity: a private, on-device dashboard of how you use Lyra - time, sessions, AI questions, and a surface heatmap
0.23.0   2026-07-17  Global rate limits: the abuse guard now counts across every serverless instance, not per-instance
0.22.0   2026-07-17  One clean rail and an Explore drawer: the daily-drivers up front, the deep research one tap away
0.21.0   2026-07-17  True orientation: both sides of every name you hold and watch, and a goal target that is your own number
0.20.0   2026-07-17  The goal cockpit: your target, your progress, and the exact moves your money needs - exits first
0.19.1   2026-07-17  Landing polish: the alert-channel pills get their own line
0.19.0   2026-07-17  Quantified upside and honest freshness: the high-upside shortlist finally puts a number on the payoff, the live scanner covers the small caps, and stale boards say so
0.18.0   2026-07-17  Portfolio-aware, honest about capital: no more fantasy $100k account, real small-account costs, and win rates that never masquerade as a track record
0.17.0   2026-07-17  Honest edge and a real trade plan: sizing to your own capital, netting costs against the signal, and never dressing up a guess as history
0.16.0   2026-07-16  The calendar tells the truth and every dialog behaves: live events, a real clock, and one shared focus system
0.15.0   2026-07-16  On the move: fresh IPO data, live-refreshing drawers, and a console that respects your thumb
0.14.0   2026-07-16  Signature onboarding: a branded terminal splash, gate micro-delight, a private commissioning card, and a live nervous-system map
0.13.0   2026-07-16  Your digital trading twin: Lyra now learns your interests, habits, and risk posture - and reflects them back
0.12.0   2026-07-16  The agent harness: every section of the codebase now has an owning maintenance chain, enforced in CI
0.11.2   2026-07-16  Onboarding stays honest: a parity gate + skill chain across the human, in-app, and agent surfaces
0.11.1   2026-07-16  The loop closes: measured outcomes, real digests, follow-up coaching + a console that cannot silently fail
0.11.0   2026-07-16  Security hardening: SSRF fences, tenant isolation, founder-gating
0.10.0   2026-07-16  AI you can measure: quality evals, a learned recovery model, hybrid retrieval, AI-ops
0.9.1    2026-07-16  Review hardening: honest copy, fresh fill prices, smarter doc answers
0.9.0    2026-07-16  Continuous intelligence + a robust agent harness
0.8.0    2026-07-16  Setup Companion, agent onboarding, Redis cache + a knowledge layer
0.7.0    2026-07-16  Replicate it: walkthroughs, /setup agent, Docker/Coolify, full costs
0.6.0    2026-06-27  TradingView Copilot + Pine strategy export
0.5.1    2026-06-20  Brand + UI polish, Find/Graph fixes
0.5.0    2026-06-20  Dogfooding gap-closers
0.4.0    2026-06-18  Currency-safe trades + the Investigation System
0.3.0    2026-06-18  Dogfooding-readiness pass
0.2.0    2026-06-12  Thematic intelligence + research platform
0.1.0    2026-06-08  Initial release

(121 builds - full per-build highlights in CHANGELOG.md and in-app /whats-new)
```
<!-- BUILD-HISTORY:END -->

---

## ⚠️ Disclaimer

Lyra is **research software, not financial advice**. It surfaces and explains technical signals; it does not tell you what to buy or sell. Markets are risky - do your own research and never invest more than you can afford to lose.

## 📄 License

[MIT](./LICENSE) - free to use, fork, and learn from. Built with ❤️ by [Vivacity.ai](https://vivacity.ai).
