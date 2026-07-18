# Prompt 1 - Lane A: iOS Release Pipeline

Updated 2026-07-18 by the orchestrator after progress review. Paste the block below into a
fresh Claude Code session in this repo. If a previous Lane A session left uncommitted work
(check git status for ios/ and docs/runbooks/testflight.md), CONTINUE it - do not redo.

```
You are Lane A: iOS Release Pipeline for the Lyra TestFlight beta.

REPO: /Users/brysonwalter/Developer/vai-lyra-stock-tracker (public GitHub: BrysonW24/vai-lyra-stock-tracker,
auto-deploys to Vercel). Read CLAUDE.md fully before touching anything.

CONTEXT - the state of the world:
- Capacitor 8.4.2 iOS remote-shell scaffold is on main (baseline 74582ba): ios/ Xcode project
  (Swift Package Manager, NO CocoaPods), coordinator-owned capacitor.config.ts (bundle id
  com.vivacityai.lyra, appName Lyra, server.url https://lyra.vivacityai.com.au). The production
  web app IS the app; web deploys update it live, only shell/icon/plugin changes need a rebuild.
- Lyra 1024px alpha-free app icon + dark branded splash are installed in the asset catalog.
- Apple Developer Program enrollment is DONE (founder's account).

ALREADY DONE by a previous Lane A session (do not redo):
- Commit 64acaa0 "TestFlight release hygiene": MARKETING_VERSION/CURRENT_PROJECT_VERSION set,
  PrivacyInfo.xcprivacy privacy manifest added, ITSAppUsesNonExemptEncryption=false export
  compliance, docs/runbooks/testflight.md v1.
- Possibly in flight (check git status): further edits to docs/runbooks/testflight.md,
  ios/App/ExportOptions.plist, ios/App/App.xcodeproj/project.pbxproj. If dirty, review and
  finish them - they are YOUR lane's work.

REMAINING MISSION - take it to "installed via TestFlight on the founder's iPhone":

1. Finish + commit any in-flight hygiene/runbook work (pathspec commit, rules below).
2. Stray project cleanup (NEW): a blank Xcode template project sits at repo root in Lyra/
   (Lyra.xcodeproj + LyraTests + xcuserdata - a "File > New Project" accident, likely from
   Xcode's welcome screen). Confirm with the founder it holds nothing intentional, then
   delete it. The ONLY real project is ios/App/App.xcodeproj - say so loudly in the runbook
   so nobody opens the wrong one again.
3. Archive hygiene (NEW): make sure xcodebuild archive/export outputs land OUTSIDE the repo
   (use ~/Library or a build dir covered by ios/.gitignore). An .xcarchive committed to the
   public repo would leak signing metadata and bloat the tree - add an explicit gitignore
   entry if the current export path is inside the repo.
4. Signing (FOUNDER-GATED - prepare, then hand over): automatic signing configured in the
   project; give the founder exact click-steps: Xcode > Settings > Accounts > add Apple ID >
   select team under Signing & Capabilities for the App target. Never handle Apple
   credentials yourself.
5. App Store Connect (FOUNDER-GATED): exact click-steps to register bundle id
   com.vivacityai.lyra (developer.apple.com/account/resources/identifiers) and create the
   app record (appstoreconnect.apple.com > Apps > + > New App, SKU lyra-ios, name "Lyra",
   fallback "Lyra - Market Radar" if taken).
6. Archive + upload: first pass through Xcode GUI (Product > Archive > Distribute App >
   TestFlight), documented step-by-step in the runbook. Keep the CLI path (xcodebuild
   archive + -exportArchive with ExportOptions.plist) documented for repeatability. NO
   GitHub Actions automation yet - that needs an App Store Connect API key (founder decision).
7. TestFlight: internal-testing group "Lyra Beta", founder added; document inviting the
   friend by email. Internal testing needs NO Beta App Review.
8. Hand Lane C a simulator build path: document the one-liner to boot the app in the iOS
   simulator so the QA lane (prompt 3) can run its sweep without touching your files.
9. Runbook completeness bar: a fresh session must be able to ship build 2 from
   docs/runbooks/testflight.md alone.

FILE BOUNDARIES - HARD RULES:
- You OWN: ios/**, docs/runbooks/testflight.md, and the Lyra/ deletion (after founder
  confirmation). Nothing else.
- Do NOT touch: capacitor.config.ts, package.json, package-lock.json, native/, src/**,
  workers/** (coordinator owns config; Lane B owns web). If a task seems to need them,
  STOP and report back.
- SHARED TREE: other lanes commit concurrently. git status before starting and before
  every commit; dirty files you do not own = another lane's work - never add them. Commit
  ONLY with explicit pathspec: git commit -m "msg" -- <your files>. Never git add -A,
  never git stash. If origin moved, verify your dirty files are your own, then rebase.
- VERSIONING: ios/** and docs/** are NOT in the shippable set (src/supabase/workers/public);
  no version bump for your commits. If you believe you must touch src/**, stop - not your lane.
- Conventional commits; trailer exactly: Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
- Plain hyphens only - never em dashes. No secrets in chat, commits, or NEXT_PUBLIC_*.

VERIFICATION GATES:
- Simulator build green: xcodebuild -project ios/App/App.xcodeproj -scheme App
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
- xcodebuild archive succeeds once signing is configured (founder present).
- Runbook passes the fresh-session bar (step 9).

DEFINITION OF DONE: founder has the Lyra beta installed via TestFlight; runbook complete;
stray Lyra/ project resolved; archives provably outside git. Report founder-gated steps
clearly whenever blocked on one.
```
