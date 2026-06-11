# Production hardening (Phase 9)

What's protected in code vs what still needs infrastructure. Lyra is research software,
not a broker — it never holds funds or places trades, which keeps the blast radius small.

## Done in code (this repo)

- **Auth + RLS everywhere.** Every user-private table has owner-only Row Level Security
  (`auth.uid() = user_id`). A signed-in user can only ever read/write their own portfolio,
  watchlist, alerts, settings, snapshots. Global market data is read-only to anon/auth.
- **Service role is server-only.** The service key is never in `NEXT_PUBLIC_*` or the
  browser bundle. Public write routes (`/api/portfolio`, `/api/watchlist`, `/api/account`,
  `/api/onboarding`) use the cookie-aware client and require a signed-in user (401 otherwise),
  stamping `user_id = auth.uid()`.
- **Secrets hygiene.** `.gitignore` excludes all `.env*`. Telegram bot token + market-data
  keys live only in the worker environment; the frontend never sees them. The user's BYO AI
  key (if entered) stays in their browser.
- **Security headers.** `next.config.js` sets X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, and HSTS on every route.
- **Legal disclaimer** surfaced in the app shell footer ("research only — not financial
  advice"). Required before public signups.
- **Input validation** on all write routes (numeric ranges, required fields, symbol
  normalisation).
- **Local PIN lock** option with hashed (never plaintext) PIN + reset escape.

## Needs infrastructure (provisioning — not code)

1. **Rate limiting.** The write routes are auth-gated + RLS-scoped (a user can only touch
   their own rows), so abuse surface is limited, but for DoS protection add a distributed
   limiter — recommended: Upstash Redis + `@upstash/ratelimit` on the API routes and the
   auth pages. (Supabase Auth already rate-limits sign-in/sign-up server-side.)
2. **Monitoring + error tracking.** Add Sentry (frontend + worker) for runtime errors and
   the worker's scan failures. Wire alerts on `stock_scanner_runs.status = 'error'`.
3. **Backups + retention.** Enable Supabase PITR/backups. Define a retention policy for
   `stock_candles` / `stock_indicators` (they grow fast) and for `analytics_events` if added.
4. **CSP.** A strict Content-Security-Policy header is deferred because the app loads the
   TradingView embed + cdnjs (Three.js). Add a CSP that allowlists those origins once the
   external-script set is final.
5. **Australian Privacy Act / data requests.** Provide a privacy policy + a data
   export/delete path (RLS makes per-user delete a cascade on `profiles` delete).
6. **Dependency scanning.** Enable Dependabot / `npm audit` in CI.

## CI gates to add (Phase 7 follow-on)

- type-check + lint + `vitest run` + worker `pytest` on every push.
- `next build` in CI (the real compile — can't run in the dev sandbox).
