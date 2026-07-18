# iOS TestFlight Beta - Agent Prompt Pack

Created 2026-07-18. Baseline commit `74582ba` (Capacitor 8 remote-shell scaffold on `main`).

## What this is

Two ready-to-paste prompts for parallel agent lanes driving the Lyra iOS TestFlight beta,
plus the coordination protocol between them. The coordinator lane (the session that authored
this pack) owns `capacitor.config.ts` and `package.json` and arbitrates any cross-lane
operation.

## Current state (verified at pack creation)

- Capacitor 8.4.2 iOS remote-shell scaffold committed: `ios/` Xcode project (Swift Package
  Manager, no CocoaPods), `capacitor.config.ts` with bundle id `com.vivacityai.lyra`,
  appName `Lyra`, `server.url https://lyra.vivacityai.com.au`.
- Remote-shell model: the WKWebView loads PRODUCTION - every Vercel deploy updates the
  native app instantly, no App Store resubmission for web changes.
- Lyra 1024px alpha-free app icon + dark branded splash installed in the asset catalog.
- Simulator build green: `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk
  iphonesimulator -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO`
- Apple Developer Program enrollment: DONE (founder's account).
- Custom domain `lyra.vivacityai.com.au` live with valid TLS, serving latest production.

## How to use

Open a fresh Claude Code session per lane in this repo and paste the corresponding prompt
verbatim. Lanes are file-disjoint by design and safe to run concurrently with each other and
with the coordinator. Lane A has founder-gated steps (Apple ID signing, App Store Connect);
Lane B rides the normal web release train.

---

## Prompt 1 - Lane A: iOS Release Pipeline

```
You are Lane A: iOS Release Pipeline for the Lyra TestFlight beta.

REPO: /Users/brysonwalter/Developer/vai-lyra-stock-tracker (public GitHub: BrysonW24/vai-lyra-stock-tracker,
auto-deploys to Vercel). Read CLAUDE.md fully before touching anything.

CONTEXT - what already exists (baseline commit 74582ba, pull before starting):
- Capacitor 8.4.2 iOS remote-shell scaffold is committed: ios/ Xcode project (Swift Package Manager,
  NO CocoaPods), capacitor.config.ts (bundle id com.vivacityai.lyra, appName Lyra, server.url
  https://lyra.vivacityai.com.au - the production web app IS the app; deploys update it live).
- Lyra 1024px alpha-free app icon + dark branded splash are installed in the asset catalog.
- Simulator build verified green: xcodebuild -project ios/App/App.xcodeproj -scheme App
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
- Apple Developer Program enrollment is DONE (founder's account).

YOUR MISSION: take the shell from "builds in simulator" to "installable on the founder's iPhone via
TestFlight invite." Work top to bottom:

1. Project hygiene (ios/App/App/Info.plist + project.pbxproj):
   - CFBundleDisplayName "Lyra"; MARKETING_VERSION 1.0.0; CURRENT_PROJECT_VERSION 1.
   - Add ITSAppUsesNonExemptEncryption=false (standard HTTPS only - skips the export-compliance
     questionnaire on every upload).
   - Add a PrivacyInfo.xcprivacy privacy manifest: no tracking, no tracking domains, collected data
     types = none (the shell itself collects nothing; the website has its own privacy policy at
     /privacy). Declare required-reason APIs only if the build complains.
   - TARGETED_DEVICE_FAMILY = 1 (iPhone-only for the beta; iPad later).
   - App category: Finance.
2. Signing (FOUNDER-GATED - prepare, then hand over): configure automatic signing in the project,
   then give the founder exact click-steps: Xcode > Settings > Accounts > add Apple ID > select team
   in Signing & Capabilities. Never ask for or handle Apple credentials yourself.
3. App Store Connect (FOUNDER-GATED): give exact click-steps to create the app record: appstoreconnect.apple.com
   > Apps > + > New App > platform iOS, bundle ID com.vivacityai.lyra (register it at
   developer.apple.com/account/resources/identifiers first if not offered), SKU lyra-ios, name "Lyra"
   (have "Lyra - Market Radar" ready as fallback if the name is taken).
4. Archive + upload: first pass goes through Xcode GUI (Product > Archive > Distribute App > TestFlight),
   documented step-by-step. Also script the CLI path (xcodebuild archive + -exportArchive with
   method app-store-connect) into docs/runbooks/testflight.md for repeatability. Do NOT build GitHub
   Actions automation yet - that needs an App Store Connect API key, which is a founder decision.
5. TestFlight: internal-testing group "Lyra Beta", add the founder; document how to invite the friend
   by email. Internal testing needs NO Beta App Review - build is testable minutes after processing.
6. Write docs/runbooks/testflight.md capturing ALL of the above: prerequisites, founder-gated steps,
   the archive/upload procedure, and how to ship an update (spoiler: web changes need NO new build;
   only shell/icon/plugin changes do).

FILE BOUNDARIES - HARD RULES:
- You OWN: ios/** and docs/runbooks/testflight.md. Nothing else.
- Do NOT touch: capacitor.config.ts, package.json, package-lock.json, native/, src/**, workers/**
  (coordinator lane owns config; Lane B owns web). If a task seems to need them, STOP and report back.
- SHARED TREE: other agent lanes commit to this tree concurrently. Before starting and before every
  commit run git status; any dirty file you don't own belongs to another lane - NEVER add it. Commit
  ONLY with explicit pathspec: git commit -m "msg" -- <your files>. Never bare git add -A, never
  git stash. If origin moved, verify your dirty files are only your own, then rebase.
- VERSIONING: ios/** and docs/** are NOT in the shippable set (src/supabase/workers/public), so no
  version bump is required for your commits. If you ever believe you must touch src/**, stop - that
  requires the release flow and it is not your lane.
- Conventional commits; message trailer exactly: Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
- Plain hyphens only in all copy - never em dashes. No secrets in chat, commits, or NEXT_PUBLIC_*.

VERIFICATION GATES (all must pass before you claim done):
- Simulator build still green (command above).
- xcodebuild archive succeeds locally once signing is configured (founder present for that step).
- docs/runbooks/testflight.md is complete enough that a fresh session could ship build 2 from it alone.

DEFINITION OF DONE: founder has the Lyra beta on their iPhone via TestFlight, and the runbook exists.
Report progress concisely; list founder-gated steps clearly whenever you are blocked on one.
```

---

## Prompt 2 - Lane B: Native Experience

```
You are Lane B: Native Experience for the Lyra iOS shell.

REPO: /Users/brysonwalter/Developer/vai-lyra-stock-tracker (Next.js 15 App Router, deploys to Vercel
prod at https://lyra.vivacityai.com.au). Read CLAUDE.md fully before touching anything - especially
the Releasing section; YOUR lane changes src/** so every shipped change MUST bump the version.

CONTEXT (baseline commit 74582ba, pull before starting):
- A Capacitor 8 iOS shell now exists (ios/, coordinator-owned capacitor.config.ts). It is a
  remote shell: WKWebView loads the PRODUCTION website via server.url. So the code you ship to
  Vercel IS the iOS app's UI. Capacitor injects its JS bridge into the remote page, so
  window.Capacitor exists inside the shell and is undefined in normal browsers.
- The site is already a tuned PWA: manifest.webmanifest, service worker web push, 44px touch floors,
  viewport metadata in src/app/layout.tsx.

YOUR MISSION: make lyra.vivacityai.com.au feel first-class inside the native shell while remaining
byte-identical in behavior for normal web visitors. Ship in this order:

1. src/lib/native/platform.ts - the ONE detection module everything else imports:
   isNativeShell(): boolean - true only when window.Capacitor?.isNativePlatform?.() === true.
   Must be SSR-safe (typeof window guard), zero dependencies, and export a useIsNativeShell() hook
   (client-side, no hydration mismatch - return false on first render, update in effect).
   Unit tests required (Vitest, TZ=UTC npm test must stay green).
2. Safe-area audit: the shell renders edge-to-edge; verify env(safe-area-inset-*) padding on the
   app chrome (header/footer/sticky elements) so content clears the iPhone notch/home indicator.
   The viewport already has viewport-fit=cover - your job is making sure every fixed/sticky surface
   respects the insets. Test in Xcode simulator (Lane A can build you one) or Safari responsive mode.
3. External-link hygiene inside the shell: links leaving the app's origin must NOT navigate the
   WKWebView (users get trapped - no browser chrome, no back button). In-shell, intercept external
   navigations and hand them to window.open (Capacitor routes these to the system browser).
   Web behavior unchanged.
4. Native share: use the Web Share API (navigator.share - it works inside WKWebView and iOS Safari,
   zero plugins needed) to add share affordances where they earn their place: share a ticker page,
   share a proof/report link. Feature-detect; hide the affordance where unsupported (desktop Chrome
   on some platforms). Match the existing dense UI style - no new visual language.
5. In-shell PWA-prompt suppression: if any "install this app / add to home screen" UI exists, it must
   not render inside the native shell (isNativeShell() check).
6. docs/product/native-app.md - write the Phase 2 design doc (design ONLY, do not implement):
   APNs push for the shell. Key facts to capture: web push does NOT fire inside WKWebView; Phase 2 =
   @capacitor/push-notifications plugin + APNs token registered into the existing
   notification_channels table as a new channel type, and a server-side APNs sender joining the
   dispatch layer in src/lib/notifications/. Note which pieces are founder-gated (APNs key in the
   Apple Developer portal).

FILE BOUNDARIES - HARD RULES:
- You OWN: src/lib/native/**, docs/product/native-app.md, and surgical edits to existing src
  components/layout for safe-area, links, share, and prompt-suppression. Keep edits minimal and
  scoped; list every touched file in your commit messages.
- Do NOT touch: ios/** (Lane A), capacitor.config.ts, package.json, package-lock.json, native/
  (coordinator). Do NOT add npm dependencies - if you believe a Capacitor plugin is required, STOP
  and report back; plugin installs are a coordinated cross-lane operation (they touch package.json
  AND the ios project). Everything in your scope is achievable with zero new dependencies.
- SHARED TREE: other lanes commit concurrently. git status before starting and before every commit;
  dirty files you don't own = another lane's work - never add them. Commit ONLY with explicit
  pathspec (git commit -m "msg" -- <files>). Never git add -A, never git stash.
- VERSIONING (MANDATORY for you): your changes are in src/** = shippable. Before pushing: prepend an
  entry to RELEASES in src/lib/version.ts, run npm run release, commit. The pre-push hook blocks you
  otherwise. Check src/lib/version.ts is not dirty from another lane before editing it.
- Conventional commits; trailer exactly: Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
- Plain hyphens only - never em dashes, anywhere. TS strict, no any. TanStack Query for data fetching.
  No secrets anywhere; nothing new in NEXT_PUBLIC_*.

VERIFICATION GATES (all before claiming done):
- npm run type-check clean; npm run build passes; TZ=UTC npm test green including your new tests.
- npm run lint clean.
- Prod verification after Vercel deploys: site behavior unchanged in a normal browser (spot-check
  /welcome, a ticker page, alerts) - your native paths must be invisible on the web.

DEFINITION OF DONE: shell-aware platform module tested and shipped, safe-areas correct, external
links escape the shell, share works, Phase 2 push design documented, version bumped and live on prod.
```

---

## Coordination protocol

- **Lane A never blocks on Lane B.** A works `ios/` + founder click-steps; B rides the web
  release train - the remote shell picks up B's work on every Vercel deploy with no rebuild.
- **The one forbidden cross-lane operation:** installing a Capacitor plugin (touches
  `package.json` AND the ios project). Both prompts route it back to the coordinator.
- **Coordinator owns:** `capacitor.config.ts`, `package.json`, `package-lock.json`,
  `native/`, merge-order arbitration, and `npx cap sync ios` when config changes.
- **Founder-gated steps (only the founder can do these):** Xcode Apple ID sign-in + team
  selection; App Store Connect app-record creation; the actual TestFlight upload approval;
  any App Store Connect API key creation; the Phase 2 APNs key.
