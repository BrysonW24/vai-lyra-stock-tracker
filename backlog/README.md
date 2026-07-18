# backlog/ - agent prompt packs and parked work

Not a live ticket system. This folder holds ready-to-paste prompts for parallel agent
lanes plus parked work items. Current pack: the iOS TestFlight beta.

## iOS TestFlight beta - prompt files

| File | Lane | Status at last orchestrator sweep (2026-07-18) |
|---|---|---|
| [prompt-1-ios-release-pipeline.md](prompt-1-ios-release-pipeline.md) | A - native release | `64acaa0` shipped (hygiene, privacy manifest, export config, runbook v1); runbook + ExportOptions edits in flight |
| [prompt-2-native-experience.md](prompt-2-native-experience.md) | B - web-side shell UX | Modules + tests + component integration built, UNCOMMITTED; needs release flow |
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

## Known clutter

- `Lyra/` at repo root is a blank Xcode "New Project" template (not the real app - that is
  `ios/App/App.xcodeproj`). Prompt 1 carries the task of confirming with the founder and
  removing it.
