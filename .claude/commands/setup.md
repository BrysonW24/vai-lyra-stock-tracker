# /setup - agent-run end-to-end Lyra setup

You are Claude Code running inside a fresh clone of Lyra. Set the whole thing up for the user,
end to end, with a verification gate after every stage. Do the work yourself wherever a terminal
can do it; hand the user a numbered, copy-pasteable checklist for the few steps that require a
browser (creating accounts, pasting keys). Human-paced explanations live in
`docs/walkthroughs/` - read the matching walkthrough before each stage and follow the repo's
conventions in `CLAUDE.md`.

## Ground rules

- **Money is opt-in.** Before any stage that can cost money (AI key usage, a server, a domain),
  show the relevant rows from `COSTS.md` and get explicit consent. Demo mode is $0 and the default.
- **Secrets discipline.** Secrets go in `.env.local` (gitignored) or the hosting platform's env UI,
  never in a commit, never echoed back in chat. `SUPABASE_SERVICE_ROLE_KEY` is worker-only: it must
  never appear in a `NEXT_PUBLIC_*` variable or on the web host.
- **Gate every stage.** Run the stated verification before moving on. If it fails, stop and fix it
  with the walkthrough's troubleshooting table; do not stack a broken stage under a new one.
- **Research, not advice.** Keep Lyra's framing: the deterministic engine scores setups for
  research; nothing here is financial advice.

## Stage 0 - Orient and choose a path

1. Verify prerequisites: `node --version` (need >= 20), `npm --version` (>= 10), `git --version`.
2. Ask the user which endpoint they want (they can upgrade later; each stage builds on the last):
   - **A. Demo** - run locally on built-in data, no accounts, $0. (Stages 1)
   - **B. Live** - their own Supabase + the hourly scanner, still $0. (Stages 1-3)
   - **C. Live + AI** - add an AI key for plain-English explanations. (Stages 1-4)
   - **D. Online** - deployed to Vercel ($0) or their own server via Coolify. (Stages 1-5)

## Stage 1 - Run it (demo mode)

Walkthrough: `docs/walkthroughs/02-run-it-yourself.md`.

1. `npm install`
2. `npm run doctor` - explain the mode report to the user.
3. `npm run dev`, then open the printed localhost URL.

**Gate:** doctor reports demo mode; the app loads at `/welcome`; `npm run type-check` and
`npm run test` both pass. Stop here for path A and show the user around (walkthrough 01).

## Stage 2 - Their own Supabase (live data + auth)

Walkthrough: `docs/walkthroughs/03-go-live-supabase.md`.

1. Checklist for the user: create a free Supabase project, then paste the Project URL and
   anon/publishable key back to you (both are safe to share; they ship to browsers by design).
2. Apply the schema via the dashboard SQL editor: first `supabase/migrations/` in numeric
   filename order (the canonical schema - auth, RLS, scanner, trades), then
   `sql/_apply_all_scanner_schema.sql` once (idempotent reconciliation that adds the columns
   the Python worker expects). The other numbered files in `sql/` are legacy - skip them.
   Verify key tables exist afterwards.
3. Create `.env.local` from `.env.example`; fill the `NEXT_PUBLIC_SUPABASE_*` pair (frontend) and
   `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (worker-only; user pastes the service key directly
   into the file, not into chat).

**Gate:** `npm run doctor` reports live mode; the user can sign up, confirm email, and sign in.

## Stage 3 - The hourly scanner

Same walkthrough, scanner section.

1. Run it once locally first (Python 3.11+; install worker deps as the walkthrough specifies) with
   `npm run worker:scan`, and confirm rows land in Supabase.
2. For always-on scanning: the user forks/pushes the repo to their GitHub, then you walk them
   through adding the repo secrets that `.github/workflows/hourly-stock-scanner.yml` expects
   (read the workflow file and list them exactly).

**Gate:** one green scanner run (locally or in Actions) and live scores visible in the app.

### Stage 3b - Alerts on their phone (optional, $0)

Walkthrough: `docs/walkthroughs/06-alerts-on-your-phone.md`. Offer in order of ease:

- **Web push** - zero accounts: generate a VAPID keypair, set the env vars, enable in-app.
- **Telegram** - the recommended phone channel (~10 minutes): BotFather bot,
  `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`, pairing per the walkthrough.
- **WhatsApp** - be honest: the code ships architecture only; a user needs Meta Business
  API onboarding before this works. Do not oversell it.

**Gate:** a test notification lands on their device (push test route or a Telegram message).

## Stage 4 - AI explanations (optional, first paid item)

Show the AI rows of `COSTS.md` first. Two options - support both:

- **BYOK in-app:** the user adds their own provider key in Settings; nothing server-side.
- **Hosted:** set `OPENAI_API_KEY` in `.env.local` (and later on the host) so every visitor gets
  the keyless beta.

**Gate:** `/api/ai/status` (or the Settings AI panel) shows the provider as available, and a chat
brief answers using real numbers from the dashboard.

## Stage 5 - Put it online

Walkthrough: `docs/walkthroughs/04-deploy-your-own.md`. Offer both paths with costs:

- **Vercel (simplest, $0 Hobby):** import the repo, set the `NEXT_PUBLIC_*` env vars, deploy.
- **Coolify (own server):** follow `docs/runbooks/coolify-deploy.md`. The critical detail: mark
  every `NEXT_PUBLIC_*` variable as a **Build Variable** - they are inlined at build time, and a
  runtime-only value silently ships a demo-mode build.

**Gate:** `curl https://<their-app>/api/health` returns `"ok":true`, the version matching
`src/lib/version.ts` `RELEASES[0]`, and `"mode":"live"`.

## Wrap up

- Summarise what is running where (local / Supabase / Actions / host), what it costs per month
  (from `COSTS.md`), and where the keys live.
- Point them at `docs/walkthroughs/05-understand-the-score.md` (how the score works) and
  `docs/tradingview-copilot.md` (backtest the same logic in TradingView).
- Remind them: if they change shippable code, the repo's pre-push guard requires a version bump -
  `CLAUDE.md` "Releasing" has the one-step flow.
