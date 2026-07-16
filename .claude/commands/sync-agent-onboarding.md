# /sync-agent-onboarding - keep the agent-facing onboarding in parity with the codebase

You are updating the **agent** onboarding surface: `AGENT-ONBOARDING.md` (the front door for any
coding agent dropped into a fresh clone) and the setup contract it points at,
`.claude/commands/setup.md`. Goal: an agent that reads only these can set Lyra up correctly and
safely, because the mission, contract, commands, gates, and security rules still match the code.

## Do

1. **Scope the drift.** `npm run check:onboarding --json` catches broken links and confirms
   `AGENT-ONBOARDING.md` is in the knowledge `SOURCES`. Then verify by reading:
   - The three modes (demo / live / AI) and `npm run doctor` still describe reality.
   - Every command and file path in the "Where everything lives" table resolves.
   - The setup contract stages in `AGENT-ONBOARDING.md` match the actual stages in
     `.claude/commands/setup.md` (Stage 0..5 + 3b), including the companion-first step and the
     `SETUP_STATE` marker rule.
   - The verification gates named (install/dev, schema, scanner, alerts, deploy `/api/health`)
     match what the code actually checks.
2. **Security ground rules are load-bearing** - keep them exact: secrets only in `.env.local` /
   host env (never chat or `NEXT_PUBLIC_*`), `SUPABASE_SERVICE_ROLE_KEY` is worker-only, honest
   statuses only, research-not-advice. If a security posture changed in code (e.g. a new
   founder-gated route, a new SSRF fence), reflect it here.
3. **Keep `setup.md` true.** If a stage's commands, the deploy path (Vercel CLI), or the schema
   apply order changed, update the playbook - agents follow it literally.
4. Plain hyphens, never an em dash. If you add an agent-facing doc, add it to `ONBOARDING.md`'s
   ledger and to `SOURCES` in `scripts/build-knowledge.mjs`.

## Gate

- `npm run check:onboarding` -> `ok`.
- Re-read `AGENT-ONBOARDING.md` end to end as if you were a fresh agent: could you run setup from
  it alone without guessing? If not, fix the gap.

Then hand back to `/onboarding-parity` (or rebuild knowledge + commit if run standalone).
