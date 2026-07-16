# Go live - your own Supabase + the hourly scanner

This walkthrough takes Lyra from demo mode (built-in sample data) to live mode: your own free Supabase project storing real scan results, produced by the Python scanner worker, refreshed every hour by GitHub Actions.

Two bits of jargon up front:

- **Supabase** is a hosted Postgres database with built-in authentication and a REST API. The free tier is enough for Lyra. You create your own project - you do not share anyone else's.
- **The scanner worker** is the Python package at `workers/stock_scanner/`. It downloads hourly price candles, computes indicators (RSI, MACD, moving averages, volume), scores each stock 0-100, and writes everything into your Supabase tables. The Next.js dashboard only reads.

Lyra is research tooling, not financial advice. A score is a structured observation about price behaviour, never a recommendation to buy or sell.

Back to the index: [README.md](./README.md).

## What you need before starting

- The repo cloned and `npm install` done (the app already runs in demo mode with `npm run dev -- -p 3042`).
- Node 20+ (`package.json` requires `node >= 20`), Python 3.11 or newer (the hourly workflow pins 3.11), and a terminal.
- A free account at [supabase.com](https://supabase.com) and a GitHub account (for the hourly automation later).

## Step 1 - create your Supabase project

1. Sign in at supabase.com and click **New project**.
2. Pick any name (for example `lyra`), set a strong database password (you will not need it for this walkthrough, but store it), choose a region near you, and create the project.
3. Wait for provisioning to finish (about a minute).

You know it worked when: the project dashboard loads and the left sidebar shows **Table Editor**, **SQL Editor**, and **Authentication**.

## Step 2 - apply the database schema

The repo ships two SQL sets. Know which is which:

| Location | What it is | Role |
|---|---|---|
| `supabase/migrations/` | 28 numbered files, `001_extensions.sql` through `028_findings.sql` | The canonical multi-user schema: auth profiles, RLS policies, portfolio, watchlist, notifications, trade logs, seeds. Apply all of these, in numeric order. |
| `sql/` | `001_create_stock_scanner_tables.sql` through `009_events_ipos.sql`, plus `_apply_all_scanner_schema.sql` | The legacy scanner-only schema. `_apply_all_scanner_schema.sql` concatenates all nine into one idempotent reconciliation script that "brings an existing app-migration DB up to the worker's expected schema" (its own header). No drops, no deletes, safe to run repeatedly. |

The simplest safe method is the dashboard SQL editor - no CLI, no local Postgres:

1. In your Supabase project, open **SQL Editor** and click **New query**.
2. Open `supabase/migrations/001_extensions.sql` in your editor, copy the whole file, paste it into the SQL editor, click **Run**.
3. Repeat for every file in numeric order: 001, 002, ... up to 028. The migrations are idempotent (`create table if not exists`), so re-running one after an error is safe.
4. Finally, paste and run `sql/_apply_all_scanner_schema.sql` once. This adds any scanner-expected columns and tables the worker writes to that the app migrations do not cover.

Order matters within the migrations (015 creates RLS policies over tables from earlier files; 016 seeds data into tables from 004 and 012), so do not skip around.

You know it worked when: each run reports "Success. No rows returned", and this checkpoint query returns `universes = 5` and `education_modules = 4` (seeded by `016_seed_initial_data.sql`):

```sql
select
  (select count(*) from public.stock_universes) as universes,
  (select count(*) from public.education_modules) as education_modules;
```

## Step 3 - enable email auth

Lyra signs users in with email plus a 6-digit PIN (the PIN is stored as the Supabase password - see `src/components/auth/AuthForm.tsx`).

1. In Supabase go to **Authentication -> Sign In / Providers** and make sure the **Email** provider is enabled (it is on by default in new projects).
2. Note the confirmation behaviour: new projects have **Confirm email** switched on, so a new account cannot sign in until the user clicks the link Supabase emails them. Lyra's sign-up form expects this and tells the user "We've sent a confirmation link ... Tap it to verify, then come back and sign in with your PIN."
3. In **Authentication -> URL Configuration**, set the **Site URL** to `http://localhost:3042` (or add `http://localhost:3042/**` to **Redirect URLs**). The sign-up form asks Supabase to send the confirmation link back to `/auth/callback` on your app's origin (`src/components/auth/AuthForm.tsx`), but Supabase only honours redirect targets on this allow-list - a new project's Site URL defaults to `http://localhost:3000`, so without this change the confirmation link lands on a dead page.
4. Optional polish: `supabase/email-templates/` contains Lyra-branded HTML for the confirm-signup, magic-link, and recovery emails, with paste-in instructions in `supabase/email-templates/README.md`.

You know it worked when: **Authentication -> Sign In / Providers** shows Email enabled, and **URL Configuration** points at `http://localhost:3042`. (You will prove the full flow in step 7.)

## Step 4 - collect your keys

Everything you need is in the Supabase dashboard under **Project Settings -> API** (newer projects split this across "API Keys" and "Data API" pages).

| Variable | Where to get it | Example shape |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL` | Project Settings -> API -> Project URL (same value for both variables) | `https://abcdefghijklmnop.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page - the key labelled **anon public** (older projects) or **Publishable key** (newer projects). Either works; the app passes it straight to the Supabase client. | `eyJhbGciOiJIUzI1NiIs...` or `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page - the key labelled **service_role** (or **Secret key**). Treat it like a password. | `eyJhbGciOiJIUzI1NiIs...` or `sb_secret_...` |
| `DEFAULT_USER_ID` | Authentication -> Users, after you sign up in step 7. It is your account's UUID. | `1c9e4a7b-2f3d-4e5a-9b8c-0d1e2f3a4b5c` |

Why two kinds of key:

- The **anon/publishable key** is safe to expose in the browser. It can only do what Row Level Security allows. RLS (Row Level Security) is Postgres enforcing per-row access rules: in Lyra's schema (`supabase/migrations/015_rls_policies.sql`), shared market data is readable by everyone, while portfolio, watchlist, and alerts rows are readable only by the user whose `user_id` matches.
- The **service role key** bypasses RLS entirely. Only the Python worker uses it, server-side, to write scan results. It must never appear in any `NEXT_PUBLIC_*` variable or reach a browser - `npm run doctor` flags this as a SECURITY failure if you get it wrong.

You know it worked when: you have three values saved (project URL, anon/publishable key, service-role key) and each matches the example shape in the table - `DEFAULT_USER_ID` intentionally waits until you sign up in step 7.

## Step 5 - fill in .env.local

From the repo root:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and set these five (leave everything else as-is for now):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-OR-PUBLISHABLE-KEY
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
DEFAULT_USER_ID=
```

The `NEXT_PUBLIC_*` pair is what the frontend uses for read-only, RLS-respecting queries. The unprefixed pair is worker-only. `DEFAULT_USER_ID` stays blank until step 8 - per the comment in `.env.example`, it makes the worker stamp your portfolio and watchlist overlays with your user id "so they show up under RLS"; blank means legacy single-operator mode where overlays are written with a null `user_id` (and are then invisible to a signed-in user - see Troubleshooting).

Never commit `.env.local`. It is already gitignored.

You know it worked when: `npm run doctor` prints green checks for both key pairs and the mode line changes:

```
✓ Frontend Supabase keys present (NEXT_PUBLIC_*)
✓ Worker Supabase secrets present
✓ Supabase URL reachable
Mode: Live mode - real scanning enabled
```

## Step 6 - run the scanner once locally

The worker's Python dependencies live in `requirements.txt` at the repo root (pandas, numpy, yfinance, ta, supabase, requests, python-dotenv, pydantic, pytz, pytest). Install them in a virtual environment:

```bash
cd /path/to/vai-lyra-stock-tracker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Checkpoint for the install: this prints nothing (no ImportError):

```bash
python -c "import pandas, yfinance, ta, supabase"
```

Two things the code makes true, worth knowing before you run:

- `npm run worker:scan` is just `python -m workers.stock_scanner.main` (see `package.json`), so the venv must be active - inside it, `python` resolves - and you must run from the repo root so the `workers` package is importable.
- The worker reads plain environment variables only (`workers/stock_scanner/config.py` uses `os.getenv`; nothing in `workers/` calls `load_dotenv`, even though python-dotenv is installed). Your shell has to export the values from `.env.local` itself.

There is also a market-hours guard (`workers/stock_scanner/scheduler_guard.py`): scans only proceed Monday-Friday between 13:00 and 23:59 UTC, unless `FORCE_SCAN=true`. So for a first run at any hour:

```bash
set -a; source .env.local; set +a
FORCE_SCAN=true npm run worker:scan
```

With no `TICKER_SYMBOLS` set, it scans the built-in universe of 49 tech names (`workers/stock_scanner/universe.py`) - expect a few minutes on the first run while yfinance downloads 180 days of hourly candles per symbol.

You know it worked when: the log shows lines like these (from `workers/stock_scanner/main.py`):

```
Scanning 49 tickers with yfinance
Fetching AAPL (AAPL)
...
Scanner finished: tickers=49 candles=... indicators=49 signals=49 portfolio_overlays=0 watchlist_overlays=0 alerts=0
```

and this query in the Supabase SQL editor shows the run:

```sql
select status, tickers_scanned, candles_saved, signals_created
from public.stock_scanner_runs
order by started_at desc limit 1;
```

Expect `status = success` and `tickers_scanned = 49`. Zero overlays and zero alerts is correct at this point - you have no portfolio or watchlist yet.

## Step 7 - sign up in the app and see live data

```bash
npm run dev -- -p 3042
```

1. Open http://localhost:3042. With the Supabase keys set, the middleware (`src/middleware.ts`) now gates the whole app behind sign-in: a signed-out visitor is redirected to the public `/welcome` marketing page instead of the dashboard. Landing on `/welcome` is itself your first proof that live-auth mode is on.
2. Confirm via the health endpoint - API paths bypass the auth gate, and it reports which mode the build sees:

   ```bash
   curl -s http://localhost:3042/api/health
   ```

   Expected: `{"ok":true,"version":"...","versionDate":"...","mode":"live"}`.
3. From `/welcome`, go to the sign-up page, enter first name, last name, email, and a 6-digit PIN. You should see "Account created. We've sent a confirmation link to ...".
4. Open the email, click the confirmation link (it lands on `/auth/callback` thanks to the URL configuration from step 3), then sign in with your email and PIN.
5. Complete onboarding. The same middleware funnels a signed-in user who has not finished onboarding into the mandatory `/onboarding` flow - you cannot reach the rest of the app until it is done.
6. Now, on the dashboard, verify the amber **DEMO** chip and the "Demo data - signals shown are illustrative samples" banner are gone - the top-bar market status now uses live data (the dashboard's `generatedFrom` flag flips from `demo` to `supabase` in `src/lib/data.ts`).

Signing up also auto-provisions your starter rows: a database trigger (`supabase/migrations/017_profile_bootstrap.sql`) inserts your `profiles`, `user_settings`, `onboarding_progress`, and alert-preference rows the moment the auth user is created.

You know it worked when: you are signed in, past onboarding, on a dashboard with no DEMO chip, and in Supabase **Authentication -> Users** your email appears with a confirmed status. Bonus check in the SQL editor: `select id, email from public.profiles;` shows your row.

## Step 8 - set DEFAULT_USER_ID and rescan

Copy your user UUID from **Authentication -> Users** (or the `profiles` query above) into `.env.local`:

```bash
DEFAULT_USER_ID=your-uuid-here
```

Then rescan so overlays get stamped with your id:

```bash
set -a; source .env.local; set +a
FORCE_SCAN=true npm run worker:scan
```

You know it worked when: after you add a holding or watchlist item in the app and rescan, the `Scanner finished:` line shows non-zero `portfolio_overlays` / `watchlist_overlays`, and those panels populate for your signed-in account.

## Step 9 - automate hourly with GitHub Actions

The workflow `.github/workflows/hourly-stock-scanner.yml` runs `python -m workers.stock_scanner.main` on GitHub's servers every hour at :05 UTC (cron `5 * * * *`), on Python 3.11, installing `requirements.txt` each run. The market-hours guard still decides whether a given hour actually scans. With no secrets configured, the worker no-ops safely.

The job declares `environment: Production`, so put the secrets in a GitHub **environment** with that exact name:

1. Push your clone (or fork) to your own GitHub repository.
2. Repo **Settings -> Environments -> New environment**, name it `Production` exactly.
3. Add these environment secrets (the workflow reads exactly these names):

| Secret | Required? | Value |
|---|---|---|
| `SUPABASE_URL` | Yes | Your project URL from step 4 |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Your service role key |
| `DEFAULT_USER_ID` | Recommended | Your user UUID from step 8 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Optional | Only for Telegram alerts |
| `FINNHUB_API_KEY` | Optional | Free Finnhub key for news/fundamentals |
| `APP_BASE_URL`, `NOTIFICATION_DISPATCH_SECRET` | Optional | Only for a deployed app with web push; skip for now |

4. Optionally add environment **variables** (all have safe defaults): `MARKET_DATA_PROVIDER` (default `yfinance`), `TICKER_SYMBOLS`, `DEFAULT_TIMEFRAME` (default `1h`), `ENABLE_TELEGRAM_ALERTS` (default `true`), `ENABLE_MARKET_HOURS_GUARD` (default `true`), `APP_BASE_URL`.
5. Test it now: **Actions** tab -> **Hourly Stock Scanner** -> **Run workflow** (the workflow includes `workflow_dispatch` for exactly this).

You know it worked when: the manual run goes green and its "Run scanner" step log ends with `Scanner finished: tickers=49 ...` - or, outside US market hours, `Scanner skipped by market-hours guard`, which is the guard working, not a failure. From then on, `stock_scanner_runs` gains a new row every hour during US market hours, and the dashboard's "last scan" freshness stays green.

## Troubleshooting

**Signed in, but portfolio / watchlist / alerts are empty while the main signal grid works.**
This is RLS doing its job. Shared market tables (`stock_signals`, `stock_candles`, ...) are readable by everyone, but user-private tables are owner-only (`auth.uid() = user_id` in `015_rls_policies.sql`). If the worker ran with `DEFAULT_USER_ID` blank, it wrote overlay and alert rows with a null `user_id`, which no signed-in user can see. Fix: set `DEFAULT_USER_ID` to your UUID (step 8) and rerun the scanner. Verify with the service-role-backed SQL editor: `select user_id, count(*) from public.watchlist_signal_overlay group by 1;` - null `user_id` rows are the giveaway.

**Sign-in fails with "Email not confirmed".**
You created the account but never clicked the confirmation link. Resend or find the email, or confirm manually in Supabase: **Authentication -> Users -> your user -> ... -> Confirm email**. (Turning off "Confirm email" in the provider settings also works for private instances, but keep it on for anything public.)

**Worker runs but nothing appears in Supabase, log ends `candles=0 indicators=0`.**
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` were not in the worker's environment. The repository layer silently no-ops without them - every `save_*` in `workers/stock_scanner/supabase_repo.py` bails out early (returning 0 or None) when the client is absent, so the finished line shows `candles=0 indicators=0` (`signals=49` still appears because the counter in `main.py` increments even though nothing was persisted). The scan still fetches and scores, it just persists nothing. Locally, remember the worker does not read `.env.local` by itself: run `set -a; source .env.local; set +a` in the same shell first. `npm run doctor` warning "Worker Supabase not set - the scanner cannot persist results" confirms this state.

**Log says `Scanner skipped by market-hours guard`.**
Not an error. Scans only run Monday-Friday 13:00-23:59 UTC (US market hours plus a margin). For an out-of-hours test, prefix `FORCE_SCAN=true`. The run row is recorded with `status = skipped`.

**`ModuleNotFoundError: No module named 'workers'` or `python: command not found`.**
Run from the repo root (the `-m` module path is relative to your working directory) with the venv activated (`source .venv/bin/activate` provides the plain `python` the npm script calls).

**Dashboard still shows the DEMO chip after filling .env.local.**
Next.js inlines `NEXT_PUBLIC_*` values when the dev server starts - restart `npm run dev` after editing `.env.local`. Also check for stray quotes or spaces around values, then trust `npm run doctor`: if it says live mode, the env file is right.

**`npm run doctor` prints `SECURITY: service-role key is exposed via NEXT_PUBLIC_*`.**
You pasted the service role key into a `NEXT_PUBLIC_` variable. Remove it immediately, move the value to `SUPABASE_SERVICE_ROLE_KEY`, and rotate the key in Supabase (Project Settings -> API) since anything `NEXT_PUBLIC_*` may have reached a browser bundle.

## Where to next

- Back to the walkthrough index: [README.md](./README.md) - it links the sibling walkthroughs for local setup, the scoring model, alerts, and deployment.
- Optional layers from `.env.example` once live mode works: Telegram alerts (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`), Finnhub news/fundamentals (`FINNHUB_API_KEY`), and hosted AI chat (`OPENAI_API_KEY`).

Everything the scanner writes and the dashboard shows is research tooling - structured observations to investigate, not signals to act on.
