# lyra-cyber - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
Security posture for Lyra: the auth/session gate in middleware, the executable RLS tenant-fence, the
role-escalation guard, SSRF fences on user-supplied webhook/push URLs, secret handling (service-role
server-only, BYOK browser-local), and the prompt-injection trust boundary. Maps to gap-to-95 vertical
V8 (Auth, Accounts & Middleware), the estate's highest-scoring vertical (94/100).

## Lyra as it is today
The security spine is real code, not documentation. Four load-bearing controls are on disk and wired:

- **Session gate** - `src/middleware.ts:43-140` runs on every non-static route (`:142-146` matcher).
  When Supabase is configured it resolves the session (`:96`) and redirects signed-out visitors to
  `/welcome` (`:105-116`), then enforces mandatory onboarding by trusting `user_metadata.onboarded`
  (`:134-137`). When Supabase is unset it degrades to open demo mode with a cookie-based onboarding
  gate `lyra_onboarded` (`:46-71`). Public prefixes are explicit (`:29`) and `/api` is always let
  through (`:39`) because API routes enforce their own auth.
- **Executable RLS tenant-fence** - `scripts/rls-tenant-fence.sql:1-119` is a negative assertion: it
  seeds two users, then under user A's `authenticated` JWT (`:69-70`) asserts A sees exactly one own
  row and zero of user B's rows across `portfolio_positions`, `watchlist_items` and `paper_trades`,
  raising `RLS FENCE BREACH` (`:85`, `:90`, `:96`, `:100`, `:107`, `:111`) if a policy regresses to
  permissive. It is invoked by `scripts/migrate-from-zero.sh:70-71` inside the CI `migrations-from-zero`
  job against `postgres:16` (`.github/workflows/ci.yml:93-113`, `ON_ERROR_STOP=1`), so a re-introduced
  `using(true)` SELECT leak fails CI.
- **Role-escalation guard (047)** - `supabase/migrations/047_role_escalation_guard.sql:16-45` installs a
  `before update of role` trigger that raises `42501` (`:33`) unless the JWT role is `service_role`,
  closing the "any user PATCHes their own `profiles.role` to `maintainer` and rewrites every community
  idea" chain the comment documents (`:4-10`).
- **Prompt-injection trust boundary** - `src/lib/ai/guardrails/injection.ts:26-103` treats all external
  content as data: 14 injection patterns (`:26-50`) plus fence-spoof neutralisation (`:78-85`), wrapped
  in untrusted-data fence markers. It is wired into `api/ai/agent`, `api/ai/chat`, `api/ai/brief`,
  `api/community/ideas/brief` and `smart-money-live.ts`, and tested (`src/lib/ai/__tests__/guardrails.test.ts:128-154`).

Row-level security itself is applied by `015_rls_policies.sql`: owner-only CRUD (`auth.uid() = user_id`)
across ~19 user-private tables including `operator_profiles`, `user_settings`, `portfolio_positions`,
`watchlist_items` (`:19-45`), and read-only anon+authenticated on the shared market tables (`:47-65`).

## How it works
Middleware is fail-safe by design: a `getUser()` failure at the edge is caught (`:98-103`) so an auth
blip degrades a page to signed-out rather than 500-ing the whole site (the 0.55.0 fix). Reads for the
read-only demo tour ride the anon key's read-only RLS via a `lyra_demo` cookie (`:106-111`), which is
shed on the first authenticated request (`:125-127`) so a new user is not trapped in a re-onboarding
loop. Secret handling follows one rule (`SECURITY.md:7-11`): the service-role key bypasses RLS and is
confined to `src/lib/supabase/admin.ts:8-15` (returns null unless `SUPABASE_SERVICE_ROLE_KEY` is set,
never `NEXT_PUBLIC_*`). AI credentials resolve server-side (`src/lib/ai/credentials.ts:56-101`): a
user's own BYOK key always wins and lives only in this browser's localStorage (`src/lib/account.ts:56-59`,
key `lyra.account.ai` at `:93`); the hosted OpenAI / shared Google key is handed out only to an
authenticated AND `aiIncluded` caller (`:70-98`) with the model server-pinned, closing the anonymous
"burn Lyra's key" financial-DoS hole. SSRF fences validate every user-supplied URL against an allowlist
before a save or send: Slack to `hooks.slack.com/services/` only (`slack.ts:46-51`), Web Push to known
push-service hosts over https only (`push/server.ts:51-60`). Inbound webhook and dispatch secrets use
constant-time comparison (`api/notifications/dispatch/route.ts:24-29`, `webhooks/telegram/route.ts:38-42`,
`whatsapp-signature.ts:45`).

## Strengths (verified)
- The tenant fence is genuinely executable, not aspirational - it RAISEs and fails CI on a permissive
  regression (`rls-tenant-fence.sql:85`; wired at `ci.yml:113`). This is the estate's strongest security
  proof and the reason V8 lost its old -2.
- Middleware cannot take the site down: every auth-resolution failure fails safe (`middleware.ts:98-103`),
  with no `getUser()` throw reaching the user as a 500.
- Service-role isolation is enforced structurally - one server-only factory (`admin.ts:3-6` doc + guard),
  never exposed to the bundle; BYOK keys never leave the browser (`account.ts:56-59`).
- SSRF fences are allowlist-based and pinned by tests, including near-miss payloads
  (`slack.test.ts:26-31` rejects `hooks.slack.com.evil.com`, `http://`, `/other/`; push endpoint
  allowlist rejects `169.254.169.254` / loopback).
- The injection fence is wired into every route that admits external text, not just defined - and it
  neutralises spoofed fence markers so content cannot fake its own fencing (`injection.ts:78-85`).
- Secret comparisons are timing-safe everywhere they gate a webhook or dispatch (three routes, all via
  `node:crypto timingSafeEqual`).

## Gaps, risks, what is missing
- **[V8.1, resilience, M] The 047 role-escalation guard has no executing negative test.** Confirmed on
  disk: `rls-tenant-fence.sql` asserts only SELECT isolation and never attempts a role UPDATE (no
  write-side `update ... set role` anywhere in the fence). The `42501`-on-self-promotion logic
  (`047:32-35`) is reasoned in SQL only - the write-side of the exact hole class this repo has shipped.
  Fix: extend the already-wired fence do-block to `update profiles set role='maintainer'` as user A and
  RAISE if `42501` does not fire (free infra, reuses the CI job).
- **[V8.3, coverage, S] The executable fence omits `operator_profiles` and `user_settings`.** Confirmed
  not present in `rls-tenant-fence.sql` - both are owner-only in `015` (`:22-23`) but carry no runtime
  proof, so a regression to `using(true)` on either (the AI-grounding operator context) would pass the
  fence green. Fix: seed one row per user in each and add own-count=1 / other-count=0 assertions under
  user A's JWT.
- **[V8.2 / V7.1, correctness+coverage, S] The `onboarded` metadata writer is inline and untested, and
  is written before saves confirm.** `middleware.ts:134-137` trusts `user_metadata.onboarded` to
  release the mandatory gate, but the onboarding flow (per the gap-to-95 audit, `onboarding/page.tsx:270-286`)
  writes `onboarded=true` before the watchlist/portfolio saves succeed - a 401-then-abandon leaves a
  user past the gate with an empty book. This is the highest-value single fix in the estate (effort S,
  +3). Fix: move `updateUser({onboarded:true})` to run only after the save-success check.
- **[V6.1, coverage, M] Inbound webhook parsers are security-relevant untrusted-input handlers with zero
  tests** - `parseInboundCommand`, telegram `parseMessage`/token-bucket, and their `secretMatches`
  checks (gap-to-95 V6). The secret comparisons are timing-safe but the surrounding grammar/rate-limit
  logic is unpinned.
- **[V5.4, correctness, M] The AI fabrication guard is still value-based for bare numerals**
  (`guardrails/schema.ts:122-124` per the gap-to-95 audit) - defense-in-depth, not a live decision-path
  leak; the dangerous %/x/$ case is closed.
- Middleware enforces auth per-route on the API surface (`:39` lets `/api` through by design); there is
  no central API auth chokepoint, so each of the ~22 routes that return 401 owns its own gate. Correct
  and intentional, but worth noting as a review surface - a new route that forgets its check is not
  caught by middleware.

Nothing here is greenfield. The `lyra-cyber/` folder itself is a stub home (only `README.md`); the
security controls all live in `src/`, `supabase/migrations/`, `scripts/` and CI.

## Where to find it
- Session gate: `src/middleware.ts` (demo `:46-71`; fail-safe `:83-103`; onboarding gate `:134-137`).
- RLS: `supabase/migrations/015_rls_policies.sql`, `030_rls_scanner_tables.sql`,
  `032_fix_cross_user_read_leak.sql`, `047_role_escalation_guard.sql`.
- Executable fence: `scripts/rls-tenant-fence.sql`; runner `scripts/migrate-from-zero.sh:70-71`;
  CI job `.github/workflows/ci.yml:93-113`.
- SSRF fences: `src/lib/notifications/slack.ts:46-51` (+ `__tests__/slack.test.ts`),
  `src/lib/push/server.ts:51-60` (+ `__tests__/endpoint-allowlist.test.ts`).
- Secrets: `SECURITY.md`, `src/lib/supabase/admin.ts`, `src/lib/ai/credentials.ts`,
  `src/lib/account.ts:56-59,93`; timing-safe checks in `api/notifications/dispatch/route.ts`,
  `api/webhooks/telegram/route.ts`, `src/lib/notifications/whatsapp-signature.ts`.
- Prompt-injection: `src/lib/ai/guardrails/injection.ts` (+ `src/lib/ai/__tests__/guardrails.test.ts`).
- Skill chain: `.claude/commands/security-sweep.md`.
- Audit reference: `lyra-audits/2026-07-29-gap-to-95-audit.md` V8 (and V5/V6/V7 for cross-cutting items).

## Posture
Strong and wired - the read-side tenant fence is executably proven in CI; the residual gaps are the
still-untested write-side (047 role UPDATE) and the `operator_profiles`/`user_settings` fence blind
spots, plus the onboarded-ordering correctness fix.
