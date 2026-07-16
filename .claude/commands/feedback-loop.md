# /feedback-loop - turn app feedback into shipped improvements

You are Claude Code running in the Lyra repo. Run one full improvement loop: pull every
feedback channel, triage what came in, engineer the highest-leverage fixes/improvements,
verify, ship with a version bump, and close the loop back on the channel. Follow the repo
conventions in `CLAUDE.md` throughout (deterministic engine owns every number, hyphens not
em dashes, version bump on every shippable change).

## The channels (pull ALL of them)

1. **GitHub issues** - the in-app feedback box files issues when `GITHUB_FEEDBACK_TOKEN` +
   `GITHUB_FEEDBACK_REPO` are set. Pull open ones:
   `gh issue list --repo <owner/repo> --state open --json number,title,labels,body,createdAt`
   Labels: `bug` (🐞), `enhancement` (💡 idea), `feedback` (💬 other, includes ratings).
2. **Slack** - feedback also lands in the feedback channel when `SLACK_FEEDBACK_WEBHOOK_URL`
   (or `SLACK_FEEDBACK_BOT_TOKEN` + `SLACK_FEEDBACK_CHANNEL`) is set. If you have Slack
   access in this session, read the channel; otherwise ask the user to paste anything new.
3. **Server logs** - unwired deployments log `[feedback]` lines instead of filing. Check the
   hosting platform's function logs (Vercel / Coolify) for `[feedback]` since the last loop.
4. **Rating prompt** - the 2-week rating (`src/components/RatingPrompt.tsx`) posts through
   the same `/api/feedback` intake; treat low ratings with a message as bug-priority signal.
5. **Channel health** - run `npm run doctor` and check the "Feedback channel" line. If it
   warns that no sink is wired, wiring one IS the first improvement of the loop (see
   `.env.example`, `SLACK_FEEDBACK_*` / `GITHUB_FEEDBACK_*`).

**Gate:** you can state how many items came in per channel, or explicitly that a channel is
empty/unreachable. Never silently skip a channel.

## Triage

1. Deduplicate and cluster into: **bugs**, **UX friction**, **ideas**, **data quality**.
2. Reproduce every bug before believing it (demo mode reproduces most UI bugs with no keys).
3. Rank: bugs that block core flows > data-integrity issues > friction on the radar/findings
   loop > new ideas. Small high-frequency papercuts beat large speculative features.
4. Write the ranked list to the session plan (TodoWrite) - one todo per item you will ship
   this loop. Explicitly park what you will NOT do and say why.

**Gate:** every parked item has a reason; every accepted item has a reproduction or a clear
acceptance test.

## Engineer

- Fix root causes, not symptoms. Follow existing patterns (see `CLAUDE.md` conventions:
  frontend never recalculates engine truth, AI explains but never invents a number).
- Each fix gets a test where the repo already has a harness (Vitest in `tests/*.test.ts`,
  pytest in `tests/test_*.py`).
- Feature-flag or env-gate anything that needs credentials so demo mode stays $0 and green.

## Verify (production-keeper subset)

Run the chain - all must pass before shipping:
`npm run type-check && npm run test && npm run worker:test && npm run build`

## Ship + close the loop

1. Prepend a `RELEASES` entry in `src/lib/version.ts`, run `npm run release`, commit, push
   (the pre-push hook enforces this - never bypass with `VD_SKIP_VERSION` in this flow).
2. Close each shipped GitHub issue with a comment naming the version that fixes it.
3. Run `npm run announce` (after the push) - it posts the release summary to every
   configured chat channel (Slack / Telegram / WhatsApp) so reporters see the loop close.
4. Anything discovered but not shipped: file it as a GitHub issue so the next loop starts
   with a full queue instead of tribal memory.

**Gate:** version bumped, changelog current, every inbound item either shipped+answered or
filed+parked. That is one complete loop.
