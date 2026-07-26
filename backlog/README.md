# backlog/ - agent prompt packs and parked work

Not a live ticket system. This folder holds ready-to-paste prompts for parallel agent
lanes plus parked work items. Current pack: the iOS TestFlight beta.

## iOS TestFlight beta - prompt files

| File | Lane | Status at last orchestrator sweep (2026-07-18) |
|---|---|---|
| [prompt-1-ios-release-pipeline.md](prompt-1-ios-release-pipeline.md) | A - native release | COMPLETE: TestFlight build 1 SHIPPED (team signing baked in, ASC record live, runbook records the real flow - `0e808f1`) |
| [prompt-2-native-experience.md](prompt-2-native-experience.md) | B - web-side shell UX | COMPLETE: self-landed as v0.70.0 (`dbd9457`) - native modules + tests + 15-component integration; gates verified green by the orchestrator |
| [prompt-3-beta-qa-feedback.md](prompt-3-beta-qa-feedback.md) | C - beta QA + tester experience | COMPLETE (run by the orchestrator 2026-07-18): [qa-report-ios-beta.md](qa-report-ios-beta.md), tester guide, review checklist shipped; 2 findings routed (Lane A dark-mode pin, coordinator errorPath) |

To fire a lane: open a fresh Claude Code session in this repo and paste the prompt block
from the corresponding file verbatim. Lanes are file-disjoint and safe to run concurrently.

## Coordination protocol

- **Coordinator owns:** `capacitor.config.ts`, `package.json`, `package-lock.json`,
  `native/`, merge-order arbitration, and `npx cap sync ios` when config changes.
- **The one forbidden cross-lane operation:** installing a Capacitor plugin (touches
  `package.json` AND the ios project). All prompts route it to the coordinator.
- **Shared-tree rules for every lane:** git status before starting and before every
  commit; dirty files you do not own belong to another lane - never add them; commit only
  with explicit pathspec; never bare git add -A; never git stash.
- **Founder-gated steps:** Xcode Apple ID sign-in + team selection; App Store Connect
  app-record creation; TestFlight upload approval; App Store Connect API key creation;
  the Phase 2 APNs key.

## Remaining open items

- Founder device pass: QA rows 4, 10-13 (splash eyeball, share sheet, session persistence,
  keyboard, scroll physics) - the tester guide's checklist covers them one for one.
- One cosmetic web backlog item: /welcome dark-scheme seam (QA row 7, ux-surface chain).
- Phase 2: APNs push per docs/product/native-app.md (founder-gated APNs key).
- Resolved 2026-07-18: the stray `Lyra/` blank Xcode template at repo root was verified
  pure boilerplate and deleted (the real app is `ios/App/App.xcodeproj`).

## Parked work items - Solo / Community (2026-07-26)

- **Arm the Solo -> account upgrade CTA** (founder action, no code needed). The CTA is built
  and shipped DARK in v0.75.0. To make it visible: set `NEXT_PUBLIC_SOLO_UPGRADE_CTA=1` on the
  **solo** Vercel deployment and redeploy. It only shows on Solo, only in the Notifications
  settings tab, and deep-links to signup on production. Preview first, then arm.
- **Extend idea provenance to votes** (small follow-up to v0.77.0). v0.77.0 added a `surface`
  column to `community_ideas` (solo / community / other, classified from the request Origin)
  so the board shows where each idea came from. Votes (`community_idea_votes`) are the heavier
  engagement signal and are NOT yet tagged - same pattern would apply: add `surface` to the
  votes table + stamp it in the vote route (best-effort, column-missing fallback like the ideas
  route). Do when a "who's engaging, Solo vs Community" read needs vote-level granularity.
