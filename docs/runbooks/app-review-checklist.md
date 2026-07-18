# App Store review readiness checklist - Lyra iOS

For when the Lyra iOS beta graduates from TestFlight internal testing to a public App Store
submission. TestFlight internal builds skip App Review entirely; a public submission gets the
full review, so every item below must hold before pressing "Submit for Review". Companion
runbook: `docs/runbooks/testflight.md` (build + upload mechanics). Bundle id
`com.vivacityai.lyra`, category Finance, remote WKWebView shell loading
`https://lyra.vivacityai.com.au`.

## 1. Guideline 4.2 - minimum functionality (the thin-wrapper risk)

Honest assessment first: Lyra today is a remote shell with NO native capabilities wired in.
That carries real 4.2 rejection risk - "your app is a repackaged website" is the classic
verdict for Capacitor/WebView apps. Internal TestFlight never tested this gate; public
review will. Strengthen the case before submitting, and be ready to appeal with the list of
app-specific behaviour below.

What makes Lyra more than the website today:

- [ ] Installed-app experience verified: full-screen WKWebView, no browser chrome, correct
      safe-area insets (`contentInset: 'automatic'`), app icon + splash present.
- [ ] Offline fallback page (`native/shell/`) loads when the device has no network - a plain
      Safari tab cannot do this. Verify on a device in airplane mode.
- [ ] Native share integration works from the web app (share sheet, not a copy-link fallback).
- [ ] Dense mobile-tuned UI: confirm the radar, ticker detail, and alerts surfaces are
      genuinely usable one-handed on a small phone, not a shrunk desktop layout.

What strengthens the 4.2 case before public submission (each is a native build + web change):

- [ ] Native APNs push notifications (Phase 2) - the single strongest 4.2 differentiator for
      an alerts product. Strongly consider landing this BEFORE public submission.
- [ ] Haptics on key interactions (alert fire, watchlist add, pull-to-refresh).
- [ ] Home Screen quick actions / app shortcuts (e.g. "Open Radar", "My Watchlist").
- [ ] FOUNDER DECISION: submit now and accept the 4.2 risk, or hold public submission until
      the APNs wave ships. Record the call and the reasoning here before proceeding.

## 2. Guideline 2.1 - app completeness

- [ ] Every surface a reviewer can reach works: overview, radar, ticker detail, alerts,
      settings, onboarding, `/privacy`, `/whats-new`. Click through all of them in the shell,
      not the browser.
- [ ] Cold start without network does not crash - the offline fallback page appears, and the
      app recovers when connectivity returns. Verify on a physical device.
- [ ] No placeholder screens, dead links, "coming soon" stubs, or debug UI anywhere a
      reviewer can tap.
- [ ] Production is healthy at submission time: `https://lyra.vivacityai.com.au/api/health`
      is green. A prod outage during review is an automatic rejection.
- [ ] Demo/review account prepared and pasted into the App Store Connect "App Review
      Information" notes field: sign-in credentials (or a note that demo mode needs no
      account), plus 3-4 sentences explaining the reviewer path (open radar, tap a ticker,
      view score breakdown, check alerts).
- [ ] Review notes explicitly state: paper trading only, no real money, no brokerage
      connection, research-not-advice. Pre-empting the finance questions shortens review.

## 3. Finance-app framing - guidelines 3.1.5 / 2.3

- [ ] App Store description presents Lyra as research/education software, never advice.
      Every claim must be defensible against `DISCLAIMER.md` - if the disclaimer would not
      support a sentence, cut it.
- [ ] Zero performance or profit claims anywhere in metadata or screenshots: no "beat the
      market", no returns figures, no "winning trades" framing.
- [ ] Paper trading is clearly labelled as simulated in the app AND in any screenshot that
      shows it. A reviewer must never mistake it for live money.
- [ ] The app does not place trades, hold funds, or connect to brokerage accounts - and the
      description says so.
- [ ] Screenshots show research surfaces (scores, indicators, watchlist), not anything that
      resembles order entry or account funding.
- [ ] Disclaimer is reachable inside the app (settings or footer link), matching the
      "research, not advice" line in the description.

## 4. Privacy - nutrition labels, manifest, and account deletion

- [ ] The App Store privacy questionnaire (nutrition labels) is answered for the FULL app
      experience, not just the shell. `PrivacyInfo.xcprivacy` correctly declares the shell
      collects nothing, but Apple's questionnaire covers data collected through the web
      content too. Per `PRIVACY.md` live mode collects: email + display name (account),
      preferences, portfolio/watchlist entries, and optional alert destinations - declare
      these as collected, linked to identity, NOT used for tracking.
- [ ] Analytics declared correctly: Vercel Web Analytics is anonymous and aggregate - map to
      non-identifying usage data, no tracking, no third-party advertising.
- [ ] The questionnaire, `ios/App/App/PrivacyInfo.xcprivacy`, and the live `/privacy` page
      tell the SAME story. Any mismatch between the three is a rejection vector - reconcile
      before submission, updating whichever surface is stale.
- [ ] Privacy policy URL field points at `https://lyra.vivacityai.com.au/privacy` and that
      page is live and current.
- [ ] Guideline 5.1.1(v) account deletion: accounts can be created in-app (live mode), so
      account DELETION must be reachable in-app. `PRIVACY.md` promises cascading deletion -
      verify the web app actually exposes a working delete-account control in settings, and
      exercise it end to end on a throwaway account. If it is missing or broken, this is a
      hard blocker: fix the web app before submitting.

## 5. Metadata plan

- [ ] App name: `Lyra` (fallback `Lyra - Market Radar` if taken - see the TestFlight
      runbook; Home Screen display name stays "Lyra" either way).
- [ ] Subtitle (30 chars): e.g. "Stock research radar". FOUNDER DECISION on final wording -
      must stay research-framed, no advice or profit language.
- [ ] Keywords (100 chars): stocks, momentum, RSI, MACD, watchlist, research, paper trading,
      market scanner. No competitor names, no "advice", no "invest and earn" phrasing.
- [ ] Support URL: a page that offers a real contact path. FOUNDER DECISION: dedicated
      support/contact page on lyra.vivacityai.com.au vs the public GitHub repo issues page.
- [ ] Marketing URL: `https://lyra.vivacityai.com.au`.
- [ ] Category: Finance (primary). No secondary category needed.
- [ ] Age rating questionnaire: answer honestly - no gambling, no unrestricted web access
      claims beyond the app's own content, expect a low rating (4+/9+). "Simulated
      gambling" is NO - paper trading is not gambling, but read each question carefully.
- [ ] Screenshots captured from the shell on-device for the surfaces: welcome/onboarding,
      radar, ticker detail, alerts. Required device sizes as of 2026: 6.9 inch and 6.5 inch
      iPhone at minimum - capture on matching simulators or devices, verify no simulated-
      money ambiguity and no debug UI in any frame.
- [ ] What's New text for 1.0 written, research-framed, matching the `/whats-new` changelog.

## 6. Pre-submission smoke

- [ ] Fresh build uploaded and installed via TestFlight on a physical iPhone (not just
      simulator) - the exact build number that will be submitted.
- [ ] Cold-start test: force-quit, relaunch, confirm load under 5 seconds on real network.
- [ ] Cold-start test without network: airplane mode, relaunch, offline fallback appears,
      recovery on reconnect.
- [ ] Reviewer-path walkthrough executed start to finish using ONLY the review-notes
      instructions, on the review account, by someone (or a session) with no prior context.
- [ ] Export compliance already declared: `ITSAppUsesNonExemptEncryption = false` in
      Info.plist (standard HTTPS only) - confirm it is still present in the submitted build.
- [ ] Build number unique and marketing version correct (`MARKETING_VERSION` /
      `CURRENT_PROJECT_VERSION` - see the TestFlight runbook decision table).
- [ ] Prod deploy freeze during the review window agreed: no risky web deploys while a
      reviewer may be inside the app - the shell loads production live.
