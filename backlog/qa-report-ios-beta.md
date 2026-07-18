# QA Report - Lyra iOS Beta (Lane C sweep 1)

Date: 2026-07-18. Environment: iPhone 17 Pro simulator (Xcode 26.6 SDK), Debug build,
unsigned, built from the working tree at ~68fc80a with Lanes A/B work in flight. App
launched via simctl; visual evidence captured as simulator screenshots (session scratchpad,
not committed). Interaction rows (tap/type) cannot be executed by the agent harness -
those are BLOCKED with the blocker stated and routed to the founder's first TestFlight
device session, which the tester guide's "what to test first" list covers one for one.

## Verdict

The remote-shell architecture is PROVEN: the app loads production and shows a version cut
AFTER this binary was built (v0.69.1), demonstrating the no-resubmission update property
live. Two real findings (1 cosmetic, 1 config gap), zero crashes, zero blockers to
continuing the TestFlight path.

## Matrix

| # | Check | Result | Evidence / notes | Owner |
|---|---|---|---|---|
| 1 | Remote shell loads production | PASS | Welcome page rendered with live content; version badge v0.69.1 + 18 Jul 2026 | - |
| 2 | Auto-update property | PASS | v0.69.1 was released after this binary was built - the shell shows it with no rebuild | - |
| 3 | App icon on home screen | PASS | Lyra gradient icon renders correctly, label "Lyra" | - |
| 4 | Splash assets | PARTIAL | Dark branded splash installed in asset catalog and build green; the launch frame itself was not captured mid-animation - eyeball on first device launch | founder device pass |
| 5 | Safe areas, launched surface (light) | PASS | No notch/status-bar collision on welcome; content insets correctly | - |
| 6 | Status bar legibility (light) | PASS | Dark text on light band, readable | - |
| 7 | Dark mode appearance | FAIL (cosmetic) | Native chrome goes black while the page stays light (Lyra is a light-only design) - harsh seam at the status bar. Fix: pin the shell to light appearance (UIUserInterfaceStyle = Light in Info.plist) so the chrome always matches the light-only web app | Lane A |
| 8 | Offline fallback | FAIL (config gap) | The offline page DOES ship in the app bundle (public/index.html, verified in the built .app), but Capacitor remote shells do not serve webDir on load failure automatically - server.errorPath is not set in capacitor.config.ts, so a cold start without network shows the default WKWebView error instead of the branded page | coordinator |
| 9 | External links escape the shell | CODE-VERIFIED | Two independent layers: Capacitor 8 natively ejects off-app navigations + Lane B's resolveExternalHref module (unit-tested) routes external http(s) to window.open. Runtime tap-through owed on device | Lane B (runtime confirm) |
| 10 | Native share sheet | CODE-VERIFIED | Web Share API with capability gating and clipboard fallback; Lane B's own comment correctly notes navigator.share in WKWebView must be confirmed on a real device - if absent, the affordance hides coherently | founder device pass |
| 11 | Session persistence across relaunch | EXPECTED-PASS | WKWebView uses the default persistent data store (cookies + localStorage survive relaunch by architecture). BLOCKED for runtime proof: agent cannot complete an interactive sign-in | founder device pass |
| 12 | Keyboard behavior | BLOCKED | simctl cannot tap/type; needs a human. On the device pass: focus an input on auth + chat, confirm scroll-into-view and dismiss | founder device pass |
| 13 | Scroll physics / rubber-band / pull-to-refresh | BLOCKED | Same interaction blocker. Watch for void backgrounds on over-scroll and accidental pull-to-refresh | founder device pass |
| 14 | PWA install prompts suppressed in shell | CODE-PENDING | Lane B edited AddToHomeScreenStep + PushNotificationSetup for shell awareness but the work is uncommitted - re-verify this row after Lane B lands and deploys | Lane B |
| 15 | Web push inside the shell | CONFIRMED-ABSENT (expected) | Web push does not fire inside WKWebView - this is the designed Phase 2 gap (APNs, docs/product/native-app.md). Row 14's components must not promise push inside the shell | Lane B (same deploy) |

## FAIL count by owner

- Lane A: 1 - pin light appearance (one Info.plist key)
- Coordinator: 1 - add server.errorPath to capacitor.config.ts + cap sync (then rows 8 re-tests)
- Lane B: 0 FAILs; 2 runtime confirmations ride their upcoming deploy (rows 9, 14/15)
- Founder device pass: rows 4, 10, 11, 12, 13 - all covered by the tester guide's checklist

## Companion docs shipped with this report

- docs/product/beta-testers.md - the tester guide (join, what to test, known limitations,
  feedback channels)
- docs/runbooks/app-review-checklist.md - App Store review readiness for when the beta
  graduates (4.2 risk stated honestly; privacy labels must match PrivacyInfo.xcprivacy;
  in-app account deletion flagged as a hard verify)
