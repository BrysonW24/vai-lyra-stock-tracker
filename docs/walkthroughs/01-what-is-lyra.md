# What is Lyra - the 10-minute tour

> Lyra is research and educational software. It is **not financial advice**. Nothing it shows is a recommendation to buy or sell anything. See [DISCLAIMER.md](../../DISCLAIMER.md).

This is the first walkthrough in the series. It explains what Lyra is, how to think about it, and what every screen does - then points you at the setup walkthroughs. The full series index is at [README.md](./README.md).

## The one idea

Lyra is an **oversold-recovery scanner**. It watches a universe of US tech stocks on an hourly cadence and asks one question per stock: "has this name been beaten down, and is it now showing the first mechanical signs of turning back up?"

That is a **mean-reversion** style (buying weakness that is starting to recover), and it is explicitly **not** buy-strength momentum (buying things that are already going up). A stock at all-time highs with a screaming RSI scores badly in Lyra on purpose. The stocks Lyra surfaces look ugly on a chart - that is the point.

Jargon, defined once:

| Term | Meaning |
|------|---------|
| RSI | Relative Strength Index, a 0-100 gauge of recent price momentum. Low = beaten down. |
| MACD | Moving Average Convergence Divergence, a trend-momentum indicator. Its "histogram" going from negative toward zero = downside pressure easing. |
| SMA | Simple Moving Average of price over N periods (e.g. SMA200 = 200-period average). |
| Mean reversion | Betting that a stretched price snaps back toward its average. |
| BYOK | Bring Your Own Key - you paste your own AI provider API key instead of using a hosted one. |

## The deterministic score owns every number

Every stock gets a **0-100 score** computed by plain arithmetic in `workers/stock_scanner/signal_engine.py` (mirrored exactly in `src/lib/pine/lyra-strategy.ts` for TradingView export). No AI is involved in scoring. The optional AI layer only **phrases** what the engine already computed - it never invents a number, and if the AI is off the numbers are identical.

The five blocks and their caps, verified against `signal_engine.py`:

| Block | Max | What earns points |
|-------|-----|-------------------|
| RSI | 25 | +10 RSI inside the 35-50 reset band, +10 RSI rising over 1 period, +5 rising over 2 |
| MACD | 30 | +8 histogram still negative, +12 histogram improving over 1 period, +5 over 2, +5 MACD below signal while improving |
| Price location | 15 | +10 price within 10% of the 60-period low, +5 near/below the 50 SMA |
| Trend | 15 | +10/+5 long-trend posture (SMA200 terms, mutually exclusive) plus SMA20-vs-SMA50 |
| Volume | 15 | +5 x 3 volume-participation steps |

The sum is capped at 100. Thresholds (defaults from `workers/stock_scanner/config.py`, overridable via `ALERT_SCORE_THRESHOLD` / `WATCHLIST_SCORE_THRESHOLD`):

| Score | Status | Action state shown |
|-------|--------|--------------------|
| >= 75 | `strong_setup` | buy_review |
| >= 60 | `watchlist_setup` | watch |
| Fell from strong to below 60 | `invalidated` | invalidated |
| Dropped more than 8 points | `weakening` | do_not_add |
| Otherwise | `no_signal` | hold |

"Action state" is a research label, not an instruction. Lyra never places trades for you on real money without the separate, explicitly-armed trading layer.

## Hourly cadence

The scanner is a Python package at `workers/stock_scanner/`, run once an hour by GitHub Actions (`.github/workflows/hourly-stock-scanner.yml`, cron `5 * * * *` UTC). A market-hours guard skips runs outside US trading hours unless you set `FORCE_SCAN=true`. Each run fetches candles, computes indicators, scores everything, writes results to Supabase (a hosted Postgres platform), and fires alerts for status changes.

The web app never computes scanner numbers itself - it reads what the last run wrote. That separation is why the dashboard can run with zero infrastructure (demo mode, below).

## The three run modes

| Mode | Keys needed | What you get |
|------|-------------|--------------|
| Demo | **None** | Full UI on built-in demo data. Just `npm run dev`. |
| Live | Supabase (4 vars below) | Real hourly scanning of your tickers, portfolio and watchlist overlays, Telegram / web-push alerts. |
| AI | Live + one AI key | Chat, daily briefs, and plain-English phrasing of the deterministic numbers. |

Demo fallback is automatic: whenever the Supabase env vars are absent, `src/lib/data.ts` serves `demo-data` instead. There is no flag to toggle.

User-specific values (full setup is in walkthroughs 02-03; this is just so the names mean something):

| Variable | Where to get it | Example shape |
|----------|-----------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your own Supabase project > Settings > API | `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page, "anon public" key | `eyJhbGciOi...` (long JWT) |
| `SUPABASE_URL` | Same URL as above (worker-side copy) | `https://abcdefgh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page, "service_role" key - **secret, worker only** | `eyJhbGciOi...` (long JWT) |
| `OPENAI_API_KEY` | platform.openai.com > API keys (optional, server-side hosted AI) | `sk-...` |
| `TELEGRAM_BOT_TOKEN` | Telegram @BotFather (optional, alerts) | `123456789:AAE...` |

Important: you create **your own** Supabase project. The founder's project is separate; nothing in this repo points you at shared infrastructure. Schema comes from `supabase/migrations/` (28 numbered files) plus the worker tables in `sql/` (run `sql/_apply_all_scanner_schema.sql`).

## See it in two minutes (demo, zero keys)

Prerequisite: Node.js 20+ and npm 10+ (`package.json` engines).

```bash
node -v
```

You know it worked when: it prints `v20.x` or higher. Lower than 18 and Next.js 15 will not run.

```bash
git clone <repo-url>
cd vai-lyra-stock-tracker
npm install
```

You know it worked when: install finishes without errors (the `prepare` step quietly wires git hooks; that is expected).

```bash
npm run doctor
```

You know it worked when: you see the `Lyra setup doctor` banner, a green check for your Node version, and the yellow line `Frontend Supabase not set - dashboard runs on demo data`. That yellow line is correct for demo mode, not a failure.

```bash
npm run dev
```

You know it worked when: the terminal first runs the content build (`predev` runs `scripts/build-content.mjs` automatically), then Next.js reports ready, and http://localhost:3000 redirects a first-time visitor to the `/welcome` landing page. Click "Set up my console" and complete `/onboarding`, after which `/` shows the command centre populated with demo stocks. (Returning visitors with the `lyra_onboarded` cookie land on the command centre directly.)

```bash
curl http://localhost:3000/api/health
```

You know it worked when: you get JSON like `{"ok":true,"version":"0.6.0","versionDate":"2026-06-27","mode":"demo"}` (version will match whatever `src/lib/version.ts` says is current). `"mode":"demo"` confirms you are on built-in data.

## Tour of the surfaces

All routes live under `src/app/`; the sidebar nav (`src/components/AppShell.tsx`) covers the main surfaces, grouped roughly like this - `/tickers/[symbol]` is reached from any ticker row and `/account` from the account menu (`src/components/AccountMenu.tsx`), not the sidebar:

**Yours - the daily-driver row**

| Route | Name | What it is |
|-------|------|------------|
| `/` | Command | The command centre: daily brief, strongest setups, watchlist triggers, holdings momentum, market and macro context strips, paper-bot strip. |
| `/portfolio` | Portfolio | Add what you own; signals become personal (what to review, what is cooling). |
| `/trades` | Trade Log | Your logged trades and snapshots. |
| `/watchlist` | Watchlist | Setups you want to catch, with target triggers. |

**Investigation system**

| Route | Name | What it is |
|-------|------|------------|
| `/findings` | Findings | Structured research findings you capture and revisit. |
| `/graph` | Investigation Graph | The findings connected as a graph - entities, theses, evidence. |
| `/charts`, `/saved`, `/wire`, `/intelligence`, `/calendar` | Charts / Saved / Live Wire / Intelligence / Calendar | Chart gallery, saved items, live news wire, intelligence feed, events calendar. |

**Signals and research**

| Route | Name | What it is |
|-------|------|------------|
| `/radar` | Signal Radar | Every tracked stock scored 0-100, ranked. The heart of the product. |
| `/smart-money` | Smart Money | Institutional positioning signals. |
| `/themes`, `/supply-chain`, `/small-caps`, `/investors`, `/awards`, `/flows`, `/filings`, `/ipos`, `/commodities`, `/fundamentals` | Research surfaces | World themes, supply chains, small-cap research, investor radar, government awards, capital flows, SEC filings, IPO radar, commodities, fundamentals. |

**Analysis and trading layer**

| Route | Name | What it is |
|-------|------|------------|
| `/comparison`, `/simulation`, `/strategy-lab`, `/calculators` | Analysis tools | Compare names, simulate scenarios, tune strategy variants, position calculators. |
| `/paper-bot` | Paper Bot | Automated paper trading (fake money) driven by the signal engine. |
| `/trading` | Live Bot | The real-money layer - heavily gated, off by default. Research tooling first; arming is a deliberate, separate act. |

**Ticker detail, learning, meta**

| Route | Name | What it is |
|-------|------|------------|
| `/tickers/[symbol]` | Ticker detail | Per-stock evidence: score breakdown plus an embedded TradingView chart, with a **Pine** button (`src/components/PineExportButton.tsx`) that copies a TradingView Pine v5 strategy reproducing Lyra's exact score, so you can backtest the same logic in TradingView. |
| `/education` | Education (Learn) | Every metric explained in plain English. |
| `/whats-new` | What's New | The in-product changelog, rendered from `RELEASES` in `src/lib/version.ts`. |
| `/settings` | Strategy Rules | Shows the live thresholds (strong setup, watchlist, signal change) the worker is using. |
| `/account` | Account | Profile plus notification preferences (Telegram chat ID, push). Alerts themselves are delivered by the worker via Telegram and web push. |

## Troubleshooting

Real failure modes, derived from the code:

**Health endpoint says `"mode":"demo"` even though you set Supabase keys.** `NEXT_PUBLIC_*` variables are inlined at build time (see the comment in `Dockerfile` and `src/app/api/health/route.ts`). Locally: stop and restart `npm run dev` after editing `.env.local`. In Docker/Coolify: pass them as **build args**, not runtime env, then rebuild.

**`npm run worker:scan` runs but writes nothing.** With `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` unset, `SupabaseRepository` (in `workers/stock_scanner/supabase_repo.py`) leaves its client as `None` and every write returns early - a deliberate safe no-op so the GitHub Action never crashes on a fork with no secrets. Set both vars to actually persist scans.

**Worker logs `Scanner skipped by market-hours guard`.** Working as designed outside US market hours (`ENABLE_MARKET_HOURS_GUARD=true` is the default). For a one-off test run, set `FORCE_SCAN=true`.

**`ModuleNotFoundError: No module named 'workers'`.** You ran the scanner from the wrong directory. It is a package invoked with `python -m workers.stock_scanner.main` from the repo root - which is exactly what `npm run worker:scan` does. If instead the missing module is `supabase` or `yfinance`, run `pip install -r requirements.txt` (Python 3.11+).

**`git push` rejected with a version-bump error.** The pre-push hook (`scripts/check-version-bump.mjs`) blocks pushes that change shippable code (`src/`, `supabase/`, `workers/`, `public/`) without a version bump. Fix: prepend a new entry to `RELEASES` in `src/lib/version.ts`, then `npm run release`. Emergency bypass: `VD_SKIP_VERSION=1 git push` (use sparingly).

**Port 3000 already in use.** Run on another port: `npm run dev -- -p 3042` (the repo's own [QUICKSTART.md](../../QUICKSTART.md) uses 3042, matching the `NEXT_PUBLIC_APP_URL` default in `.env.example`).

**Doctor prints a red Node line.** `Node X - Next 15 needs Node 18+` means your Node is too old; install Node 20+ to match the `engines` field in `package.json`.

## Where to next

| Walkthrough | Read it when |
|-------------|--------------|
| [02 - Run it yourself](./02-run-it-yourself.md) | You want the demo running on your machine, step by step. |
| [03 - Go live with Supabase](./03-go-live-supabase.md) | You are ready to create your own Supabase project and run real hourly scans. |
| [04 - Deploy your own](./04-deploy-your-own.md) | You want to self-host (Docker/Coolify) and understand the versioning discipline. |
| [05 - Understand the score](./05-understand-the-score.md) | You want the full anatomy of the 0-100 engine and its Pine export. |

If any of those links do not resolve yet, the authoritative index is [README.md](./README.md).

Reminder one more time, because it matters: Lyra surfaces research candidates. It does not know your situation and it is not advice.
