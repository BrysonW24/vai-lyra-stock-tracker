# /onboarding-parity - restore parity across all three onboarding surfaces

The skill chain that keeps onboarding honest. It reconciles the **human**, **html**, and
**agent** onboarding surfaces with the current codebase, then proves it with the deterministic
gate. Run it after any change that touches the stack, costs, routes, env vars, walkthroughs,
version, or the product story - and at the end of any session that shipped an onboarding-visible
feature.

The surfaces (from `ONBOARDING.md`, the asset ledger):

| Audience | Surface |
|----------|---------|
| human | `docs/walkthroughs/`, `QUICKSTART.md`, `ONBOARDING.md` |
| html | `docs/onboarding/setup-companion.html` (+ served `public/` copy), landing `StackSection.tsx` / `UltimateGoals.tsx` |
| agent | `AGENT-ONBOARDING.md`, `.claude/commands/setup.md` |

## The chain

**Stage 0 - Scope.** Run `npm run check:onboarding --json` for the mechanical drift, and
`git log --oneline -15` / `git diff` to see what changed in the codebase since the last
onboarding touch (new deps in `package.json`, new/changed routes under `src/app/api`, `COSTS.md`
edits, `.env.example` edits, `src/lib/version.ts`, new walkthroughs). Decide which surfaces are
affected. If nothing drifted and the checker is `ok`, stop - say so and exit.

**Stage 1 - human.** If the walkthroughs, quickstart, prices, commands, or the ledger drifted,
follow `/sync-human-onboarding`.

**Stage 2 - html.** If the stack, costs, goal story, logos, or the served copy drifted, follow
`/sync-companion-onboarding`. This also keeps the landing twins in step.

**Stage 3 - agent.** If the modes, commands, setup contract, gates, or security posture drifted,
follow `/sync-agent-onboarding`.

**Stage 4 - recompile knowledge.** `npm run content:build` - this regenerates the served
companion copy AND recompiles the onboarding docs into the in-app AI's knowledge corpus, so the
copilot answers from the fresh docs.

**Stage 5 - prove parity (the gate).** All must pass:
- `npm run check:onboarding` -> `ok`
- `npm run type-check` (if any `.tsx` changed)
- `npm run build` (if routes / config / landing changed)
Then bump the version if shippable code changed (`src` / `public` / `supabase` / `workers`) -
prepend to `RELEASES` in `src/lib/version.ts` and `npm run release` - and commit. Docs-only /
`.claude`-only changes do not need a version bump.

## Rules

- Never hand-copy `public/setup-companion.html`; `content:build` generates it.
- Honest statuses only, plain hyphens (never an em dash), research-not-advice framing everywhere.
- If you ADD an onboarding surface, register it in `ONBOARDING.md`, add it to the checker if it
  can drift structurally, and (if it is a doc) to `SOURCES` in `scripts/build-knowledge.mjs`.
- Do not invent parity: if a surface is intentionally ahead of the code (a roadmap card), say so
  in the surface itself so the checker's human reviewer knows it is deliberate.
