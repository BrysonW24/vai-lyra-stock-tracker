---
concept: paper-bot-notifications-and-cli
date: 2026-06-14
status: in-app CLI + flags + equity curve shipped + verified; Telegram delivery implemented (config-gated); WhatsApp + per-user durability are the next slices
scope: vdapp42 - making the paper bot interactive (commands) and reachable (flags / channels)
---

# Paper Bot - flags, CLI, and channel delivery

The paper bot is no longer just propose/approve/execute buttons. It is an interactive, observable
surface: it **raises flags** when something happens, exposes a **CLI** to drive it, and can **deliver**
those flags to a chat channel (Telegram now, WhatsApp next). Every path reuses the same paper-only
engine, so none of this adds a way to reach live trading.

## 1. Flags (notifications)

A flag is raised by the engine when the user should know something. Source: `notifications-store.ts`.

| Kind | Severity | Raised when |
|---|---|---|
| `approval_pending` | action | a candidate passes the risk gate and is waiting for approval |
| `fill` | good | a paper order is simulated-filled |
| `position_move` | warn | an open position crosses a fresh ±5% P/L band (deduped per symbol) |
| `risk_blocked` | warn | a proposal is blocked by the risk gate |
| `info` | info | general |

- In-memory, capped at 50, newest-first. Surfaced in-app (the **Notifications** panel + the `flags`
  command) and at `GET /api/trading/notifications` (`{ flags, unread, channels }`).
- `position_move` is deduped by a ±5% bucket per symbol so a drifting position does not spam.

## 2. CLI

A small allowlisted command set. Source: `paper-bot-commands.ts`, endpoint
`POST /api/trading/paper-bot/command { line, ai }`. In-app via the **Command line** panel; the same
endpoint backs a future chat-bot command parser.

| Command | Does |
|---|---|
| `status` | equity, unrealised P/L, open positions, fills, active channels |
| `positions` / `pos` | list open paper positions, marked to the latest price |
| `pnl` | unrealised P/L summary |
| `propose <SYM> <QTY>` | AI assesses readiness + deterministic code drafts a paper order |
| `approve` | approve the pending paper order |
| `execute` / `fill` | simulate the fill (must be approved first) |
| `flags` / `alerts` | recent notifications |
| `channels` | where flags are delivered + how to enable a channel |
| `help` / `?` | command list |

### Safety (structural, tested)

- **No live verb exists in the allowlist.** There is no command that reaches live execution.
- Input matching `live` / `real money` / `go live` is **refused explicitly**, not guessed.
- `execute` only fills an intent that was `approve`d; the engine re-checks the risk gate at fill time.
- Unknown input is refused, never coerced into an action.
- Covered by `tests/paper-bot-commands.test.ts` (live-refusal, fail-closed execute/approve, usage,
  unknown, help, status).

## 3. Channel delivery (Telegram / WhatsApp)

Source: `notify-delivery.ts`. The same flag the user sees in-app is pushed to any **enabled** channel.
Delivery is **config-gated**: with no channel env set (the sim/demo default), every adapter is a no-op,
so nothing leaks and nothing breaks.

### Telegram (implemented)

Set both server-only env vars and flags deliver to the chat via the Bot API `sendMessage`:

```
TELEGRAM_BOT_TOKEN=...            # from @BotFather
TELEGRAM_PAPER_CHAT_ID=...        # target chat / channel id
```

The existing Python scanner already uses Telegram for scan alerts; this reuses the same Bot API
surface from the Next server. Tokens are read from **server-only** env (never `NEXT_PUBLIC_*`).

### WhatsApp (next slice)

Interface is defined; the provider adapter (Meta WhatsApp Cloud API or Twilio) is not wired yet.
Wiring is: add `WHATSAPP_*` provider env, implement `whatsapp.enabled()/send()`, and (for inbound
commands) a webhook that maps a message to `runPaperBotCommand`. Inbound chat commands need a public
webhook + signature verification, which is why the in-app CLI ships first.

## 4. Equity curve

`paper-account-store.ts` samples `equity = starting cash + cumulative unrealised P/L` each time the
account is marked, throttled to >=3s, capped at 120 points, seeded with a baseline so it renders
immediately. Returned as `equityCurve: number[]` and drawn with the in-repo `MiniSparkline` (no chart
dependency). **Session-scoped today** - it lives across the curve while the page is open/polled; it
does not yet survive a server restart.

## 5. What is durable vs in-memory

| Data | Today | Durable path |
|---|---|---|
| Positions + fills | in-memory (`paper-account-store`) | Supabase `paper_positions` / `paper_trades` (migration 020), per-user via `auth.uid()` RLS |
| Flags | in-memory (`notifications-store`) | per-user table + read state |
| Equity curve | in-memory session series | `paper_equity_snapshots` (new table) for cross-restart history |

Persistence requires a real authenticated Supabase user (`auth.uid()`); the demo/sim path
(`lyra_onboarded` cookie, no auth user) stays in-memory. The account summary now carries a
`dataSource: 'persisted' | 'demo'` field (shown as a `saved` / `session` tag in the UI) so the
provenance is never silent.

## Persistence layer (migration 020 + 021)

`paper-account-repo.ts` binds the paper bot to Supabase using the cookie-aware, RLS-enforced server
client (never the service role). A signed-in user's fills persist to `paper_orders` + `paper_trades`,
the averaged `paper_positions` row, and a `paper_equity_snapshots` point (migration 021) - all scoped
by `auth.uid() = user_id`. Reads come back through `getPaperAccountSummaryAuthAware()`: persisted for
an authed user, in-memory for demo. Failures are best-effort (a failed read returns null -> in-memory
fallback; a failed trade/position write returns false and skips the equity snapshot) so persistence
never breaks the fill or the page.

Verified: pure mapping (`averageIn`, `rollupPersisted`) is unit-tested; the live round-trip needs a
configured Supabase project + an authenticated session.

### Known follow-ups (deferred - pertain to not-yet-wired sell/close paths or ops)

- **Realised P/L from closed trades** - `rollupPersisted` sums open positions only. Correct today
  (the spine only opens buys; no closes exist yet). When sells/closes are wired, add a realised-P/L
  query and fold it into equity.
- **Fill idempotency** - `persistFillIfAuthed` has no dedupe; a retried fill could double-insert. Add
  an idempotency key (the intent already has one) + a unique constraint when execution gets retries.
- **Oversell validation** - `averageIn` clamps an oversell to 0 quantity rather than rejecting it;
  harmless while only buys execute, but a sell path should validate available quantity upstream.
- **Equity-snapshot retention** - one row per fill, read-capped at 120; add a retention/rollup policy
  before high-frequency use.
```
