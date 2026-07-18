# TestFlight runbook - Lyra iOS beta

How to get the Lyra iOS shell from this repo onto iPhones via TestFlight, and how to ship
every build after the first. Written so a fresh session (or the founder alone) can ship
build 2 from this document with no other context.

## Architecture in one paragraph

The iOS app is a Capacitor 8 **remote shell**: a thin WKWebView that loads production
(`https://lyra.vivacityai.com.au`, set in `capacitor.config.ts` > `server.url`). The web
app IS the iOS app. Consequences:

- **Web changes need NO new iOS build.** Every Vercel deploy updates the app instantly.
- **A new native build is only needed when the shell itself changes:** app icon, splash,
  Info.plist, entitlements, Capacitor version/plugins, `capacitor.config.ts` (after
  `npx cap sync ios` - coordinator-owned, see `backlog/ios-testflight-agent-prompt-pack.md`).

## Current state (what is already done in the repo)

- `ios/App/App.xcodeproj` - Xcode project, Swift Package Manager (NO CocoaPods; ignore any
  `pod install` advice online).
- Bundle id `com.vivacityai.lyra`, display name Lyra, `MARKETING_VERSION 1.0.0`,
  `CURRENT_PROJECT_VERSION 1`, iPhone-only (`TARGETED_DEVICE_FAMILY = 1`), category Finance.
- `ITSAppUsesNonExemptEncryption = false` in Info.plist (standard HTTPS only) - the
  export-compliance questionnaire is answered automatically on every upload.
- `ios/App/App/PrivacyInfo.xcprivacy` - privacy manifest: no tracking, no collected data
  (the shell collects nothing; the website has its own policy at `/privacy`).
- `ios/App/ExportOptions.plist` - CLI export config (App Store Connect upload, automatic
  signing).
- 1024px alpha-free app icon + dark splash in `ios/App/App/Assets.xcassets`.
- Automatic signing is configured with the team baked in (`DEVELOPMENT_TEAM = NJ2U92XAJB`,
  mirrored as `teamID` in ExportOptions.plist). The Apple ID still has to be signed into
  Xcode once (founder-gated, below) so the signing certificate can be minted.
- Sanity check any time:
  `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO`

## One-time founder setup (nobody else can do these)

### 1. Sign into Xcode and pick the team

1. Xcode > Settings (Cmd-,) > Accounts > `+` > Apple Account > sign in with the Apple ID
   enrolled in the Apple Developer Program.
2. Open `ios/App/App.xcodeproj`, select the blue App project icon in the sidebar, then the
   App TARGET > Signing & Capabilities tab.
3. Tick "Automatically manage signing" (should already be on). The team (NJ2U92XAJB) is
   already set in the project; once the account is added, Xcode mints the signing
   certificate on its own.
4. The App ID `com.vivacityai.lyra` is registered in the developer portal (done
   2026-07-18, explicit bundle id, description "Lyra"). If the planned APNs push wave
   lands, its Push Notifications capability is toggled on that same portal page:
   developer.apple.com/account/resources/identifiers.

### 2. Create the App Store Connect app record

1. appstoreconnect.apple.com > Apps > `+` > New App.
2. DONE 2026-07-18: the app record is `Lyra - Market Scanner` (plain "Lyra" was taken),
   platform iOS, bundle ID `com.vivacityai.lyra`, primary language English (Australia).
3. That is all TestFlight needs. The App Store product page (screenshots, description,
   review notes, "Add for Review") is only for a PUBLIC App Store release - ignore the
   whole "Prepare for Submission" page while beta testing.

## First upload - Xcode GUI (recommended for build 1)

1. Open `ios/App/App.xcodeproj` in Xcode.
2. Top device selector: choose "Any iOS Device (arm64)" - Archive is disabled while a
   simulator is selected.
3. Product > Archive. Wait for the build; the Organizer window opens with the archive.
4. Click "Distribute App" > "TestFlight & App Store" (older Xcode: App Store Connect >
   Upload) > accept the defaults (automatic signing, upload symbols) > Upload.
5. Watch for "Upload Successful". Processing in App Store Connect takes 5-15 minutes;
   you get an email when the build is ready. No export-compliance popup appears because
   Info.plist already answers it.

## Repeat uploads - CLI (build 2 and onward)

From the repo root, with the Apple ID signed into Xcode (auth is reused):

```bash
# 1. Bump the build number - EVERY upload needs a unique CURRENT_PROJECT_VERSION.
#    Edit ios/App/App.xcodeproj/project.pbxproj: CURRENT_PROJECT_VERSION appears twice
#    (Debug + Release) - increment both, keep them identical. Bump MARKETING_VERSION
#    (also twice) only when you want testers to see a new version number.

# 2. Archive (signs with the selected team; -allowProvisioningUpdates lets xcodebuild
#    refresh profiles non-interactively).
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS' \
  -archivePath ios/App/build/App.xcarchive \
  archive -allowProvisioningUpdates

# 3. Export + upload to App Store Connect in one step.
xcodebuild -exportArchive \
  -archivePath ios/App/build/App.xcarchive \
  -exportOptionsPlist ios/App/ExportOptions.plist \
  -exportPath ios/App/build/export \
  -allowProvisioningUpdates
```

Notes:

- `ios/App/build/` is gitignored scratch output (`ios/.gitignore` > `App/build`); safe to
  delete any time.
- If export fails asking for a team, add `teamID` to `ios/App/ExportOptions.plist` (the
  comment in that file says where to find the value).
- Headless variant (PROVEN on build 2, 2026-07-18): an App Store Connect API key exists
  (name `app-store-api-key`, Key ID `G9WM65LW7V`, Admin access; key IDs are identifiers,
  not secrets). The one-and-only .p8 lives at
  `~/.appstoreconnect/private_keys/AuthKey_G9WM65LW7V.p8` (chmod 600; Apple never
  re-issues it - if the Mac is lost, revoke and mint a new key). Append to the
  exportArchive command:
  `-authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_G9WM65LW7V.p8
  -authenticationKeyID G9WM65LW7V
  -authenticationKeyIssuerID 6c4498c0-f83e-4828-828c-f12a5f5fd156`
  This removes the signed-into-Xcode requirement entirely. Still do NOT wire it into
  GitHub Actions without the founder explicitly deciding to put the .p8 in repo secrets.

## TestFlight distribution

1. appstoreconnect.apple.com > Apps > Lyra > TestFlight tab. The uploaded build appears
   under iOS builds once processing finishes.
2. Internal Testing > `+` > create group `Lyra Beta`. Enable "Automatic Distribution" so
   every new build reaches the group without re-adding it.
3. Add the founder: the group's Testers `+` lists App Store Connect users - add yourself.
   Accept the email invite on the iPhone, install TestFlight from the App Store, tap
   Redeem/Install. Builds are testable MINUTES after processing - internal testing needs
   NO Beta App Review.
4. Inviting a friend by email - two options:
   - **External tester (recommended):** TestFlight tab > External Testing > `+` group
     (e.g. `Friends`), add tester by email, add the build. The FIRST build in an external
     group needs Beta App Review (~24h, one-off per version; paper-trading research-only
     framing passes fine). After approval the friend gets the standard TestFlight email.
     Up to 10,000 external testers; no App Store Connect access granted.
   - **Internal tester (instant, but heavier):** Users and Access > `+` invite them to App
     Store Connect (role Developer or Marketing), then add them to `Lyra Beta`. No review
     wait, but they become a member of your App Store Connect team - only for people you
     trust with that.

## Shipping an update - decision table

| What changed | What to do |
| --- | --- |
| Anything in `src/`, `public/`, web copy, features | Nothing. Vercel deploy already updated the app. |
| App icon, splash, Info.plist, entitlements | Bump `CURRENT_PROJECT_VERSION`, archive + upload (CLI above), build auto-distributes to internal group. |
| `capacitor.config.ts` (coordinator-owned) | Coordinator runs `npx cap sync ios`, then bump + archive + upload. |
| New Capacitor plugin | Cross-lane operation (package.json + ios project) - route through the coordinator lane, then bump + archive + upload. |
| Apple Developer membership lapses | Renew at developer.apple.com; TestFlight builds expire 90 days after upload regardless - upload a fresh build at least quarterly. |

## Troubleshooting

- **"No signing certificate" / "No profiles for com.vivacityai.lyra"**: the Apple ID is
  not signed into Xcode or no team is selected - redo One-time founder setup step 1.
  For CLI builds, `-allowProvisioningUpdates` must be present.
- **"Your team has no devices from which to generate a provisioning profile"**: a fresh
  team has zero registered devices and DEVELOPMENT profiles need at least one (hit on
  build 1). Fix: plug an iPhone into the Mac (Developer Mode on: Settings > Privacy &
  Security), then build once TO that device to auto-register it:
  `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'id=<device-udid>'
  build -allowProvisioningUpdates -allowProvisioningDeviceRegistration`
  (UDID via `xcrun xctrace list devices`). Or register the UDID by hand at
  developer.apple.com/account/resources/devices. Then re-run the archive.
- **"0 valid identities found"** from `security find-identity -v -p codesigning`: same
  cause - certificates are minted when a team is first selected in Xcode.
- **Upload rejected: bundle version already used**: `CURRENT_PROJECT_VERSION` was not
  bumped - increment both occurrences in project.pbxproj and re-archive.
- **App name "Lyra" taken in App Store Connect**: use `Lyra - Market Radar` (the app
  record name is user-facing on TestFlight; CFBundleDisplayName on the Home Screen
  stays "Lyra" either way).
- **Build missing from TestFlight tab**: still processing (5-15 min), or check the email
  for an "issues found" notice - the common ones (encryption questionnaire, privacy
  manifest) are pre-answered in this repo.
- **Archive greyed out in Xcode**: device selector is on a simulator - switch to
  "Any iOS Device (arm64)".
- **White screen on launch in TestFlight**: the shell loads production - check
  `https://lyra.vivacityai.com.au/api/health` first; a prod outage IS an app outage.
