# Get Lyra alerts on your phone - urgent pings + hourly summaries

By the end of this walkthrough your phone buzzes when the scanner finds a strong setup, when a
signal it previously flagged falls apart, or when a holding or watchlist stock moves through a
threshold you care about. Everything arrives at most once per hourly scan, gated by your quiet
hours and per-type toggles.

This builds on [walkthrough 3 - Go live with Supabase](./03-go-live-supabase.md). You need live
mode working (your own Supabase, the scanner runs, you can sign in) before alerts have anything
to say.

Three channels, three very different maturity levels - this doc is honest about each:

| Channel | Status today | What you need |
|---|---|---|
| Web push (browser / iPhone Home Screen) | Works today | Two generated keys, no phone number, no third-party account |
| Telegram | Works today - the recommended phone channel | A free bot from BotFather (2 minutes) |
| WhatsApp | Architecture only - do not rely on it | A verified Meta Business account + template approval (days of Meta process) |

Lyra is research tooling, not financial advice. An alert is a structured observation ("this
score crossed 75"), never a recommendation to buy or sell. Every message the system sends ends
with a disclaimer saying exactly that - see `RESEARCH_SUFFIX` in
`src/lib/notifications/templates.ts` and the "Not financial advice." footer in
`workers/stock_scanner/telegram.py`.

Back to the index: [README.md](./README.md).

## Step 1 - understand what Lyra can send, and when

The Python scanner (`workers/stock_scanner/`) runs hourly via GitHub Actions
(`.github/workflows/hourly-stock-scanner.yml`, cron `5 * * * *` UTC, with a US market-hours
guard). After each scan it decides whether anything is alert-worthy. The decision logic lives in
`workers/stock_scanner/alert_engine.py`:

| Alert type | Fires when | Cooldown* |
|---|---|---|
| `strong_setup` | A ticker's score crosses `ALERT_SCORE_THRESHOLD` (default 75) and it was not already a strong setup | 6h per symbol |
| `signal_invalidated` | A previously-flagged setup falls below the watchlist threshold - the "this stopped working" ping | 6h |
| `score_jump` | The score jumps by at least `SIGNAL_CHANGE_THRESHOLD` (default 8) in one scan | 6h |
| `watchlist_upgrade` | A ticker enters watchlist-setup territory (score >= 60) - only when `ENABLE_WATCHLIST_ALERTS=true` | 12h |
| `portfolio_risk` | A holding you entered in the app enters `invalidated`, `elevated_risk`, or `overextended` | 6h |
| `portfolio_price_move_*` / `watchlist_price_move_*` | A holding or watchlist item crosses a +/-5%, 10%, or 15% move from its cost basis / add-time price | once per threshold |

\* The hour-based cooldowns are enforced on the legacy single-operator Telegram path only
(`recently_alerted` checks in `workers/stock_scanner/main.py`). On the recommended multi-channel
dispatch path (step 2d), signal alerts are instead deduped once per UTC day per symbol/type via
the dispatch dedupe key (`signal_alert:{symbol}:{alert_type}:{UTC day}`, built in
`workers/stock_scanner/notification_dispatch.py`) - which can be looser than 6h across a UTC
midnight and stricter than 6h within one UTC day. Price-move alerts keep their own
once-per-threshold dedupe key on both paths.

Three worker env toggles control the firehose (`workers/stock_scanner/config.py`, defaults shown):

```bash
ENABLE_TELEGRAM_ALERTS=true     # master switch for worker-sent alerts
ENABLE_WATCHLIST_ALERTS=false   # also alert on watchlist-tier setups (score 60-74) - noisier
ENABLE_HOURLY_DIGEST=false      # see honesty note below
```

**The urgency model.** Not everything pings you at 2am. The notification router
(`src/lib/notifications/router.ts`) treats a small set of types as safety-critical
(`kill_switch_enabled`, `order_approval_required`, `paper_approval_required`, `risk_blocked`) -
those always deliver instantly and ignore quiet hours. Everything else passes through, in order:
a minimum-score floor you set, symbol/theme mutes, same-day dedupe, per-type toggles, and quiet
hours - inside your quiet window a non-critical alert is deferred instead of pinging.

**Honesty note on "hourly digest".** `ENABLE_HOURLY_DIGEST` exists in `.env.example` and is
loaded into the worker's `Settings`, but as of this writing nothing in the worker reads it
beyond loading it - there is no digest builder in `workers/stock_scanner/`. The web layer has
`daily_digest` / `weekly_report` notification types, routing rules, UI toggles, and even a
WhatsApp template, but no scheduler generates digest events yet. What IS real: the scanner runs
hourly, so instant alerts arrive at an hourly cadence at most. Treat "digest" toggles as
declared preferences waiting for a sender.

You know it worked when: you can answer "which alerts would fire by default?" - strong setups,
invalidations, score jumps, and portfolio risk/moves; watchlist-tier alerts and digests are off.

## Step 2 - web push (zero phone number needed)

Web push sends real notifications to your browser or iPhone through the browser's push service.
No phone number, no bot, no third-party account - just a keypair you generate once.

### 2a - generate VAPID keys

VAPID keys identify YOUR deployment to the browser push services. Generate a pair:

```bash
npx web-push generate-vapid-keys
```

Add the output to `.env.local` (local dev) and to your deployment's env (Vercel project
settings, or Coolify - note `NEXT_PUBLIC_*` is a BUILD-time arg in the Docker path, see
`docs/runbooks/coolify-deploy.md`):

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BPz...   # the "Public Key" line - safe to expose
VAPID_PRIVATE_KEY=x7f...              # the "Private Key" line - server-side only
VAPID_SUBJECT=mailto:you@example.com  # contact URI push services can reach you at
```

The public key is served to the browser (`src/lib/push/client.ts`); the private key signs sends
server-side (`src/lib/push/server.ts`). Restart the dev server after editing `.env.local`.

You know it worked when: `npm run doctor` prints "Web Push VAPID keys present" instead of the
"Web Push VAPID keys missing - iPhone/browser push is disabled" warning.

### 2b - enable push in the app

1. Sign in and open **Account** (`/account`), then the **Notifications** panel.
2. On iPhone: first add Lyra to your Home Screen (Share -> Add to Home Screen) and open it from
   there - iOS only allows web push for installed web apps, and the panel tells you so.
3. Click **Enable push** and accept the browser's permission prompt.

Under the hood this registers the service worker (`public/sw.js`), subscribes via the browser's
push manager, and saves the subscription to your account through `POST /api/push/subscribe`
(`src/app/api/push/subscribe/route.ts` - requires a signed-in Supabase user, writes a row to
`push_subscriptions`, and flips `push_enabled` in your alert preferences).

You know it worked when: the status pill at the top of the panel reads "Push on" and the panel
shows "Active devices: 1" (or more).

### 2c - send yourself a test

Click **Send test** in the same panel. This calls `POST /api/push/test`
(`src/app/api/push/test/route.ts`), which dispatches a real `test_notification` event through
the full router with `forceInstant: true`.

You know it worked when: a "Lyra test alert" notification lands on the device AND the panel
shows "Test push sent" with `channels: push` in the result detail. "Test logged but suppressed"
means the send was a `demo_logged` no-op - see the troubleshooting table.

### 2d - connect the scanner to push

The Python worker cannot talk to browser push services directly. It POSTs alert events to your
deployed app's dispatch endpoint (`/api/notifications/dispatch`), which fans out to every
channel you enabled (`workers/stock_scanner/notification_dispatch.py` ->
`src/app/api/notifications/dispatch/route.ts` -> `src/lib/notifications/dispatch.ts`).

Set three more values where the worker runs (GitHub repo -> Settings -> Secrets and variables
-> Actions, matching what walkthrough 3 set up):

```bash
DEFAULT_USER_ID=<your profiles.id UUID>        # who the alerts belong to
APP_BASE_URL=https://your-deployed-app.example # worker derives <APP_BASE_URL>/api/notifications/dispatch
NOTIFICATION_DISPATCH_SECRET=$(openssl rand -hex 32)
```

The same `NOTIFICATION_DISPATCH_SECRET` value must ALSO be set in the deployed app's env - the
dispatch route authenticates the worker by comparing the `x-notification-secret` header against
it. Without all three, the worker logs a warning and falls back to legacy single-operator
Telegram only (`workers/stock_scanner/main.py` prints "DEFAULT_USER_ID is set but notification
dispatch is unconfigured" when you get this half-right).

You know it worked when: after the next scan that finds something alert-worthy, the alert row in
your Supabase `alerts` table shows `channel = 'multi_channel'` (not `'telegram'`), and the push
arrives on your phone. **Send test** rehearses the same channel fan-out (router -> push /
Telegram / WhatsApp senders) but NOT the worker-to-app leg this step configures - it runs
through your signed-in session, so it can pass even with `DEFAULT_USER_ID`, `APP_BASE_URL`, and
`NOTIFICATION_DISPATCH_SECRET` completely wrong. The only true end-to-end rehearsal of this step
is a scan that fires an alert (or manually POSTing to `/api/notifications/dispatch` with the
`x-notification-secret` header) and then checking for `channel = 'multi_channel'` in the
`alerts` table.

## Step 3 - Telegram (works today, the recommended phone channel)

Telegram is the most mature phone channel: the worker has sent alerts through it since day one,
delivery is free, and no business verification is involved. Full operational reference:
[docs/integrations/telegram.md](../integrations/telegram.md).

### 3a - create a bot with BotFather (2 minutes)

1. In Telegram, message `@BotFather` and send `/newbot`.
2. Pick a display name, then a unique username ending in `bot` (e.g. `my_lyra_alerts_bot`).
3. BotFather replies with a token like `123456789:AAF...`. That is your `TELEGRAM_BOT_TOKEN`.
   Treat it like a password - server-side env only, never in a `NEXT_PUBLIC_*` variable.
4. Optional hardening via BotFather: `/setjoingroups` -> Disable, `/setprivacy` -> Enable.

You know it worked when: this returns your bot's username in the JSON:

```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

### 3b - get your chat id and pair the two

A Telegram bot cannot message you until you message it first - so open your new bot in Telegram
and send it anything (`/start` is traditional). Then read your chat id:

```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"
```

Your numeric id is at `message.chat.id` in the response. (Shortcut: message `@userinfobot` and
it tells you your id - the in-app settings panel links to it.)

Now wire it up. Two paths, use both:

**Worker path (alerts from the hourly scan).** Set in the worker's env / GitHub Actions secrets:

```bash
TELEGRAM_BOT_TOKEN=123456789:AAF...
TELEGRAM_CHAT_ID=123456789
ENABLE_TELEGRAM_ALERTS=true   # already the default
```

**App path (per-account channel + verified delivery).** Set `TELEGRAM_BOT_TOKEN` in the deployed
web app's env too, then in **Account -> Notifications** paste your chat id into "Telegram chat
ID" and hit save. The server does not just store the id - it attempts a real probe send
("Lyra is confirming this channel...") and only marks the channel verified if that message
actually reached you (`verifyChatChannel` in `src/app/api/notifications/route.ts`). Unverified
channels never receive alerts, so a typo'd chat id cannot silently black-hole your pings.

You know it worked when: the probe message from your bot appears in Telegram and the panel shows
"Channel verified - we reached this chat. Alerts are on." with the Telegram status pill on.

### 3c - what an alert looks like when it arrives

From the worker's legacy path (`workers/stock_scanner/telegram.py`) you get the verbose format:
title, symbol, score /100, status, action state, RSI / MACD histogram / volume ratio / distance
from the 60-period low, up to five "Triggered because" reasons, and the "Not financial advice."
footer. Through the multi-channel dispatch path you get the compact router format
(`src/lib/notifications/templates.ts`): type tag, title, data line, "Why:" trigger reason, and
"Research, not advice."

You know it worked when: the next `strong_setup` or `signal_invalidated` the scanner finds lands
in your Telegram chat. To rehearse now instead of waiting, re-save your chat id in the panel -
the verification probe is a real send through the real sender.

### 3d - optional: inbound commands via the webhook

You can also talk BACK to the bot (`/status`, `/mute`, `/help`). That requires registering a
webhook so Telegram POSTs updates to your deployment at
`src/app/api/webhooks/telegram/route.ts`. The route fails closed: with no
`TELEGRAM_WEBHOOK_SECRET` set, every inbound request gets a 401.

```bash
openssl rand -hex 32   # set the output as TELEGRAM_WEBHOOK_SECRET in the deployment, then:

curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "content-type: application/json" \
  -d '{
    "url": "https://<your-domain>/api/webhooks/telegram",
    "secret_token": "<your TELEGRAM_WEBHOOK_SECRET value>",
    "allowed_updates": ["message"],
    "drop_pending_updates": true
  }'
```

Telegram echoes the secret back in the `X-Telegram-Bot-Api-Secret-Token` header on every
delivery, and the route compares it in constant time. Inbound text is parsed into a closed
command enum - it is never fed to an LLM and there is no free-form path.

Honesty notes on what commands do today: `/status` and `/help` answer usefully; account-scoped
commands (`/portfolio`, `/watchlist`, `/today`) reply with a "pair your account" stub because
the pairing-completion flow (`/start <code>` linking a chat to a user) is designed but not
shipped - the `channel_pairing_codes` table exists (migration
`supabase/migrations/020_trading_foundations.sql`), but no code issues codes or looks them up
yet, and the webhook says so honestly. `/mute` and `/unmute` silence webhook REPLIES for the chat, in memory only, resetting
on redeploy. Full command table and rate-limit details:
[docs/integrations/telegram.md](../integrations/telegram.md).

You know it worked when: `curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"`
shows your URL with an empty `last_error_message`, and sending `/status` to the bot gets a reply.

### 3e - quiet hours, mutes, and scope

All durable alert preferences live in the app under **Account -> Notifications**, stored in
`user_alert_preferences`, and BOTH delivery paths honour them (the worker via
`should_send_alert_to_user` in `workers/stock_scanner/alert_engine.py`, the web dispatcher via
`routeNotification` in `src/lib/notifications/router.ts`):

- **Quiet hours** - default on, 22:00-07:00, evaluated as wall-clock time in your stored
  timezone (default `Australia/Sydney`), wrap-around-midnight windows handled. The two paths
  differ here: on the web dispatch path, non-critical alerts inside the window are held and
  delivered after the window ends (`releaseHeldEvents`); on the worker path, the pre-dispatch
  gate records the alert with `sent_status = 'gated'` and does NOT retry it later - a scanner
  alert that fires inside your quiet window is dropped, not deferred. The settings UI exposes
  the start/end times; the timezone comes from your preference row rather than a visible
  control.
- **Minimum signal score** - the slider sets a relevance floor; alerts scoring below it are
  dropped outright.
- **Per-type toggles** - portfolio movement, watchlist triggers, paper-bot trades, order
  approvals, instant alerts, theme/macro, daily digest, weekly report - each a switch in the
  panel.
- **Per-ticker mute** - the schema and worker gate support muting a single symbol until a
  timestamp (`ticker_alert_preferences.is_muted` / `muted_until`, checked in
  `should_send_alert_to_user`), but no settings UI writes those rows yet - honest gap.

You know it worked when: a real (non-test) alert dispatched inside your quiet window shows up
as a `held` row in `notification_deliveries`, then gets released and delivered after the window
ends (`releaseHeldEvents` drains held rows on the next dispatch). Note that **Send test** cannot
rehearse quiet hours: it runs with `forceInstant: true` (section 2c), which deliberately bypasses
the quiet-hours rule and always delivers instantly.

## Step 4 - WhatsApp (architecture only - read before spending time here)

Straight from `.env.example`: "WhatsApp Cloud API (Part 9 - architecture only)". Here is exactly
what that means, so you can decide whether to bother. Full reference:
[docs/integrations/whatsapp.md](../integrations/whatsapp.md).

**What exists in the repo today:**

- The full env contract: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
  `WHATSAPP_API_VERSION` (defaults `v21.0`).
- A hardened inbound webhook (`src/app/api/webhooks/whatsapp/route.ts`): GET `hub.challenge`
  verification and per-request HMAC-SHA256 signature checks
  (`src/lib/notifications/whatsapp-signature.ts`, unit tested). Both fail closed when env is
  unset.
- An outbound send adapter (`src/lib/notifications/whatsapp.ts`) that resolves to an honest
  `demo_logged` no-op unless the env is configured, plus four typed message templates
  (`src/lib/notifications/whatsapp-templates.ts`).
- The settings UI accepts a WhatsApp number and runs the same verification probe as Telegram -
  which today reports "Saved, but not verified yet - WhatsApp is not configured in this
  environment."

**What YOU would still need before a single real WhatsApp alert arrives:**

1. A Meta Business Portfolio with completed business verification (a multi-day Meta process).
2. A Meta app with the WhatsApp product, a phone number id, and a long-lived system-user token.
3. All four templates registered in Meta Business Manager, byte-identical to
   `WHATSAPP_TEMPLATE_BODIES` - business-initiated messages MUST use pre-approved templates.
4. While the app is in Meta's development mode, every recipient added to a tester allow-list.

Also: inbound WhatsApp commands are parsed and logged only, and the pairing lookup is a stub
that always returns unpaired (fails safe). Bottom line - the security architecture is real and
tested, but as a user channel it is not switched on. Use Telegram.

You know it worked when: (nothing to verify here - the checkpoint is that you did NOT spend an
afternoon on Meta Business verification expecting alerts at the end of it.)

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| **Enable push** button is greyed out / panel says "VAPID keys are not configured in this environment" | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` missing where the app runs | Step 2a. On Docker/Coolify remember `NEXT_PUBLIC_*` is a build-time arg (`docs/runbooks/coolify-deploy.md`); on local dev restart after editing `.env.local` |
| Push permission shows "Blocked" | You (or a past you) denied the browser prompt | Re-allow notifications for the site in browser settings, then reload and enable again |
| iPhone: enable does nothing / unsupported | Lyra opened in Safari tab, not installed | Add to Home Screen and open from there - the panel's "Home Screen" pill must be on before enabling |
| Test says "Test logged but suppressed" | The send was a `demo_logged` no-op: VAPID keys absent where the ROUTE runs, or no active subscription for this account | Check the panel's "Active devices" count and step 2a env on the deployment, then re-enable on the device |
| Push worked, then silently stopped on one device | The push service expired the subscription (HTTP 404/410); Lyra auto-disables that row | Open the app on that device and **Enable push** again |
| Scanner alerts reach Telegram but never push | Worker is on the legacy fallback - dispatch not configured | Step 2d: set `DEFAULT_USER_ID`, `APP_BASE_URL`, `NOTIFICATION_DISPATCH_SECRET` in the worker env AND the same secret in the app env |
| Worker log: "DEFAULT_USER_ID is set but notification dispatch is unconfigured" | Exactly what it says - you set the user but not the dispatch URL/secret | Same fix as above |
| Telegram save says "Saved, but not verified yet - the Telegram bot is not configured in this environment" | `TELEGRAM_BOT_TOKEN` unset where the WEB APP runs (worker env alone is not enough for the app path) | Set the token in the deployment env and save the chat id again |
| Telegram save says "We could not reach this chat yet" | You never messaged the bot first (bots cannot initiate), or the chat id is wrong | Open the bot, send `/start`, re-check the id via `getUpdates` or `@userinfobot`, save again |
| No Telegram alerts from the scanner despite a green run | `ENABLE_TELEGRAM_ALERTS=false`, token/chat-id missing (the worker skips silently with `sent_status=skipped`), a 6h/12h cooldown, or nothing crossed a threshold | Check the `alerts` table rows for `sent_status` and `error_message` - the worker logs every decision, including skips |
| Alerts arrive at odd hours / not at all during your evening | Quiet hours are evaluated in the preference row's timezone (default `Australia/Sydney`), which may not be yours | Adjust the quiet-hours window in Account -> Notifications to your wall clock |
| Bot never replies to `/status` | No webhook registered, or `TELEGRAM_WEBHOOK_SECRET` unset (route 401s everything, by design) | Step 3d; verify with `getWebhookInfo` |
| `getUpdates` returns nothing while testing | A webhook is registered - webhooks and polling are mutually exclusive | `curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"` first |
| `/portfolio` answers "pair your account" forever | Pairing completion is not built yet - documented current state, not a bug | Nothing to fix; see [docs/integrations/telegram.md](../integrations/telegram.md) section 8 |
| WhatsApp sends stay `demo_logged` | Expected - architecture-only channel | Use Telegram, or complete the full Meta setup in [docs/integrations/whatsapp.md](../integrations/whatsapp.md) |

## Where to go next

- [docs/integrations/telegram.md](../integrations/telegram.md) - the full Telegram security and
  operations reference (rate limits, idempotency, local dev without a public URL).
- [docs/integrations/whatsapp.md](../integrations/whatsapp.md) - the complete WhatsApp
  architecture doc, including the Meta production checklist.
- [Walkthrough 3 - Go live](./03-go-live-supabase.md) - if any prerequisite above was missing.
- [Walkthrough 5 - Understand the score](./05-understand-the-score.md) - what the number in
  the alert actually measures.

Lyra is research software. An alert says "look at this", never "buy this". Not financial advice.
