# /sync-human-onboarding - keep the human-facing onboarding in parity with the codebase

You are updating the **human** onboarding surface: the self-paced replication path
(`docs/walkthroughs/` + its `README.md` index), `QUICKSTART.md`, and the asset ledger
`ONBOARDING.md`. Goal: a person following these ends up with a working console, because every
command, env var, route, and price still matches the code.

## Do

1. **Scope the drift.** Run `npm run check:onboarding --json` - it catches broken ledger links
   and a wrong walkthrough count. Then check the things a checker cannot:
   - Every shell command / npm script named in the walkthroughs still exists in `package.json`.
   - Every env var referenced matches `.env.example`.
   - Schema / route / file paths cited still resolve (the walkthroughs are share-the-repo-link
     collateral - a stale command is a broken promise).
   - Prices in any walkthrough match `COSTS.md`.
2. **Update the walkthroughs** in place. Keep them human-paced and honest (research, not advice;
   plain hyphens, no em dash). If you add or remove a walkthrough, renumber consistently and fix
   the `README.md` index AND the count wording in `ONBOARDING.md` and `CLAUDE.md`.
3. **Update `ONBOARDING.md`** - the ledger. Its asset table must list every onboarding surface
   with a resolving path. If an onboarding capability was added (a new skill, a new companion
   section, a new landing surface), add its row. This file is the single source of truth for
   "what do we offer from the onboarding perspective" - keep it complete.
4. **`QUICKSTART.md`** - the 5-minute demo path must still be exactly the current commands.
5. If any walkthrough doc is renamed or added, update `SOURCES` in `scripts/build-knowledge.mjs`
   so the in-app AI can still cite it (the build fails loudly if a source is missing).

## Gate

- `npm run check:onboarding` -> `ok`.
- Spot-run one changed command end to end (e.g. `npm run doctor`) to confirm it behaves as the
  doc claims.

Then hand back to `/onboarding-parity` (or rebuild knowledge + commit if run standalone).
