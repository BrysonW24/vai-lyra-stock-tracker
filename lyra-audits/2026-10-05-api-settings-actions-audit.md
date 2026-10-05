# API, settings and GitHub Actions audit - 2026-10-05

Audited at v0.131.0 (`1ddaa12`), fixes shipped as v0.132.0. Scope: every third-party API and
credential the app uses and where each is configured, the 48 API routes, the deployment settings,
and the seven GitHub Actions workflows.

Evidence standard: every finding below was confirmed against a real artefact - a workflow run log,
a live response header, a read-only query against the production database, or the line of code -
and each one says which. Where something could not be verified, it is marked **UNVERIFIED** and
says why.

## The short version

The code was in better shape than the system around it. Three things had been failing for months
with nobody told, one of them took production down for four days, and the app was slow for a
reason that had nothing to do with its design.

| | Before | After (v0.132.0) |
|---|---|---|
| CI on `main` | **Red on 59 consecutive pushes** (2026-07-28 to 2026-09-08). Every release in that window shipped behind a failing check | Green on the Node major production runs; pages someone if it goes red |
| Nightly maintenance | **Red 64 of 66 runs**, 59 in a row since 2026-07-17 | Split into four jobs so one known failure no longer hides the rest. Still red until two migrations are applied (see "Needs you") |
| Hourly scanner | **Failed all 188 runs from 2026-09-26 to 2026-09-30** - the database had been restricted for exceeding its egress quota | The cause is removed at the source (see F1) |
| Failure alerts | **Never delivered, in any workflow, ever.** The secrets they read were never set | Every workflow pages on failure and raises a visible warning when it cannot |
| Cron keepalive | **Refused (HTTP 403) on every run** - crons were on course to auto-disable ~2026-11-07 | Granted the permission it needs; warns if refused |
| Page speed | Health check 1.3-1.7 s from Sydney; dashboard spent 1.5 s in one query | Functions moved beside the database; that query is ~3 ms |
| Dashboard | 19 of 99 scanned tickers silently missing | All shown |
| Hosted AI | Reachable by nobody, including the owner (all trials lapsed, no grant configured) | Needs one env var (see "Needs you") |

## Needs you

These are the things only you can do, most valuable first. None of them is code.

1. **Apply three migrations in the Supabase SQL editor**, in order:
   `supabase/migrations/056_emerging_winner.sql`, `057_emerging_winner_outcome_conjuncts.sql`,
   `058_close_self_grant_holes.sql`. The first two are why the nightly job is red (three tables
   missing since they were written). The third closes two privilege holes at the database (F9,
   F10) - the app is already protected in code, this makes it structural. All three are
   idempotent, and 058 was built from zero and behaviour-tested locally (forged writes rejected,
   ordinary writes still allowed).
2. **Ratify pruning.** The database is at **288 MB of 500 MB** - past the 250 MB warning and 12 MB
   short of the 300 MB act-now line in `DATA-ECONOMICS.md`. About 58 MB sits past its audited
   benefit horizon (`stock_alerts` 45.8 MB past 31 days, `stock_indicators` 12.1 MB past 30 days).
   At ~2.5 MB a trading day the free tier fills around late December.
3. **Set `FINNHUB_API_KEY` as a GitHub Actions secret.** It has only ever been set on Vercel,
   which runs none of the workers that use it - so news, fundamentals and the earnings calendar
   have run on the demo provider and persisted nothing since they were built. This is why "What
   moved" is empty. `gh secret set FINNHUB_API_KEY --repo BrysonW24/vai-lyra-stock-tracker`.
   Read F14 first: two of the three workers have never run live and one probably will not work.
4. **Check Supabase egress** (dashboard -> Reports -> Egress) about a week after this release. It
   is not measurable from SQL, and it is the quota that took the project down.
5. **Deactivate four dead tickers** (delisted or renamed - Yahoo has returned nothing for months):
   `update stock_tickers set scan_enabled = false where symbol in ('ANSS','CFLT','CYBR','PSTG');`
6. **Optional - turn Emerging Winners on for real.** After step 1, set the repository variables
   `EW_REAL_UNIVERSE=1` and `SEC_USER_AGENT="Your Name you@example.com"`. That is the moment the
   immutable track record starts, so it is your call when.

## Method and coverage

- **GitHub Actions:** all seven workflows read in full; run history pulled for each (400 scanner
  runs, 195 CI runs, 66 nightly runs); failure logs read for every distinct failure.
- **Settings:** env var names enumerated across four places (code, `.env.example`, Vercel, GitHub)
  and reconciled. No secret value was read or printed at any point.
- **Live system:** response headers and timings from the production site; read-only queries
  against the production database for sizes, plans, policies and row counts.
- **API routes:** the 23 AI, community and read routes were reviewed line by line. The 25 account,
  trading, webhook and cron routes got a **targeted** review of the classes that matter most
  (secret checks failing open, webhook signatures, service-role use, account deletion) rather than
  a line-by-line read. Third-party provider clients were reviewed for the Finnhub path and the
  scanner; the LLM gateway internals were not re-reviewed beyond the findings listed.

A note on previous audits: the 2026-07-29 readiness audit scored "Worker Fleet & Scheduler" 90 and
"Data Layer" 93. On that date CI had been red for a day and the nightly job for twelve. Those
scores came from reading the code. **Read the run history too** - it is the only place this
class of failure shows.

## Where every API and credential is configured

Names only. "-" means not set there. Bold marks a gap.

| Service | What it does | Env var(s) | Vercel prod | GitHub Actions | Notes |
|---|---|---|---|---|---|
| Supabase (Postgres + Auth) | Everything | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_POOLER_URL` | set (no pooler URL - not needed) | set | Region: Sydney (`ap-southeast-2`) |
| Upstash Redis | Cache, shared rate limits, AI day budget | `KV_REST_API_URL`, `KV_REST_API_TOKEN` | set | - (not needed) | Region: Sydney. Health reports `cache: upstash` |
| OpenAI (hosted AI) | Copilot, briefs, explanations | `OPENAI_API_KEY`, `LYRA_HOSTED_OPENAI_MODEL`, `LYRA_OPENAI_REASONING_EFFORT` | set | - | **Nobody is entitled to use it** - see F12 |
| Hosted-AI grant | Who keeps hosted AI after the trial | `AI_INCLUDED_EMAILS` | **-** | - | The only standing grant |
| Finnhub | News, fundamentals, earnings + IPO calendar | `FINNHUB_API_KEY` | set (unused there) | **-** | Set in the one place that does not run the workers - F14 |
| Yahoo (yfinance) | Prices | none | n/a | n/a | Unofficial; 4,944 calls a day |
| USAspending | Federal awards | `USASPENDING_USER_AGENT` | - | - | Keyless. Vercel cron, daily 13:00 UTC |
| SEC EDGAR | Filings, insider flow | `SEC_USER_AGENT` | - | **-** | Required before the real Emerging Winner universe is switched on |
| Telegram | Alerts out, commands in | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | token set, **webhook secret -** | - | Inbound commands (mute, kill switch) are rejected until the secret is set and the webhook registered - the route fails closed, correctly |
| Web Push | Browser + iOS alerts | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | set | - | |
| Worker -> app dispatch | Scanner hands alerts to the app | `NOTIFICATION_DISPATCH_SECRET`, `APP_BASE_URL` | set | set | Set twice in GitHub (repo and Production environment); the environment copy wins. Keep them identical or delete the repo copy |
| Sentry | Errors + traces | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | set | - | Request bodies were being attached to events - F11 |
| In-app feedback | Where the feedback box goes | `SLACK_FEEDBACK_WEBHOOK_URL`, `GITHUB_FEEDBACK_TOKEN` | **-** | - | **Feedback currently reaches only the server log.** See F13 before wiring it |
| Founder-only views | AI insights | `FOUNDER_EMAILS` | **-** | - | Route fails closed (403) until set |
| Failure paging | Tells you a workflow failed | `OPS_TELEGRAM_BOT_TOKEN`, `OPS_TELEGRAM_CHAT_ID`, `OPS_SLACK_WEBHOOK_URL` | n/a | set 2026-10-05 | New in this release. Test it any time: Actions -> "Ops alert test" -> Run workflow |
| WhatsApp, Firecrawl, Google AI | Not live | `WHATSAPP_*`, `FIRECRAWL_API_KEY`, `GOOGLE_AI_KEY` | - | - | Correctly dormant |

**Set but read by nothing** (safe to remove): in `.env.local` - `ELEVENLABS_API_KEY`,
`RESEND_API_KEY`, `SLACK_CLIENT_SECRET`, `TELEGRAM_HTTP_API`, `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK`.
These are live credentials for other projects sitting in a repo that does not use them. On Vercel -
`KV_URL`, `REDIS_URL`, `KV_REST_API_READ_ONLY_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
`SENTRY_PUBLIC_KEY`, `SENTRY_OTLP_TRACES_URL`, `SENTRY_VERCEL_LOG_DRAIN_URL` (injected by the
marketplace integrations; harmless, leave them).

**Read by code but missing from `.env.example`** (now added): `AI_INCLUDED_EMAILS`,
`COMMUNITY_KEY_SECRET`, `EW_REAL_UNIVERSE`, `EW_UNIVERSE_LIMIT`, `EW_MARKETS`, `SEC_USER_AGENT`,
`USASPENDING_USER_AGENT`, `SUPABASE_POOLER_URL`. Removed as dead: `SCAN_INTERVAL`.

## Findings

Severity: **P0** = was costing data, money, uptime or trust. **P1** = real defect or meaningful
waste. **P2** = hardening.

### Outages and silence

**F1 (P0, fixed) - The scanner exhausted the database's egress quota and took production down.**
Evidence: scanner run log, 2026-09-26 - `postgrest.exceptions.APIError ... 402 ... "Service for this
project is restricted due to the following violations: exceed_egress_quota"`. Production query:
`stock_candles` had 177,560 live rows and **296,071,147 row updates**; the average run saved
120,677 candle rows.
Cause: every run re-upserted the whole 180-day history for every ticker, and PostgREST returns
every written row unless told not to. That echo was ~40 MB of JSON a run, 48 runs a day. The
"all workers mostly write, so egress is negligible" assumption in `DATA-ECONOMICS.md` was false.
Fix: `workers/stock_scanner/candle_persistence.py` - write only the bars since the last scan (the
full history once per trading day, to pick up split and dividend adjustments), and every write
whose response is unused sends `return=minimal`. Pinned at the wire by tests that run a real
PostgREST client against a recording transport.

**F2 (P0, fixed) - CI red on 59 consecutive pushes.** Evidence: run history; log -
`TypeError: webidl.util.markAsUncloneable is not a function`. Cause: CI ran Node 20; the lockfile
had moved to packages that need 22+ (jsdom 30, undici 8, supabase-js 2.110). Every DOM test crashed
at worker start. Production runs Node 24. Fix: CI on Node 24; `engines` narrowed to
`^22.22.2 || ^24.15.0` (it was `>=20.0.0`, which also let Vercel jump a Node major unannounced -
its own build log warned about that on every deploy).

**F3 (P0, fixed in workflow; needs migrations) - Nightly red 59 nights running.** Evidence: run
log - `MISSING TABLES (3): emerging_winner_outcomes, emerging_winner_predictions,
emerging_winner_runs`. Migrations 056 and 057 were never applied.

**F4 (P0, fixed) - No failure alert was ever delivered.** Evidence: every "Notify on failure" step
log shows `TELEGRAM_BOT_TOKEN:` / `SLACK_WEBHOOK:` empty. GitHub held five secrets; none was an
alert channel. Fix: one shared action, its own `OPS_*` secrets (so wiring alerts cannot change what
the scanner sends), and a visible warning on the run when no channel is configured.

**F5 (P0, fixed) - The cron keepalive never worked.** Evidence: `gh: Resource not accessible by
integration (HTTP 403)` on every run, hidden by `|| true`. The default token cannot enable a
workflow without `actions: write`. The repository is public and was last pushed 2026-09-08, so all
four crons were due to auto-disable around 2026-11-07. Fix: the permission, in one shared action
that revives every scheduled workflow (the monthly model-eval job had no keepalive at all).

**F6 (P1, fixed) - A red gate hid the next red.** `check:data-economics` was skipped whenever the
drift check failed (every night since July), and when run it exited at the first mismatch before
measuring anything. It now runs regardless and reports everything. First honest output: 288 MB,
four tables over budget.

### Speed and correctness

**F7 (P0, fixed) - Functions ran in Washington; the data is in Sydney.** Evidence: live header
`x-vercel-id: syd1::iad1::...`; pooler host `aws-1-ap-southeast-2`; Redis resolves to Sydney
addresses. `/api/health` took 1.3-1.7 s from Sydney. Fix: `vercel.json` `"regions": ["syd1"]`.

**F8 (P0, fixed) - The dashboard's signal query scanned the whole table, and dropped tickers.**
Evidence: `EXPLAIN ANALYZE` in production - sequential scan of `stock_signals` (69 MB), 1,560 ms,
on every page that draws the shell; and `count(distinct symbol)` in the 80 rows returned = 80 while
99 symbols had a signal at that candle. One held-or-watched symbol was among the 19 dropped.
Fix: one request that asks per ticker through the existing `(symbol, timeframe, candle_time desc)`
index - measured 3.15 ms. Also: the alert read now uses its index, and "latest run" means the
scanner's run (the digest job logs to the same table and was briefly "the latest scan").

**F15 (P1, fixed) - Public track record built from 1,000 of 1,587 outcomes.** Evidence: live
`/api/track-record` returned `totalOutcomes: 1000`; the table holds 1,587. PostgREST caps a
response at 1,000 rows whatever the limit asks for, silently. Fix: page through every row; never
publish a partial aggregate.

**F16 (P1, fixed - a regression from v0.131.0) - Every static page had become dynamic.** Evidence:
`/privacy` at v0.130.0 answered `x-nextjs-prerender: 1, x-vercel-cache: HIT` from the Sydney edge;
at v0.131.0 it answered `no-store, MISS` from a function. Cause: the Simple view change read a
cookie in the root layout, which wraps every route. Fix: the read moved into a server wrapper
around the app shell; `npm run check:static-routes` now fails CI if a public page stops being
static.

### Security

**F9 (P0, fixed in code; structural fix = migration 058) - An account could grant itself the
hosted AI key.** Evidence: production `pg_policies` + `has_column_privilege` - a user can update
any column of their own `profiles` row, including `ai_included`; the only guard trigger watched
`role`. Zero rows were granted, so it was never used. Fix: entitlement is decided from the verified
session and the server's own allowlist; the column is no longer read.

**F10 (P0, fixed in code; structural fix = migration 058) - An account could publish a forged "AI
scout" card.** Evidence: the insert policy on `community_ideas` checked only the author. Zero
forged rows exist. Fix: a scout card must be authorless (worker-written) to be listed or sent to
the model; a bring-your-own-key generation is never cached as "Lyra's read" for everyone.

**F17 (P0, fixed) - An anonymous caller could fill the database through the AI audit log.**
Evidence: `resolveAiCredentials` trusted client `provider` and `model` strings; any non-empty
"key" plus a ~31 KB model name plus an injection-flagged message produced a service-role insert,
30 times a minute per address. `ai_runs` holds one row, so it was never used. Fix: provider must be
one of the five supported; model must look like a model id (96 characters); the writer clamps both.

**F11 (P1, fixed) - Request bodies were being sent to Sentry.** Evidence: installed SDK default
`maxRequestBodySize = "medium"`, no `beforeSend` in the config. AI request bodies carry the user's
own provider key and their conversation. Fix: bodies, cookies and credential headers are stripped
in `beforeSend` for errors and traces.

**F13 (P1, fixed) - Feedback would publish the sender's email.** The GitHub sink wrote the email
into the issue body and its default target was this repository, which is public. Not live (no sink
is configured), but one env var from live. Fix: the email goes to the private Slack sink only;
mentions are neutralised; a daily cap; the default target is blank.

Checked and sound: the dispatch secret (constant-time, fails closed when unset), the Telegram
webhook (same, plus replay-safe replies), the WhatsApp webhook (HMAC over the raw body), account
deletion and export (session id only), anonymous community posting (HMAC-signed key), no user
input in any PostgREST filter string, no server AI key reachable without a session.

### Settings

**F12 (P1, needs you) - Nobody can use the hosted AI, including you.** Evidence: the four accounts
are 113, 112, 111 and 54 days old (the trial is 14); `AI_INCLUDED_EMAILS` is not set on Vercel; no
profile holds a grant; `ai_runs` has one row in total. The copilot, brief narration, signal
explanations and scout reads have been answering "no key" for months. Fix: set `AI_INCLUDED_EMAILS`
to your account email on Vercel production.

**F14 (P1, partly fixed, UNVERIFIED in part) - The Finnhub workers have never run live.**
Fixed and tested: calls are now paced under the free tier's 60 a minute (the news worker made 100+
back to back and would have lost about the last third of the universe to rate limiting every
night); a refusal is an error rather than "no news"; the key is kept out of logs; a live provider
that learns nothing now fails the run instead of reporting success.
UNVERIFIED: the fundamentals worker calls `/company-basic-financials` and reads fields such as
`marketCapitalization` and `peRatio` from `series.annual`. I believe that path is the name of
Finnhub's documentation page rather than an endpoint (the endpoint is `/stock/metric`) and that
those field names are not the ones it returns - but Finnhub answers 401 to every path without a
key, including nonsense ones, so this cannot be confirmed without a live call. Expect the first
live night to go red on fundamentals; it will now say so.

**F18 (P1, fixed) - Solo was a release behind.** Evidence: `solo.lyra.vivacityai.com.au` served
v0.130.0 while production served v0.131.0. The project stopped auto-deploying on 2026-08-22 and
nothing replaced the Solo step. Fix: `npm run deploy:solo`, which also proves the result is in
Solo mode.

**F19 (P1, fixed) - Emerging Winners would have written fiction to a permanent record.** The
nightly worker scored three invented tickers (invented contracts, invented insider buys) and tried
to append them to an append-only ledger that the app reads back as live output. Only the missing
migration stopped it. Fix: illustrative candidates are never persisted.

**F21 (P1, fixed going forward; existing rows left for you) - Half the model attempt ledger is
test noise.** Evidence: `lyra-evals/model-attempt-log.jsonl` has 56 committed lines; 27 carry
paths under a pytest temp directory - fake retrains, refused promotions and one forced promotion
written by the unit tests. The ledger exists to keep the trial count honest, and every local test
run was adding to it. Fix: `tests/conftest.py` redirects the ledger for every test; a full run now
leaves the file untouched. The 27 existing lines are not removed - it is an audit trail, so that
edit is yours to make.

**F22 (P2, open) - A committed npm script points at a file that is not in the repository.**
`package.json` has `check:model-registry` -> `scripts/check-model-registry.mjs`; the script, the
registry it checks and the CI step that calls it have been sitting uncommitted in the working tree
since 2026-08-03 (another session's unfinished work, left untouched here). On any other clone
`npm run check:model-registry` fails with "module not found".

**F20 (P2, fixed) - Smaller items.** Actions three majors behind and running on a deprecated
runtime (now v7, with Dependabot for actions only); Python pinned in five places and already
drifted (now one); the RBA alert cron was an hour late for part of April and October and would
have alerted early under the obvious "fix" (now gated on Sydney time); the market-hours guard,
if enabled, never scored the closing bar until the next morning (window extended); every Upstash
call now has a deadline; the Sentry token file was being uploaded with each deploy.

## The release that fixed these broke something - recorded, not buried

**F23 (P0, caused by v0.132.0, fixed in v0.132.1 about 30 minutes later) - the dashboard served
the sample dataset to every user.** F8 replaced `select('*')` with named columns, and the names
were taken from a TypeScript type. Five of them (`rsi_summary`, `macd_summary`, `volume_summary`,
`trend_summary`, `price_summary`) had never existed as columns - `select('*')` had simply returned
them as undefined. Naming them made PostgREST refuse the whole read, the fallback read named the
same columns, and the loader did what it does on any failed read: returned the demo book under a
DEMO badge (open item O6, demonstrated on the day it was written down).

It shipped through type-check, lint, 1,222 unit tests, a production build and a clean deploy
health probe, because none of those knows what columns a table has, and the health probe does not
look at whether the data is live. It was caught by loading a real page and reading what it
rendered - not by any gate.

What changed so it cannot recur:
- `npm run check:app-columns` - every column the app names must exist in the schema. Runs in CI
  against a database built from the migrations, and nightly against production. Proven to fail on
  exactly this bug.
- The named columns live in one file (`src/lib/dashboard-columns.json`) that the gate reads.

What it does not yet cover: the deploy health probe still passes while the app is serving demo
data. A probe that asserts the live site is in live mode AND rendering live rows is the missing
piece (it belongs with O6).

## Open - not fixed in this release

Logged with evidence for a next wave. None is exploitable without an account.

| # | Item | Why it is open |
|---|---|---|
| O1 | Hosted AI has no per-user daily ceiling, and is charged before deterministic short-circuits. One trial account can exhaust the shared day budget in ~14 minutes | Needs a product decision on the per-user number |
| O2 | The AI circuit breaker is shared by hosted and bring-your-own-key traffic: five bad BYOK keys open it for hosted users | Small change, but it alters a tested contract |
| O3 | `/api/findings/lifecycle` is an authenticated write with no rate limit or length caps | Low risk, needs limits |
| O4 | `/api/ai/metrics` and `/ai-ops` read an in-memory store production never writes to, so they always report zero runs | Needs a read from `ai_runs` behind the founder check |
| O5 | No `maxDuration` on the LLM routes; a timed-out attempt is retried while the first is still running | Functional today (the platform default is 300 s); needs the retry policy aligned first |
| O6 | When a live read fails the app falls back to the demo book under a DEMO badge - which is what every signed-in user saw during the four-day outage | Needs a real "data unavailable" state |
| O7 | The scanner runs around the clock: 84% of weekday runs and all weekend runs re-derive the same bars | Cheap now (F1), but still ~3,300 needless Yahoo calls a day. Blocked only on making the freshness badge market-aware - user-added tickers are never scanned, so nothing else depends on off-hours runs |
| O8 | `requirements.txt` floats within majors on every scheduled run | Deliberate for yfinance (patch releases usually fix Yahoo breakage); a lockfile would trade that away |
| O9 | The CSP is report-only with nowhere to report to, so it can never graduate to enforcing | Needs a report endpoint |
| O10 | Several anonymous GETs (`scout/feed`, `track-record`, `emerging-winners`) do uncached work per request; `small-caps/research` has no caller | Add `s-maxage`, delete the dead route |
| O11 | No branch protection on `main`: nothing blocks a push on a red check | Fits the direct-push flow; the new failure page is the mitigation |
