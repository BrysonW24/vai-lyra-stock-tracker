# Multi-user go-live checklist

Lyra now ships with a full multi-user spine: a canonical Supabase schema, Row Level
Security, Supabase Auth wiring, user-scoped data reads, and a user-aware worker. Demo
mode still works with zero backend. This is the follow-the-steps guide to flip it from
demo to a real multi-tenant platform.

**Design principle:** global market data is shared (one copy of AMD/NVDA candles,
indicators and signals serves everyone); user decisions and preferences are private
(each operator's portfolio, watchlist, alerts, onboarding live behind RLS).

---

## What's already built (in this repo)

- **DB migrations** — `supabase/migrations/001_*.sql` … `017_profile_bootstrap.sql`.
  Idempotent; safe on a fresh DB or on top of the legacy `sql/` schema. Includes
  identity, onboarding, universe, market data, signals, portfolio, watchlist, alerts,
  snapshots, simulations, education, jobs, future-intelligence tables, **RLS policies**,
  seed data, and a **signup → profile bootstrap trigger**.
- **Frontend auth** — `src/lib/supabase/{client,server,admin}.ts`, `src/middleware.ts`
  (session refresh), `src/app/auth/{login,signup,callback,signout}`. Degrades to demo
  mode when Supabase env is absent.
- **User-scoped reads** — `src/lib/data.ts` uses the cookie-aware server client; RLS +
  explicit `user_id` filters scope portfolio/watchlist to the signed-in user, with
  per-field demo fallback.
- **User-aware worker** — overlay models carry an optional `user_id`; `DEFAULT_USER_ID`
  stamps it in single-operator mode. 149 worker tests pass.

---

## Step 1 — Create the Supabase project

1. Create a project at supabase.com. Note the **Project URL**, **anon/publishable key**,
   and **service role key** (Settings → API).
2. **Never** put the service role key in any `NEXT_PUBLIC_*` var or the browser.

## Step 2 — Apply the schema

Using the Supabase CLI (recommended):

```bash
supabase link --project-ref <your-ref>
supabase db push          # applies supabase/migrations/*.sql in order
```

Or paste each `supabase/migrations/00X_*.sql` into the SQL editor in filename order.
The migrations are idempotent, so re-running is safe.

Verify: `profiles`, `portfolio_positions`, `watchlist_items`, `stock_signals` exist and
RLS is **on** for the private tables (Database → Tables → shield icon).

## Step 3 — Configure Auth

1. Authentication → Providers → enable **Email** (and any OAuth you want).
2. Authentication → URL Configuration → add your site URL + `…/auth/callback` as a
   redirect URL.
3. The `on_auth_user_created` trigger (migration 017) auto-creates the
   profile/settings/onboarding/operator/alert-preference rows on signup — nothing else
   to wire.

## Step 4 — Frontend env

In Vercel (or `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

That's all the frontend needs. With these set, `/auth/login` and `/auth/signup` go live
and the dashboard scopes to the signed-in user. Without them, the app stays in demo mode.

## Step 5 — Worker env + seeding

Worker environment (server/cron only — never in the browser bundle):

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>     # bypasses RLS to write global + overlay data
MARKET_DATA_PROVIDER=finnhub                      # or yfinance
DEFAULT_USER_ID=<your profiles.id>                # single-operator: stamps overlays to you
TELEGRAM_BOT_TOKEN=<bot token>                    # optional, for alert delivery
```

Seed the ticker universe (the worker's universe loader upserts `stock_tickers`;
`016_seed_initial_data.sql` seeds the universe groups + education placeholders).

Run a scan: `npm run worker:scan`. Confirm rows land in `stock_candles`,
`stock_indicators`, `stock_signals`, and `stock_scanner_runs`.

## Step 6 — Add your data, verify isolation

1. Sign up at `/auth/signup`, confirm email, sign in.
2. Add a position/watchlist item (or insert into `portfolio_positions` with your
   `user_id`). Re-run the worker so `DEFAULT_USER_ID` writes your overlays.
3. The Command Centre now shows **your** portfolio + watchlist, scoped by RLS.
4. **Isolation test:** create a second user; confirm they cannot see user one's
   portfolio/watchlist/alerts (RLS returns zero rows).

## Step 7 — Deploy

- Deploy the Next.js app to Vercel with the two `NEXT_PUBLIC_*` vars.
- Run the worker on a schedule (the repo's GitHub Actions hourly workflow, or any cron),
  with the worker env above.

---

## Remaining backend work (clearly scoped, needs the live DB to validate)

1. **Full per-user overlay loop in the worker.** Today the worker computes global signals
   once (correct) and stamps overlays with a single `DEFAULT_USER_ID`. The multi-user
   target (spec §21) is: after global signals, load all active users, and build one set of
   portfolio/watchlist overlays per user from the shared signals. The model + schema
   already support `user_id`; this is the loop in `main.py` to generalise.
2. **Per-user alert evaluation + delivery.** Read each user's `user_alert_preferences` /
   `ticker_alert_preferences` / `notification_channels` (Telegram chat_id) and gate alerts
   per user. `stock_alerts` already has `user_id`.
3. **Realtime** (optional) — subscribe the client to the user's `stock_alerts` and
   overlay rows (spec §24) instead of polling.
4. **Frontend write paths** — portfolio/watchlist add/edit currently read live but write
   via the existing API routes; point those at the user-scoped Supabase client so inserts
   carry `auth.uid()`.

None of these block go-live for a single operator; they're the multi-tenant scale-out.

---

## Safety invariants (do not break)

- Service role key is server-only. Frontend uses anon key + RLS.
- Every user-private table has `user_id` and owner-only RLS policies.
- Global market tables are read-only to anon/authenticated; only the worker (service
  role) writes them.
- Demo mode must keep working with no Supabase env set.
