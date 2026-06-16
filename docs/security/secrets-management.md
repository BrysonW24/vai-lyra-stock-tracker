# Secrets management

> **Purpose:** Inventory every variable in `.env.example`, classify its exposure, state where it lives and how to rotate it, and pin the NEXT_PUBLIC_ rule. | **Audience:** Operators deploying Lyra; engineers adding any new env var. | **Status:** Active | **Owner:** Bryson Walter | **Last updated:** 2026-06-11

## The NEXT_PUBLIC_ rule (non-negotiable)

Anything prefixed `NEXT_PUBLIC_` is compiled into the browser bundle and is visible to everyone, forever, in every deployed build. Therefore:

- Only values that are safe to publish may carry the prefix. In Lyra that is the app URL, the demo-fallback toggle, and the Supabase URL + anon key - and the anon key is only safe because **RLS is the real gate** (see [`architecture.md`](./architecture.md)).
- `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `GOOGLE_AI_KEY`, `ANTHROPIC_API_KEY`, `FINNHUB_API_KEY`, every `WHATSAPP_*` credential, and `TELEGRAM_WEBHOOK_SECRET` must only ever be unprefixed server/worker variables (`SECURITY.md` golden rules).
- `src/lib/env.ts` (Zod-validated, importable by frontend code) deliberately contains ONLY the two public Supabase vars. Server secrets are read at call time inside server-only modules (`src/lib/supabase/admin.ts`, `src/lib/notifications/telegram.ts`, `src/lib/notifications/whatsapp.ts` - the latter notes its env read is "intentionally NOT in src/lib/env.ts").
- Audit before release: `grep -rn "NEXT_PUBLIC" src/ | grep -iv "supabase_url\|anon_key\|app_url\|demo_fallback"` should return nothing surprising.

## Exposure classes

| Class | Meaning |
|---|---|
| `public` | Ships to the browser by design; not a secret |
| `secret-critical` | Compromise bypasses tenancy or grants provider control; rotate immediately on any suspicion |
| `secret` | Compromise enables abuse or cost but not tenancy bypass |
| `identifier` | Not secret, but treat as internal config (no need to publish) |
| `config` | Plain behaviour toggle / tuning value |

## Inventory - every variable in `.env.example`

| Variable | Purpose | Where used | Exposure class | Rotation |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Canonical app URL | Frontend | public | n/a |
| `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK` | Show demo data when Supabase unset | Frontend (`src/lib/demo-data.ts` consumers) | public | n/a |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser + server clients (`src/lib/supabase/*`), `src/middleware.ts` | public | Changes only if the project moves |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | RLS-enforced read/write as the signed-in user | Browser + server clients, middleware | public (safe only with RLS) | Supabase dashboard > Settings > API > rotate anon key; redeploy frontend |
| `SUPABASE_URL` | Supabase URL for the Python worker | `workers/stock_scanner/` | identifier | With project move |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS for workers + admin routes | `workers/stock_scanner/`, `src/lib/supabase/admin.ts` (server only) | **secret-critical** | Supabase dashboard > rotate service key; update worker env + Actions secrets + deployment env in one pass |
| `DEFAULT_USER_ID` | Single-operator mode: stamps worker-written overlays with your `profiles.id` so they pass RLS | `workers/stock_scanner/config.py` | identifier | n/a (change if the operator account changes) |
| `TELEGRAM_BOT_TOKEN` | Bot API credential for sendMessage | `workers/stock_scanner/telegram.py`, `src/lib/notifications/telegram.ts` | **secret-critical** (can post to any chat the bot is in) | BotFather > `/revoke` issues a new token; update worker + server env; old token dies immediately |
| `TELEGRAM_CHAT_ID` | Legacy single-operator alert destination | Worker | identifier | n/a |
| `MARKET_DATA_PROVIDER` | Provider switch (yfinance default) | Worker (`workers/stock_scanner/market_data.py`) | config | n/a |
| `TICKER_SYMBOLS` | Scan universe override | Worker | config | n/a |
| `DEFAULT_TIMEFRAME` | Bar timeframe | Worker | config | n/a |
| `LOOKBACK_PERIOD_DAYS` | History window | Worker | config | n/a |
| `ALERT_SCORE_THRESHOLD` | Alert trigger score | Worker | config | n/a |
| `WATCHLIST_SCORE_THRESHOLD` | Watchlist trigger score | Worker | config | n/a |
| `SIGNAL_CHANGE_THRESHOLD` | Signal-change alert delta | Worker | config | n/a |
| `ENABLE_TELEGRAM_ALERTS` | Worker outbound alert toggle | Worker | config | n/a - also the fastest notification kill switch (see [`incident-response.md`](./incident-response.md)) |
| `ENABLE_WATCHLIST_ALERTS` | Watchlist alert toggle | Worker | config | n/a |
| `ENABLE_HOURLY_DIGEST` | Hourly digest toggle | Worker | config | n/a |
| `ENABLE_MARKET_HOURS_GUARD` | Skip scans outside market hours | Worker | config | n/a |
| `FORCE_SCAN` | Bypass scheduler guard once | Worker | config | n/a |
| `SCAN_INTERVAL` | Scan cadence label | Worker | config | n/a |
| `FINNHUB_API_KEY` | Live news/fundamentals/earnings (Horizon 2) | Worker | secret | Finnhub dashboard > regenerate key |
| `OPENAI_API_KEY` | Hosted beta AI default for keyless users | Server AI routes via `src/lib/ai/credentials.ts` and `src/lib/ai/gateway.ts` | secret (cost abuse) | OpenAI dashboard > revoke + reissue; update Vercel env |
| `LYRA_HOSTED_OPENAI_MODEL` | Hosted OpenAI model override | Server AI routes | config | n/a |
| `LYRA_OPENAI_REASONING_EFFORT` | Hosted OpenAI reasoning effort | Server AI routes | config | n/a |
| `GOOGLE_AI_KEY` | Optional shared Gemini fallback | Server AI routes | secret (cost abuse) | Google AI Studio > revoke + reissue; update Vercel env |
| `ANTHROPIC_API_KEY` | Server-side AI explanations (optional legacy mode) | Server/worker AI paths | secret (cost abuse) | Anthropic console > revoke + reissue |
| `ENABLE_AI_EXPLANATIONS` | AI explanations master toggle (off by default) | Server/worker | config | n/a - also the AI kill lever |
| `TELEGRAM_WEBHOOK_SECRET` | Authenticity token echoed by Telegram in `X-Telegram-Bot-Api-Secret-Token`; route 401s on mismatch or unset | `src/app/api/webhooks/telegram/route.ts` | secret | Generate (`openssl rand -hex 32`), set env, re-run `setWebhook` with the new `secret_token` - both must change together |
| `WHATSAPP_ACCESS_TOKEN` | Graph API send credential (system-user token) | `src/lib/notifications/whatsapp.ts` (server only) | **secret-critical** | Meta Business > system user > generate new token, revoke old |
| `WHATSAPP_PHONE_NUMBER_ID` | Sending phone number id | `whatsapp.ts` | identifier | n/a |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA id | Reserved (Meta admin) | identifier | n/a |
| `WHATSAPP_APP_SECRET` | HMAC key verifying `X-Hub-Signature-256` on inbound webhooks + `appsecret_proof` on sends | `src/lib/notifications/whatsapp-signature.ts`, `whatsapp.ts` | **secret-critical** | Meta App Dashboard > App settings > Basic > reset app secret; update env immediately (inbound goes 401 until they match) |
| `WHATSAPP_VERIFY_TOKEN` | One-time GET subscription handshake value | `src/app/api/webhooks/whatsapp/route.ts` | secret (low) | Pick a new random string, update env + Meta webhook config together |
| `WHATSAPP_API_VERSION` | Graph API version (default v21.0) | `whatsapp.ts` | config | n/a |

### Not in `.env.example` but in scope

| Secret | Notes |
|---|---|
| BYOK AI provider keys (per user) | Held in the user's browser, sent per-request to AI routes, forwarded by `src/lib/ai/gateway.ts`, **never logged or persisted server-side**. The user rotates them at their provider. |
| Pairing codes | Plaintext shown once in the app; only the sha256 hash would be stored (`channel_pairing_codes.code_hash`, `hashPairingCode` in `src/lib/notifications/telegram.ts`). A leaked table cannot be replayed. |
| GitHub Actions secrets | The hourly scanner workflow needs the worker secrets mirrored as Actions secrets. Treat them as a second copy of the same secrets - rotate both. |

## Storage guidance

**Now (current state):**

- Local dev: `.env.local`, never committed. `.gitignore` covers `.env`, `.env.local`, `.env.*.local`; only `.env.example` (placeholders) is in the repo.
- Deployment: the platform's encrypted env store (Vercel project env vars; GitHub Actions secrets for the worker schedule).
- Per `SECURITY.md`: rotate anything that leaks, immediately, at the provider.

**Future (before any broker credential exists):**

Broker API keys are a different risk class from everything above - they can move money. They must NOT live as plain env vars. Required before the first broker credential is accepted, per `docs/architecture/future-trading-bot.md` gates:

- A managed secret store (e.g. Vault, AWS Secrets Manager, or Supabase Vault) with audit logging and automatic rotation.
- Per-user encryption at rest; the web tier holds a reference, never the credential.
- The `broker` kill switch (`ALL_KILL_SWITCHES` in `src/lib/trading/risk-engine.ts`) wired to credential revocation.

This is a hard gate, not a preference: live execution work cannot start while broker credentials would sit in `.env` files.

## Adding a new env var - checklist

- [ ] Decide the exposure class BEFORE naming it. Secret = unprefixed. Public = justify why it can be world-readable forever.
- [ ] Add to `.env.example` with a placeholder and a comment stating which side (frontend / server / worker) owns it.
- [ ] Read it in the right place: public vars through `src/lib/env.ts`; server secrets at call time in a server-only module - never `process.env` in client components.
- [ ] Never log it. If it can appear in provider errors, add redaction (pattern: `redactBotToken` in `src/lib/notifications/telegram.ts`, `redactSecrets` in `src/lib/notifications/whatsapp.ts`).
- [ ] Confirm fail-closed behaviour when unset (every Lyra secret-gated path today degrades to 401/403/demo mode, not open).
- [ ] Update the inventory table in this doc.

## Leak response

If any secret is committed, pasted, logged, or otherwise exposed: treat it as burned and run the **leaked secret playbook** in [`incident-response.md`](./incident-response.md) - rotate at the provider first, then clean up. Speed beats tidiness.
