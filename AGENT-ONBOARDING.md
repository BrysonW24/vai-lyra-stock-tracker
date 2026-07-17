# AGENT-ONBOARDING.md - hello, agent 👋

You are an AI coding agent, and your human just pointed you at Lyra. This page is for
you. Read it once (about 2 minutes of your context), then run the setup. Your mission:
a working console your human understands - not a wall of terminal output.

## 60-second orientation

Lyra is a research-grade stock oversold-recovery radar. A **deterministic engine**
computes every number (RSI, MACD, trend, volume -> a 0-100 score); an optional AI layer
only phrases explanations. It runs in three modes:

1. **Demo** - no keys. `npm install && npm run dev`. Full console on built-in data.
2. **Live** - your human's own Supabase + an hourly GitHub Actions scanner + alerts.
3. **AI** - bring-your-own-key explanations on any provider (OpenAI, Anthropic, Gemini,
   OpenRouter).

`npm run doctor` tells you which mode the current checkout is in.

## The setup contract

The full playbook is [.claude/commands/setup.md](.claude/commands/setup.md). In Claude
Code it runs as `/setup`; any other agent can read it top to bottom and follow it - it
is plain markdown with explicit stages and gates. The non-negotiables:

1. **Open the Setup Companion first.** Copy
   `docs/onboarding/setup-companion.html` to a temp dir and open it in the human's
   browser (`open` / `xdg-open` / `start`). It is their live window into what you are
   doing - a spec page plus a progress board that self-refreshes every 5 seconds.
2. **Keep the board honest.** At every stage transition, edit ONLY the `SETUP_STATE`
   object between the `SETUP_STATE_START` / `SETUP_STATE_END` markers - status
   (`pending|active|done|blocked|skipped`) plus a one-line note. Never touch the rest
   of the file.
3. **Ask before you provision.** Choosing demo vs live vs AI, creating cloud projects,
   and anything that costs money is the human's call. Present the options; let them pick.
4. **Verification gates are the definition of done.** A stage is not done because the
   command exited 0 - it is done when its gate passes:
   - install/dev: the app answers on its port
   - schema: migrations applied, then `sql/_apply_all_scanner_schema.sql` once
   - scanner: a real scan writes rows
   - alerts: the probe send actually arrives
   - deploy: `https://<domain>/api/health` returns ok with the right version
     (and `"cache":"upstash"` if you wired the optional Upstash Redis - else `"memory"`, both fine)
5. **Brand the channels you set up.** A Telegram bot or Slack app with a blank grey avatar
   is unrecognisable in a busy chat. When your human sets one up, point them at the logo -
   it is already in the repo, so never ask them to go hunting or make one:
   - **Lyra mark** - `assets/logo-lyra.png` (512x512, meets Slack's minimum and Telegram's).
     Telegram: BotFather -> `/setuserpic`. Slack: **Basic Information -> Display
     Information -> App icon**.
   - **Vivacity.ai mark** - `assets/logo-vivacity-ai.png` (1254x1254) for the publisher/org
     identity, where the surface asks for the maker rather than the product.
   - Same files serve the README gallery; do not generate new ones or re-crop these.
6. **Report back like a colleague.** Finish with: what mode, what URLs, where the keys
   live, what it costs (see [COSTS.md](COSTS.md)), and what they can do next.

## Ground rules (security - no exceptions)

- **Never paste secrets into chat, logs, or echo them.** Keys go into `.env.local`
  (local) or host env vars (deploys). Confirm receipt by variable NAME only.
- **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend** or put any secret in a
  `NEXT_PUBLIC_*` variable. See [SECURITY.md](SECURITY.md).
- **Never claim something works that you have not verified.** Honest statuses only -
  the product itself says "architecture-only" where that is true; match that bar.
- Lyra is research software, never financial advice. Do not add advicey copy.

## If you change code

- **Work through the harness.** [HARNESS.md](HARNESS.md) is the enforcement map
  (deterministic gates, hooks, CI, runtime guards); [SKILL-CHAIN.md](SKILL-CHAIN.md)
  assigns every code section an owning skill chain - find your section in its coverage
  map and follow that chain's stages and gates. `npm run check:chains` fails CI if you
  add a section without an owner.
- Every shippable change bumps the version: prepend an entry to `RELEASES` in
  `src/lib/version.ts`, run `npm run release`, commit + push. A pre-push hook enforces
  this. **You may not be alone in this tree** - another agent session can ship while you
  work, and the version counter is shared. `git fetch origin` before cutting a release
  and number ABOVE origin/main's head; the gate blocks a version that moves backwards.
- **Demo mode doubles every code path you fork.** Everything here runs keyless, so a
  worker or route has a live shape and a demo shape. Keep them ONE pipeline where mode
  only changes inputs and sinks - a forked demo branch rots the moment the live branch
  is refactored (it happened; the keyless path is now pinned by a test). If you touch a
  worker, run it keyless before calling it done.
- **No silent caps.** Any `limit(N)` over data that grows, any retry ceiling, any
  truncation must be observable when it is hit (a summary flag + an ERROR in the log
  that a human reads). A cap nothing can notice is a green that cannot go red.
- **Where to spend a new check:** every deterministic gate added so far found real rot
  on its first run. If a surface has never had one, assume it is hiding something -
  see the earned-lessons list in [HARNESS.md](HARNESS.md).
- **Before debugging a familiar failure, grep the ledgers.** `harness-incidents.jsonl`
  (repo root) holds every incident that earned a gate, machine-readable; append a row
  when an incident earns a new one. Content workflows read and grow
  `.claude/content-rules.jsonl` the same way. Both are gate-checked (`npm run check:ledgers`).
- TypeScript strict, no `any`, plain hyphens (never an em dash) in user-visible copy.
- Conventions live in [CLAUDE.md](CLAUDE.md) - read it before editing.
- If your change touches the stack, costs, routes, env vars, walkthroughs, or version, the
  onboarding surfaces may now be stale. Run `npm run check:onboarding` (CI enforces it) and, if it
  flags drift, the `/onboarding-parity` skill chain to fix it.

## Where everything lives

| You need | Go to |
|---|---|
| The complete onboarding asset ledger | [ONBOARDING.md](ONBOARDING.md) |
| The agent harness (gates, hooks, CI, guards) | [HARNESS.md](HARNESS.md) |
| Skill-chain registry + section ownership map | [SKILL-CHAIN.md](SKILL-CHAIN.md) |
| The harness + coverage map, rendered visually | `/harness-map.html` (generated from the two files above) |
| The stage-by-stage setup playbook | [.claude/commands/setup.md](.claude/commands/setup.md) |
| Brand marks for Telegram/Slack avatars | `assets/logo-lyra.png` (product), `assets/logo-vivacity-ai.png` (maker) |
| Alerts setup, channel by channel | [docs/walkthroughs/06-alerts-on-your-phone.md](docs/walkthroughs/06-alerts-on-your-phone.md) |
| Human-paced deep dives | [docs/walkthroughs/](docs/walkthroughs/README.md) |
| Deploy: Vercel CLI path | [docs/walkthroughs/04-deploy-your-own.md](docs/walkthroughs/04-deploy-your-own.md) |
| Deploy: self-host (Docker/Coolify) | [docs/runbooks/coolify-deploy.md](docs/runbooks/coolify-deploy.md) |
| Costs, free tiers, gotchas | [COSTS.md](COSTS.md) |
| Key handling rules | [SECURITY.md](SECURITY.md) |

Welcome to the new world. Your human is watching the companion - make it a good show.
