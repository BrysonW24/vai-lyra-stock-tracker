# Native App - iOS Shell + Phase 2 Push Design

Status: Phase 1 SHIPPED (shell-aware web experience) - Phase 2 is a DESIGN, not implemented.
Owner docs: `backlog/ios-testflight-agent-prompt-pack.md` (lane protocol), `docs/product/mobile-experience.md` (web mobile).

## Phase 1 - what shipped (the shell-aware web app)

The iOS app is a Capacitor 8 remote shell: the WKWebView loads production
(`https://lyra.vivacityai.com.au`), so every Vercel deploy updates the native app with no App
Store resubmission. The web app detects the shell through one module and adapts:

- `src/lib/native/platform.ts` - `isNativeShell()` / `useIsNativeShell()`. True only when
  `window.Capacitor.isNativePlatform()` is true. The ONLY sanctioned detection point.
- Safe areas: `viewport-fit=cover` plus `env(safe-area-inset-*)` padding on every fixed or
  sticky chrome surface (headers, drawers, sheets, toasts, tour card).
- External links escape the shell: `src/components/native/ExternalLinkBoundary.tsx` (mounted in
  the root layout) hands off-origin http(s) anchor clicks to `window.open`, which Capacitor
  routes to the system browser. Web behavior untouched - the listener attaches in-shell only.
- Share: `src/components/native/ShareButton.tsx` - `navigator.share` system sheet with
  clipboard fallback, on the ticker header and Track Record header.
- A2HS suppression: the onboarding "Add to Home Screen" beat renders an "already in the app"
  confirmation in-shell (never a silent skip), and the install copy in
  `PushNotificationSetup` / `AlertPreferencePanel` is replaced in-shell.

## Phase 2 - APNs push for the shell (DESIGN ONLY)

### The problem

Web push does NOT fire inside the WKWebView. The shell has no browser-level service worker
push subscription support - `PushManager` subscriptions made in Safari or the installed PWA
belong to those contexts, not to the app. So a shell user who enables "push" today gets
nothing on that device. Telegram / Slack / WhatsApp still work (server-side channels), which
is why the in-shell copy points at them. Native delivery on iOS means APNs.

### Design

**Client (shell) - `@capacitor/push-notifications` plugin.**

- Plugin install is the one forbidden cross-lane operation: it touches `package.json` AND the
  ios project (plus the Push Notifications capability / `aps-environment` entitlement).
  Coordinator executes it; Lane A rebuilds and reships the shell (this is a native change -
  the one kind that needs a new TestFlight build).
- Registration flow, gated on `isNativeShell()` inside the existing push settings surface
  (`PushNotificationSetup`): request permission via the plugin, receive the APNs device
  token, POST it to the existing channel-registration API.

**Storage - a new channel type in `notification_channels`.**

- Extend `ChannelType` (`src/lib/notifications/types.ts:9`) from
  `'push' | 'telegram' | 'whatsapp' | 'slack'` to include `'apns'`.
- One row per device: `channel_type='apns'`, `destination=<device token>`, `is_active=true`.
  The token is proof-of-device, so rows are born `is_verified=true` (unlike chat channels,
  which verify by round-trip). Token rotation: APNs may reissue tokens; the client re-POSTs
  on every launch and the API upserts by token, deactivating stale rows on APNs 410 feedback.
- The user-level preference stays the single `push` toggle - channel rows decide transport
  per device. A user with both a PWA web-push subscription and a shell APNs token gets one
  notification per DEVICE, not per transport: the dispatcher treats web-push subscriptions
  and APNs tokens as one device pool.

**Server - an APNs sender joining the dispatch layer.**

- New `src/lib/notifications/apns.ts` sender, sibling of `telegram.ts` / `slack.ts` /
  `whatsapp.ts`, called from `dispatchNotificationEvent` (`src/lib/notifications/dispatch.ts`)
  wherever the `push` channel delivers today (`src/lib/push/server.ts` stays the web-push leg).
- Zero new npm dependencies: token-based auth is an ES256 JWT signed with `node:crypto`
  (`createPrivateKey` + `sign`), and APNs' HTTP/2 requirement is met with `node:http2`.
  JWT reuse window: cache the provider token for 40-55 minutes (APNs rejects tokens older
  than 1 hour and refreshing more than every 20 minutes).
- Everything upstream is unchanged: the router's quiet hours, server-enforced Quiet mode,
  per-user rate cap, held-event release, and engagement tagging all apply to `apns` exactly
  as to every other channel - APNs is a delivery leg, not a new policy surface.
- Payload: standard `aps` alert (title/body from the existing push templates), `url` in
  custom data for deep-linking; the shell opens it through the plugin's action handler.

**Founder-gated (only the founder can do these):**

- Create the APNs Auth Key (.p8) in the Apple Developer portal (Keys > Apple Push
  Notifications service). One key serves sandbox + production.
- Provide secrets (server-side only, never `NEXT_PUBLIC_*`): `APNS_KEY_ID`, `APNS_TEAM_ID`,
  `APNS_PRIVATE_KEY` (p8 contents), `APNS_BUNDLE_ID=com.vivacityai.lyra`.
- Enable the Push Notifications capability on the App ID + approve the TestFlight rebuild.

### Rollout order

1. Coordinator: plugin install + `npx cap sync ios`; Lane A: entitlement + rebuild + upload.
2. Founder: APNs key + secrets.
3. Server: `apns` channel type + sender + upsert API (ships on the web release train,
   inert until tokens exist).
4. Shell registration UI behind `isNativeShell()` in `PushNotificationSetup`.
5. Wire into the nightly delivery sweep + `/notification-health` chain; add the `apns` leg
   to the notification type roster tests before it goes live (HARNESS rule: gates first).

### Non-goals for Phase 2

- No Android shell (no FCM) until the iOS beta proves the loop.
- No rich media / notification actions in v1 - alert + deep link only.
- No per-channel user preference UI - the `push` toggle stays the single control.
