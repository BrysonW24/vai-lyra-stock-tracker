# ONBOARDING.md - the ledger of everything Lyra offers a new developer

This file is the single register of every onboarding asset, spec, and experience in the
repo - for humans and for agents. If you add, move, or materially change an onboarding
surface, update this ledger in the same change. (Agents: your entry point is
[AGENT-ONBOARDING.md](AGENT-ONBOARDING.md); this file tells you what exists and why.)

## The experience, in one line

A developer points their AI agent at this repo; the agent runs the setup end to end,
opens a live **Setup Companion** page in the developer's browser so they can watch and
understand every stage, and hands over a working console - demo in minutes, live and
deployed if they choose.

## Asset register

| Asset | Audience | What it delivers |
|---|---|---|
| [AGENT-ONBOARDING.md](AGENT-ONBOARDING.md) | Any coding agent | The agent's front door: mission, ground rules, the setup contract, verification gates |
| [HARNESS.md](HARNESS.md) | Any coding agent | The agent harness: deterministic gates (`scripts/check-*.mjs`), hooks, CI, runtime guards, the operating contract |
| [SKILL-CHAIN.md](SKILL-CHAIN.md) | Any coding agent | Skill-chain registry + coverage map: every code section's owning maintenance chain, enforced by `npm run check:chains` (CI) |
| `/harness-map.html` ([scripts/build-harness-map.mjs](scripts/build-harness-map.mjs)) | Agents + humans | The nervous-system map: SKILL-CHAIN.md + HARNESS.md rendered as one interactive page - chains, the coverage map (click a chain to focus the sections it owns), the deterministic gates, and the enforcement layers. Generated on the content pipeline so it cannot drift; also emits `src/lib/generated/harness-map.json` |
| [.claude/commands/setup.md](.claude/commands/setup.md) | Claude Code (readable by any agent) | The `/setup` playbook: stage-by-stage E2E setup with verification gates, companion wiring, Vercel CLI path |
| [docs/onboarding/setup-companion.html](docs/onboarding/setup-companion.html) | The human, in their browser | Live premium spec + progress board the agent opens during setup (spec below) |
| [public/setup-companion.html](public/setup-companion.html) | The human, in the app | Same companion served at `/setup-companion.html` as an in-app resource - GENERATED from the docs copy by `npm run content:build` (never hand-copied) |
| [QUICKSTART.md](QUICKSTART.md) | Humans in a hurry | 5-minute demo-mode path, no keys |
| [docs/walkthroughs/](docs/walkthroughs/README.md) | Humans, self-paced | The clone-to-live replication path, 6 walkthroughs: 01 tour, 02 run it yourself, 03 your own data spine, 04 deploy your own (incl. the agent-friendly Vercel CLI subsection), 05 understand the score, 06 alerts on your phone |
| `/welcome` landing sections | Prospective users | "The ultimate goal" (6 flip cards) + "The stack" (16 cost-badged tiles) ported from the companion - [src/components/landing/UltimateGoals.tsx](src/components/landing/UltimateGoals.tsx), [src/components/landing/StackSection.tsx](src/components/landing/StackSection.tsx) |
| `/onboarding` in-app flow | Signed-in users | Console setup after account creation (demo mode goes straight there) |
| `npm run dev` splash ([scripts/splash.mjs](scripts/splash.mjs)) | Humans + agents | Branded first-run moment: the Lyra wordmark in the tri-gradient + "by Vivacity.ai" prints just before Next hands you the localhost URL (truecolor, gracefully plain on non-TTY, always exits 0) |
| `npm run commission` ([scripts/commission-card.mjs](scripts/commission-card.mjs)) | The human, after setup | Private branded receipt written into the clone once the deploy is healthy - `commission/card.svg` + `COMMISSIONED.md`, both gitignored. A local keepsake, never shared. Version + mode read from `/api/health` |
| `npm run doctor` | Humans + agents | Reports which mode you are in (demo / live / AI) and what is configured |
| `/api/health` | Agents + hosting | Public liveness + version probe - the "done looks like" gate for deploys |
| [COSTS.md](COSTS.md) | Humans deciding to go live | Fully-itemised stack costs, free-tier limits, the gotchas that bite |
| [SECURITY.md](SECURITY.md) + [DISCLAIMER.md](DISCLAIMER.md) | Everyone | Key handling rules; research-not-advice framing |
| `/whats-new` + version badge | Returning users | Enforced changelog - every shipped change bumps `src/lib/version.ts` |
| [public/logos/](public/logos/) | Shared | The verified brand-logo library (SVG/PNG) used by the companion and the landing sections |

## Keeping onboarding in parity with the codebase

These surfaces drift the moment the stack, costs, routes, env vars, walkthroughs, or version
change. Parity is enforced, not hoped for:

| Tool | What it does |
|---|---|
| `npm run check:onboarding` ([scripts/check-onboarding-parity.mjs](scripts/check-onboarding-parity.mjs)) | Deterministic drift gate: companion vs its served copy, stack tiles vs `StackSection.tsx`, goal cards vs `UltimateGoals.tsx`, landing logo files exist, ledger/agent-doc links resolve, walkthrough count is coherent, onboarding docs are in the knowledge `SOURCES`. Runs in CI; `--json` for tooling. |
| `npm run check:onboarding-contract` ([scripts/check-onboarding-contract.mjs](scripts/check-onboarding-contract.mjs)) | Deterministic CONTRACT gate for the DATA the onboarding captures (as opposed to the doc surfaces above): proves every profile answer is persisted (`/api/onboarding`), read back (`getUserConstraints`), and emitted into the AI prompt (`buildConstraintsBlock` + `deriveTone`), and that the profile read can never 400 the whole profile on an unapplied migration. Runs in CI; `--json` for tooling. |
| [/onboarding-parity](.claude/commands/onboarding-parity.md) | The skill chain: scope drift -> sync each affected surface -> recompile knowledge -> prove with the gate. Run after any onboarding-visible change. |
| [/sync-human-onboarding](.claude/commands/sync-human-onboarding.md) | Walkthroughs + QUICKSTART + this ledger vs the code. |
| [/sync-companion-onboarding](.claude/commands/sync-companion-onboarding.md) | The HTML companion (+ served copy + landing twins) vs the stack/costs. |
| [/sync-agent-onboarding](.claude/commands/sync-agent-onboarding.md) | `AGENT-ONBOARDING.md` + the `/setup` contract vs the code. |

The served companion copy is generated by `npm run content:build` (which runs on
`predev`/`prebuild`/`pretype-check`), so the two copies can never drift.

## Setup Companion - the spec

The companion is the heart of the developer-with-agent experience. It is a single
self-contained HTML file (no network requests, all assets embedded as data URIs).

- **Duo brand**: Lyra colouring on the Vivacity.ai light glass system. Stacked lockup -
  Lyra mark / "by" / Vivacity.ai logo + wordmark. Left-aligned on desktop, centred on
  mobile. Tokens: bg `#F7F6F2`, ink `#0E1E3A`, body `#5A6B82`, blue `#1E63FF -> #5BC8FF`,
  Lyra tri-gradient `#3b5bdb -> #43d18b -> #f3a33a`, glass `rgba(255,255,255,.72)` + blur.
- **Live progress board**: the page self-refreshes every 5s; the agent edits ONLY the
  `SETUP_STATE` object between the `SETUP_STATE_START/END` markers at every stage
  transition (statuses: pending / active / done / blocked / skipped, plus a one-line note).
- **Stage cards** (s0-s5 + s3b): emoji-structured rows - "What happens", "Why it
  matters", "Done looks like" - so the human always knows what the agent is doing.
- **Architecture strip**: the three moving parts (GitHub Actions scanner -> Supabase <-
  Next.js app) as an aligned ASCII diagram.
- **The stack**: 16 glass tiles, every technology with its REAL embedded logo
  (multicolor Slack, real OpenAI blossom, Anthropic Claude tile, two-tone Python) and an
  honest cost badge (free / optional / paid).
- **The ultimate goal**: 6 animated flip cards - punchy one-liner on the front, click
  (or Enter/Space) flips to the detail; flip state survives the 5s refresh via
  sessionStorage. Cards: small-cap signal radar, auditable analysis, BYOK AI, alerts
  channels, paper bot, and the human-gated live bot (honestly badged "the destination").
- **Gate micro-delight**: the moment a stage flips to `done`, its card gets a one-shot
  tri-gradient shine sweep, and (only if the human opts in via the `🔕 Sound off` toggle)
  one soft two-note tone. Transitions are baseline-seeded in sessionStorage so opening the
  page mid-setup never bursts; `prefers-reduced-motion` disables the sweep and the tone is
  strictly opt-in.
- **Mobile pass is imperative**: single-column cards, 2-up stack grid, centred lockup,
  scrollable architecture strip. `prefers-reduced-motion` disables all animation.
- **Honest statuses everywhere**: WhatsApp is architecture-only, the live bot is not
  live - the companion never oversells.

## Experience principles (apply to every onboarding surface)

1. **Agent-first, human-visible** - the agent does the work; the human watches a real
   page, not a terminal scroll.
2. **Punchy front, detail on demand** - one-line fronts, flip/click for depth. No
   banner blindness.
3. **Honest statuses** - live things say live; scaffolded things say so.
4. **Research, never advice** - every surface keeps the disclaimer framing.
5. **Secrets never in chat** - keys go into `.env.local` / host env vars only; the
   companion and playbooks repeat this rule.
6. **Plain hyphens** - never an em dash in user-visible copy.
7. **Verification gates** - nothing is "done" until its gate passes (`doctor`, build,
   `/api/health`, probe sends).

## Maintenance rules

- Companion edits: change `docs/onboarding/setup-companion.html`, then
  `cp docs/onboarding/setup-companion.html public/setup-companion.html` - the two copies
  must never drift.
- The knowledge layer compiles the reference docs (including the walkthroughs) into the
  in-app AI's retrieval corpus - if you rename or move a doc, update `SOURCES` in
  `scripts/build-knowledge.mjs` or the build fails loudly.
- Landing sections and companion share content deliberately (goals + stack) - if the
  product story changes, update both plus this ledger.
