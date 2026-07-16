# /security-sweep - audit secrets, fences, authz and abuse surfaces

You are Claude Code running in the Lyra repo. Run the security loop: secrets discipline,
network fences, authorization posture, abuse limits, and dependency health - then fix
findings at the root. This chain owns `src/lib/auth/`, `src/lib/env.ts`,
`src/lib/ratelimit.ts`, `src/lib/account.ts`, `src/app/api/account/`, `src/middleware.ts`,
`SECURITY.md`, `PRIVACY.md`, and `docs/security/`. Baseline doctrine lives in
`SECURITY.md` - keep it true, not aspirational.

## The fixed checklist (run ALL of it, in order)

### 1. Secrets discipline

- No secret in a `NEXT_PUBLIC_*` var; `SUPABASE_SERVICE_ROLE_KEY` referenced only in
  server/worker code (`src/lib/supabase/admin.ts`, workers). Grep to prove it.
- BYOK AI keys: never logged, never persisted server-side (`credentials.ts`).
- Webhook URLs (Slack) are user secrets: SSRF-fenced to hooks.slack.com, redacted in logs.
- `.env.local` gitignored; no key material in git history for files touched this session.
- Secret comparisons are timing-safe (see `secretMatches()` in the dispatch route - the
  pattern for every new secret check).

### 2. Authorization posture (fail-closed is the house rule)

- Founder surfaces (`/api/ai/insights`, `/ai-ops` data): `FOUNDER_EMAILS` unset =>
  CLOSED, never open.
- Configured deploys: user-scoped routes require a session
  (`requireSessionWhenConfigured` pattern); demo mode stays open by design.
- Service-secret routes (notification dispatch): unset secret => 401 for everyone.
- RLS is the second wall, owned by `/data-integrity` - but any authz finding there is
  also a finding here.

### 3. Abuse + injection surfaces

- Open POST routes carry a rate limit (`ratelimit.ts` - ticker-lookup 30/min, feedback
  5/min are the pattern). A new open route without one is a finding.
- Prompt injection: the guardrails engine gates AI inputs/outputs (owned by
  `/ai-quality`); verify no NEW AI surface bypasses it.
- Redirect safety: any user-supplied path goes through `safe-redirect.ts`.

### 4. Dependencies + platform

- `npm audit --omit=dev` and a scan of Python worker pins in `requirements.txt` - triage
  criticals honestly (fix, or file with a reason), never silence.
- Headers/middleware: confirm `src/middleware.ts` changes have not widened access
  (demo cookie paths are intentionally open; everything else follows the auth rules).

## Fix and ship

1. Fix root causes; every fix gets a test where the harness exists (route-handler tests
   in `src/app/api/**/__tests__/` are the pattern).
2. `npm run type-check && npm run test && npm run worker:test && npm run build`.
3. Version bump via `RELEASES`, `npm run release`, commit, push, `npm run announce`.
4. Update `SECURITY.md` if the posture changed - it is the public claim.

**Done means:** every checklist section reports pass/finding/fixed with evidence (the
grep, the probe, the test), dependencies triaged, `SECURITY.md` current, shipped under a
version. Explainability: findings are stated as attack -> impact -> fix, so a
non-security reader understands why each change happened.
