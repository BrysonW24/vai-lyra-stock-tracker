# /production-keeper - keep Lyra at production level

You are Claude Code running in the Lyra repo. Run the full production-health chain, fix
everything red at the root cause, and leave the tree shipped (version bumped, changelog
current, hooks intact). This is the chain to run on a schedule, after dependency bumps,
before a deploy, or any time "is the app still healthy?" needs a real answer.

## Stage 0 - Preflight

1. `git status --short` - know what is uncommitted before you touch anything. If another
   session's work is in flight (files appearing you did not create), reconcile - never
   clobber and never sweep half-done work into a commit.
2. `npm install` if `node_modules` is missing or `package-lock.json` changed.
3. `npm run doctor` - record the mode (demo/live) and every warning line.

## Stage 1 - Static gates

- `npm run type-check` (strict TS, no `any`)
- `npm run lint`

## Stage 2 - Test gates

- `npm run test` - frontend Vitest suite.
- `npm run worker:test` - Python worker suite (launcher prefers `.venv/bin/python`; if deps
  are missing: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`).

## Stage 3 - Build + runtime probe

1. `npm run build` - the real production build, not just type-check.
2. Boot it (`npm run start` on a spare port, or `npm run dev -- -p 3042`) and probe
   `GET /api/health` - expect `{ ok: true, version, mode }` where `version` matches
   `RELEASES[0]` in `src/lib/version.ts`.
3. Load `/welcome` and one data-heavy page (`/radar`) - demo mode must render real content,
   never a blank or error state.

## Stage 4 - Drift gates (the silent killers)

- `npm run check:version` - `package.json` / `version.ts` / `CHANGELOG.md` lockstep.
- Env drift: every `process.env.X` referenced in `src/` and `workers/` should appear in
  `.env.example` (grep for new vars; undocumented env vars are how deploys break silently).
- Docs drift: if commands, env vars, or schema changed, `docs/walkthroughs/`,
  `QUICKSTART.md`, and `.claude/commands/setup.md` must still be true.
- Cron drift: `.github/workflows/hourly-stock-scanner.yml` - GitHub disables schedules
  after 60 days without repo activity; check the Actions tab for a disabled workflow and
  recent scan-run failures.
- Feedback drift: doctor's "Feedback channel" line - if unwired, feedback is silently
  dropping into logs (see `/feedback-loop`).

## Stage 5 - Live surfaces (when deployed)

- Probe the deployed `/api/health` (Vercel and/or the Coolify box) - the running `version`
  tells you whether the last release actually shipped. See
  `docs/runbooks/coolify-deploy.md` for the self-host path.
- Supabase free tier: confirm the project is not paused (it pauses after ~1 week idle;
  the hourly scanner normally keeps it alive - see `COSTS.md` gotchas).

## Stage 6 - Fix and ship

1. Fix reds at the root cause - read the actual error, never suppress, never
   `VD_SKIP_VERSION`, never `--no-verify`.
2. Re-run the failed stage after each fix; then re-run stages 1-4 once more end to end.
3. If anything shippable changed: prepend `RELEASES` in `src/lib/version.ts`,
   `npm run release`, commit (conventional commits), push, then `npm run announce`
   to post the release to the configured chat channels.
4. Report honestly: what was green, what was red, what you fixed, what remains parked
   (with an issue filed for it).

**Done means:** all six stages green, version/changelog current, no uncommitted shippable
code, and every remaining known issue exists as a GitHub issue - not as tribal memory.
