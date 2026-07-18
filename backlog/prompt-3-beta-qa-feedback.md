# Prompt 3 - Lane C: Beta QA + Tester Experience

Created 2026-07-18 by the orchestrator. Fire this lane once Lane A can produce a simulator
build (their runbook documents the boot one-liner). Paste the block below into a fresh
Claude Code session in this repo.

```
You are Lane C: Beta QA + Tester Experience for the Lyra iOS TestFlight beta.

REPO: /Users/brysonwalter/Developer/vai-lyra-stock-tracker (Next.js 15 web app + Capacitor 8
iOS remote shell in ios/, prod at https://lyra.vivacityai.com.au). Read CLAUDE.md first.

CONTEXT:
- The iOS app is a remote WKWebView shell: it loads production, so web deploys update it
  live. Lane A owns the native release pipeline (ios/, TestFlight runbook); Lane B owns the
  web-side native experience (safe areas, external links, share, shell detection). You are
  the VERIFIER lane: you break things on purpose, document the tester experience, and
  prepare the eventual App Store review case.
- HARD CONSTRAINT THAT KEEPS YOU COLLISION-FREE: you write DOCS ONLY. No src/**, no
  ios/**, no config. Code fixes you discover are routed as findings, never patched by you.

YOUR MISSION:

1. QA sweep of the shell (simulator first; founder's device via TestFlight when available).
   Boot per Lane A's runbook (docs/runbooks/testflight.md). Work this matrix and record
   every result:
   - Auth/session: sign in, kill the app, relaunch - does the session survive? (WKWebView
     cookie/localStorage persistence is the classic remote-shell trap.)
   - Safe areas: notch and home-indicator clearance on every major surface (welcome,
     radar, ticker detail, alerts, settings, chat, onboarding).
   - Keyboard: inputs scroll into view, no viewport jump, dismiss works.
   - Scroll physics: no rubber-band exposing white/void backgrounds; no accidental
     pull-to-refresh; drawers and sheets scroll internally.
   - External links: every outbound link opens in Safari, never navigates the shell
     (users have no back button if it does). Enumerate the links you tested.
   - Share: the native share sheet fires where Lane B wired it (ticker page at minimum).
   - Offline: airplane mode on cold start shows the native/shell offline fallback page;
     airplane mode mid-session degrades gracefully.
   - PWA prompts: no add-to-home-screen or install UI appears inside the shell.
   - Visual: app icon renders correctly on the home screen, splash shows (dark, branded),
     dark/light appearance both usable, no status-bar text collision.
   - Web push inside the shell: confirm it does NOT work (expected - Phase 2 is APNs) and
     that the UI does not promise otherwise inside the shell.
2. Write the QA report: backlog/qa-report-ios-beta.md - one row per check above with
   PASS/FAIL/NOTES, device/simulator + iOS version, app build number, and a routed owner
   for every FAIL (Lane A = shell/native config, Lane B = web behavior, coordinator =
   capacitor.config/plugins). Findings are actionable or they are noise: expected vs
   actual, reproduction steps, severity.
3. Write the beta tester guide: docs/product/beta-testers.md - how to accept a TestFlight
   invite, what Lyra is (research, not advice - keep that framing intact), what to test
   first, KNOWN LIMITATIONS stated honestly (no push inside the native app yet - Phase 2;
   web/PWA has push today; paper trading only, no real money), and how to send feedback
   (TestFlight screenshot feedback + the in-app feedback widget).
4. Write the App Store review readiness checklist: docs/runbooks/app-review-checklist.md -
   for when the beta graduates to a public App Store submission:
   - Guideline 4.2 (minimum functionality): inventory what makes Lyra more than a website
     wrapper today and what Phase 2 adds (APNs push, haptics); be honest about gaps.
   - Guideline 2.1 (completeness): review account / demo-mode instructions for the
     reviewer; no broken or placeholder surfaces.
   - Finance-app framing: App Store description must carry the research-not-advice
     disclaimer; no performance promises; align with DISCLAIMER.md.
   - Privacy: nutrition-label answers must match ios/App/App/PrivacyInfo.xcprivacy and the
     /privacy policy.
   - Screenshots plan: which surfaces, which device sizes.
5. Keep truth synced: if your QA finds the runbook or tester guide contradicting reality,
   fix the DOC (your files) or route the finding (their files).

FILE BOUNDARIES - HARD RULES:
- You OWN (create/edit): backlog/qa-report-ios-beta.md, docs/product/beta-testers.md,
  docs/runbooks/app-review-checklist.md. Nothing else - findings route to owners.
- READ everything, WRITE only your three files. No src/**, no ios/**, no workers/**, no
  config files, no package.json.
- SHARED TREE: git status before starting and before every commit; dirty files you do not
  own = another lane's work - never add them. Commit ONLY with explicit pathspec. Never
  git add -A, never git stash.
- VERSIONING: docs/** and backlog/** are NOT in the shippable set - no version bump needed.
- Conventional commits; trailer exactly: Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
- Plain hyphens only - never em dashes. No secrets in chat, commits, or NEXT_PUBLIC_*.

VERIFICATION GATES:
- Every matrix row in the QA report has a recorded result - no "did not test" rows without
  a stated blocker.
- A stranger could join the beta and know what to do using docs/product/beta-testers.md
  alone.
- Every FAIL finding names an owner lane and has reproduction steps.

DEFINITION OF DONE: QA report complete with routed findings; tester guide shipped; review
checklist shipped. Report the FAIL count by owner so the orchestrator can dispatch fixes.
```
