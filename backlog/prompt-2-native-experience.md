# Prompt 2 - Lane B: Native Experience

Updated 2026-07-18 by the orchestrator after progress review. Paste the block below into a
fresh Claude Code session in this repo. A previous Lane B session built most of the work
but did NOT commit it - the first job is landing it properly, not redoing it.

```
You are Lane B: Native Experience for the Lyra iOS shell.

REPO: /Users/brysonwalter/Developer/vai-lyra-stock-tracker (Next.js 15 App Router, deploys to
Vercel prod at https://lyra.vivacityai.com.au). Read CLAUDE.md fully - especially the
Releasing section; your lane changes src/** so every shipped change MUST bump the version.

CONTEXT - the state of the world:
- A Capacitor 8 iOS remote shell exists (ios/, coordinator-owned capacitor.config.ts). The
  WKWebView loads PRODUCTION via server.url, so the code you ship to Vercel IS the iOS
  app's UI. Capacitor injects its bridge into the remote page: window.Capacitor exists
  inside the shell, undefined in normal browsers.
- The site is a tuned PWA: manifest.webmanifest, service-worker web push, 44px touch
  floors, viewport-fit=cover in src/app/layout.tsx.

ALREADY BUILT by a previous Lane B session - likely still UNCOMMITTED (verify with
git status; if a later session committed it, skip to what remains):
- src/lib/native/platform.ts, share.ts, external-links.ts + __tests__ for all three.
- src/components/native/ (new components dir).
- docs/product/native-app.md (Phase 2 APNs design doc).
- Safe-area / share / native-awareness edits across many components: AppShell,
  DetailDrawer, TickerDetail, ChatWidget, FeedbackWidget, ProductTour, RatingPrompt,
  AiOfferCard, InvestigationDrawerStack, PushNotificationSetup, AddToHomeScreenStep,
  AlertPreferencePanel, OnboardingShell, TrackRecordView, src/app/layout.tsx.

YOUR MISSION - land it, verify it, finish the tail:

1. Review the uncommitted work file by file (git diff). You are adopting it: understand
   every change before committing it. Anything broken or half-done, finish properly.
2. Verify the full gate set BEFORE committing: npm run type-check clean; npm run build
   passes; TZ=UTC npm test green (including the three new native test files);
   npm run lint clean.
3. Release flow (MANDATORY): check src/lib/version.ts is not dirty from another lane, then
   prepend a RELEASES entry (user-facing title about the app going native-ready), run
   npm run release, commit code + version + changelog with explicit pathspec, push.
4. Post-deploy prod verification: in a normal desktop browser, spot-check /welcome, a
   ticker page, and alerts - web behavior must be UNCHANGED (native paths invisible on web).
5. Simulator verification with Lane A's build (they owe you the boot one-liner): safe areas
   clear the notch/home indicator, external links open in Safari not the shell, the share
   sheet fires from a ticker page, no add-to-home-screen prompts inside the shell.
6. Remaining design-doc tail: docs/product/native-app.md must state clearly that web push
   does NOT fire inside WKWebView (Phase 2 = @capacitor/push-notifications + APNs channel
   type in notification_channels + server-side APNs sender in src/lib/notifications/), and
   which pieces are founder-gated (APNs key). Verify the previous session wrote this; fix
   gaps.

FILE BOUNDARIES - HARD RULES:
- You OWN: src/lib/native/**, src/components/native/**, docs/product/native-app.md, and
  the surgical component/layout edits listed above. List every touched file in commit
  messages.
- Do NOT touch: ios/** (Lane A), capacitor.config.ts, package.json, package-lock.json,
  native/ (coordinator). Do NOT add npm dependencies - if a Capacitor plugin seems
  required, STOP and report back (coordinator-only operation). Everything in scope needs
  zero new dependencies.
- SHARED TREE: git status before starting and before every commit; dirty files you do not
  own = another lane's work (Lane A is active in ios/ and docs/runbooks/) - never add
  them. Commit ONLY with explicit pathspec. Never git add -A, never git stash.
- Conventional commits; trailer exactly: Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
- Plain hyphens only - never em dashes. TS strict, no any. TanStack Query for data
  fetching. No secrets anywhere; nothing new in NEXT_PUBLIC_*.

VERIFICATION GATES (all before claiming done): the four commands in step 2, the prod
spot-check in step 4, and the simulator checks in step 5.

DEFINITION OF DONE: native module + component integration committed with a version bump
and live on prod; web behavior unchanged; simulator checks pass; Phase 2 push design
complete. Report which files you shipped and the version you cut.
```
