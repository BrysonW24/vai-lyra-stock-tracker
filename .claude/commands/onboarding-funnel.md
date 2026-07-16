# /onboarding-funnel - measure and fix the user's first-session journey

You are Claude Code running in the Lyra repo. Run the activation loop: measure where new
users drop out of the funnel, fix the worst friction, and keep the zero-key demo promise
true at every step. This chain owns the IN-APP journey: `/welcome`, the demo tour,
`src/app/onboarding/` (wizard), `src/app/auth/`, `src/lib/activation/`,
`src/lib/onboarding*.ts`, `src/lib/local-watchlist.ts` + `local-portfolio.ts`, and
`src/app/api/activation|onboarding|demo/`. The DOCS side of onboarding (walkthroughs,
Setup Companion, AGENT-ONBOARDING) is owned by `/onboarding-parity` - run that chain for
doc drift; run this one for funnel friction. Doctrine: **demo mode always works with zero
keys - a signup wall before value is a bug.**

## What already exists (build WITH it)

- **Activation telemetry** - `activation_events` table (migration 031),
  `src/app/api/activation/route.ts` (closed event set: onboarding_started, path_chosen,
  step_completed, onboarding_finished), beacons fired from the wizard.
- **Demo tour** - `/api/demo` sets the `lyra_demo` cookie so configured deploys still
  offer "Explore the demo first" from `/welcome`; middleware lets it through signed-out.
- **Demo-to-account prefill** - the wizard picks up local demo watchlist/portfolio
  (`local-watchlist.ts`, `local-portfolio.ts`) so nothing built in demo evaporates at
  signup.
- **Auth funnel honesty** - `/auth/callback` redirects failures to the login form WITH a
  reason (`error=confirm_failed|missing_code`), never to a silent dead end.

## Stage 1 - Measure the funnel

1. Pull `activation_events` for the window: started -> path chosen -> steps -> finished.
   Compute per-step drop-off. No data (demo-only deploy)? Walk the funnel yourself in a
   fresh browser profile and record every point of hesitation instead.
2. Cross-check feedback (`/feedback-loop` channels) for onboarding complaints.

**Gate:** a funnel table (counts or a first-person walk log), worst drop-off identified.

## Stage 2 - Fix the worst friction first

- One fix per loop at the biggest drop-off; resist redesigning the whole wizard.
- Every fix must hold in BOTH modes: zero-key demo AND configured live. Test signed-out,
  demo-cookie, and authed paths.
- New funnel steps must fire an activation beacon (extend the closed event set in the
  route + the wizard, never free-form event names).

## Stage 3 - The demo promise audit

1. Fresh clone state: `npm run dev` with no `.env.local` - `/welcome`, the tour, the
   wizard, and one data surface (`/radar`) must render real demo content, never blanks,
   never a login wall.
2. Configured state: signed-out visit must still offer the demo tour.

**Gate:** both walks pass; any regression here outranks every other finding.

## Stage 4 - Verify + ship

`npm run type-check && npm run test && npm run build`, version bump via `RELEASES`,
`npm run release`, commit, push, `npm run announce`. If the flow changed, hand off to
`/onboarding-parity` so the docs/companion surfaces catch up in the same session.

**Done means:** funnel measured, worst friction fixed and verified in both modes, demo
promise intact, docs handed off, shipped under a version. Explainability: the report says
where users drop, what changed, and the before/after evidence.
