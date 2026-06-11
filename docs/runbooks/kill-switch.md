# Kill-switch runbook - how to disable each layer TODAY

> **Purpose:** Concrete, verified steps to switch off every Lyra layer right now (notifications, AI, paper trading, Telegram webhook, WhatsApp), plus the honest status of the 11 contracted future kill switches in `ALL_KILL_SWITCHES`. | **Audience:** The operator containing an incident or deliberately powering a layer down. | **Status:** Active | **Owner:** Bryson Walter | **Last updated:** 2026-06-11

## Ground truth

Two facts shape everything below:

1. **The most dangerous layer is already off.** `DEFAULT_TRADING_SETTINGS.tradingMode` is `'disabled'` (`src/lib/trading/types.ts`), live modes are refused by the `no_live_execution` check (`src/lib/trading/risk-engine.ts`), and the only broker adapter is `NullBrokerAdapter`, which refuses every call. There is no live trading to kill.
2. **Every off switch below fails closed or falls back to demo.** Unsetting a secret never opens a hole; it closes one (webhooks 401, sends become `demo_logged`).

## 1. Notifications - off today

Channels are opt-in and OFF by default (`DEFAULT_NOTIFICATION_PREFERENCES` in `src/lib/notifications/types.ts`: `telegramEnabled: false`, `whatsappEnabled: false`). The router (`src/lib/notifications/router.ts`) drops every non-digest event with `no channels` when both are off.

| Lever | How | Effect |
|---|---|---|
| Per-user preference | Settings UI, or clear `lyra.notificationPrefs.v1` in localStorage (`src/lib/notifications/preferences.ts`) | Router returns `deliver: false` for that user |
| Web-layer Telegram sends | Unset `TELEGRAM_BOT_TOKEN` in Vercel, redeploy | `sendTelegramMessage` (`src/lib/notifications/telegram.ts`) returns `demo_logged` no-ops |
| Worker Telegram alerts | Set `ENABLE_TELEGRAM_ALERTS=false` (or unset `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`) in GitHub Actions secrets | `workers/stock_scanner/telegram.py` stops sending |
| WhatsApp sends | Unset `WHATSAPP_ACCESS_TOKEN` (or `WHATSAPP_PHONE_NUMBER_ID`) in Vercel | `sendWhatsAppMessage` (`src/lib/notifications/whatsapp.ts`) resolves `demo_logged` |

Verify: trigger any alert path and confirm the `DeliveryRecord.status` is `demo_logged` or the router drop reason is logged. Nothing throws - the senders never throw by contract.

## 2. AI - off today

The only live AI surface is the BYOK Daily Brief narration (`src/app/api/ai/brief/route.ts` via the gateway `src/lib/ai/gateway.ts`). It is off by default (`DEFAULT_AI.mode: 'off'` in `src/lib/account.ts`).

| Lever | How | Effect |
|---|---|---|
| User-side (the real switch) | Settings -> AI mode `off`, or clear `lyra.account.ai` from localStorage | `BriefAiNarration` never calls the route; deterministic brief renders unchanged |
| Remove the key | Delete the BYOK key in Settings | `byo` mode without a key returns `ok:false, reason:'no_key'` - fallback to deterministic |
| Server env | Keep `ENABLE_AI_EXPLANATIONS=false` and `ANTHROPIC_API_KEY` unset | Honest status: these are RESERVED in `.env.example` for a future hosted mode. Today hosted mode already returns `hosted_not_configured` regardless - there is no hosted key to remove. |

The route's failure posture is total: any error, empty response, or disabled mode returns `ok:false` and the client keeps the deterministic brief. Killing AI can never blank a page.

## 3. Paper trading / trading layer - off today (it is the default)

| Lever | How | Effect |
|---|---|---|
| Trading mode | Nothing to do: `tradingMode: 'disabled'` is the shipped default and **no settings persistence exists** - every evaluation of the risk engine (including the `/trading` demo) runs with `DEFAULT_TRADING_SETTINGS` | `runPreTradeChecks` fails the `trading_mode` check for every intent |
| Defence in depth | Also default: `maxOrderNotional: 0`, `maxDailyLoss: 0` (an unconfigured loss limit FAILS the `max_daily_loss` check by design), `allowedStrategies: []` | Even if the mode were flipped, three more blocking checks refuse |
| Broker | Nothing to do: `NullBrokerAdapter` is the only adapter (`src/lib/trading/broker-adapter.interface.ts`) | `submitOrder` and `cancelOrder` return `accepted: false` always |

The `/paper` page is a static demo dataset (`DEMO_PAPER_TRADES` in `src/lib/paper-trading.ts`) - simulated display, no engine to stop.

## 4. Telegram webhook - off today

Two independent moves; do both for a suspected secret leak:

```bash
# 1. Unregister the webhook at Telegram (stops all deliveries at the source)
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook?drop_pending_updates=true"

# 2. Rotate the secret and update the deployment
openssl rand -hex 32      # new TELEGRAM_WEBHOOK_SECRET -> set in Vercel, redeploy
```

Facts that make this safe:

- Unsetting `TELEGRAM_WEBHOOK_SECRET` entirely is also a valid kill: the route (`src/app/api/webhooks/telegram/route.ts`) rejects ALL inbound with 401 when the secret is unset - fail closed, never open.
- If the BOT TOKEN itself leaked, rotate it via BotFather (`/revoke`) - the token can post to any chat the bot is in (`SECURITY.md`).
- Re-enable later by re-running `setWebhook` with the new secret (`docs/integrations/telegram.md` section 6).

Verify: `curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"` shows an empty `url`; a POST to the route without the header returns 401.

## 5. WhatsApp - off today

| Lever | How | Effect |
|---|---|---|
| Revoke the token | Meta Business settings -> System User -> revoke/regenerate the access token | All Graph sends fail (error 190); Lyra's sender returns a `failed` DeliveryRecord, never throws |
| Unset `WHATSAPP_ACCESS_TOKEN` | Vercel env, redeploy | Sends resolve `demo_logged` - "WhatsApp not configured" |
| Unset `WHATSAPP_APP_SECRET` | Vercel env, redeploy | Every inbound POST returns 401 (signature verification fails closed, `src/lib/notifications/whatsapp-signature.ts`) |
| Unsubscribe the webhook | Meta App Dashboard -> WhatsApp -> Configuration -> remove the `messages` subscription | Meta stops delivering entirely |

Note `appsecret_proof` defence: even a leaked access token cannot call the API alone while "Require app secret" is enabled in the Meta app (`docs/integrations/whatsapp.md`).

## 6. Scanner (bonus layer)

Not in the original ask but you will want it mid-incident:

- GitHub (public repo) -> Actions -> `Hourly Stock Scanner` -> "Disable workflow". One click, reversible.
- Or remove the Actions secrets - the worker no-ops safely without them.

## 7. The 11 contracted kill switches (FUTURE - not operable today)

`ALL_KILL_SWITCHES` in `src/lib/trading/risk-engine.ts` defines the switch vocabulary the future trading layer must honour. The engine already enforces them: the `kill_switches` check blocks an intent when ANY switch is active, and `isHardKilled()` treats `global`/`user`/`broker` as stop-everything. **What does not exist yet:** persistence of switch state, automatic trip monitors, and any admin UI to flip them (`docs/architecture/future-trading-bot.md`). Until those land, this table is a contract, not a control panel.

| Id | Label | Scope (from code) | Trip type (target) |
|---|---|---|---|
| `global` | Global | Disables all trading activity platform-wide | Manual, hard-kill |
| `user` | User | Disables all trading for this account | Manual (web; `/killswitch` over Telegram/WhatsApp may only ACTIVATE it), hard-kill |
| `strategy` | Strategy | Disables a single strategy across all users | Manual |
| `broker` | Broker | Disables a broker connection (outage, errors) | Manual or monitor, hard-kill |
| `symbol` | Symbol | Blocks new orders in a specific symbol | Manual |
| `theme` | Theme | Blocks new orders in a whole theme | Manual |
| `daily_loss` | Daily loss | Trips when the daily loss limit is hit | Automatic monitor (future) |
| `error_rate` | Error rate | Trips on elevated system error rates | Automatic monitor (future) |
| `slippage` | Slippage | Trips when realised slippage exceeds tolerance | Automatic monitor (future) |
| `data_staleness` | Data staleness | Trips when market data is stale | Automatic monitor (future) |
| `ai_system` | AI system | Disables the AI layer (it can never trade anyway - defence in depth) | Manual |

When switch persistence ships, the `kill_switch_enabled` notification type (`src/lib/notifications/types.ts`) is already wired as safety-critical in the router: it always delivers instantly, immune to quiet hours, mutes-by-toggle, and digest deferral.

## 8. Drill checklist (run quarterly, or before any new layer goes live)

- [ ] Telegram: `deleteWebhook` + secret rotation executed and webhook re-registered cleanly
- [ ] Telegram: route 401s with the OLD secret after rotation
- [ ] WhatsApp: unset `WHATSAPP_APP_SECRET` in a preview env and confirm POSTs 401
- [ ] Notifications: both channel toggles off -> router returns `no channels` for a test event
- [ ] AI: mode `off` -> brief renders deterministically with zero `/api/ai/brief` calls
- [ ] Trading: `runPreTradeChecks` with `DEFAULT_TRADING_SETTINGS` still refuses (covered continuously by `src/lib/trading/__tests__/risk-engine.test.ts`)
- [ ] Scanner: workflow disable + re-enable round trip
- [ ] Time each step - containment speed is the metric that matters
