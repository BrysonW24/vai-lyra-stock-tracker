# Lyra - AI-Native Notification Layer

> **Captured 2026-06-07.** The design for the AI interpretation layer that sits on top of
> the deterministic engine and composes the hourly alert/digest messages. Status: **contract +
> spec defined (this doc + `contracts/notifications/`); the AI composer is the next build.**

## Principle (product doctrine)

The **deterministic engine decides** *what* and *when* (score, status, action-state, threshold
crossings, risk states) - that is truth and the compliance guarantee. **AI only composes** the
human message: it phrases the *why* and the *so-what* in 1-2 lines, **never inventing a number**
and never overriding a decision. Every numeric fact in a message is passed verbatim from a
deterministic field. This is what keeps Lyra "research, not advice."

```
hourly scanner run
  → per-ticker state persisted (EXISTS: indicators, scores, signals, overlays, scanner_runs)
  → CHANGE SNAPSHOT built (diff vs prior run)                     [register of change]
  → ALERT EVENTS (deterministic, from alert_engine + user/ticker prefs gating)
  → AI COMPOSER reads {snapshot, events, intelligence, user profile}
  → NOTIFICATION MESSAGE(s)  (JSON contract: ≤2 lines, required facts, inclusion rules)
  → HOURLY DIGEST (rolled up across the user's watchlist/portfolio)
  → channel delivery (Telegram / WhatsApp - live today)
```

## Is the backend ready? - Yes, the truth layer exists

| Need | Already in backend | File |
|---|---|---|
| Per-candle indicator state (RSI/MACD/vol/trend + deltas) | `IndicatorSnapshot` | `workers/stock_scanner/models.py` |
| Score + component breakdown + reasons | `SignalScoreResult` | `models.py` / `stock_signal_scores` |
| Signal status, **score delta vs previous**, action/lifecycle | `SignalResult` (`signal_score_delta`, `previous_signal_score`) | `models.py` / `stock_signals` |
| Portfolio risk/P&L state | `PortfolioOverlay` | `models.py` / `portfolio_signal_overlay` |
| Watchlist trigger + distance-to-target | `WatchlistOverlay` | `models.py` / `watchlist_signal_overlay` |
| Deterministic alert decisions + reasons + cooldowns | `AlertDecision` + `signal/portfolio/watchlist_alert_decisions` | `workers/stock_scanner/alert_engine.py` |
| Per-user/ticker gating (quiet hours, mutes, toggles, thresholds) | `should_send_alert_to_user` | `alert_engine.py` |
| Time-series / "track over time" | `candle_time`-indexed rows + `stock_scanner_runs` | `sql/001_*.sql` |
| News / sentiment / hype | intelligence worker | `workers/intelligence_worker/`, `sql/007_intelligence.sql` |

**What's missing (this layer adds it):** a unified **change register**, an **alert-event** contract
the AI consumes, a **message contract + template** the AI must satisfy, an **hourly-digest**
composition spec, and a **test register** that gates message quality. All defined as JSON in
`contracts/notifications/`.

## The objects (full JSON Schema in `contracts/notifications/notification-contracts.schema.json`)

1. **ChangeSnapshot** - the register of change. One per (run, ticker): `before` / `after` /
   `deltas` / `changed[]` (which dimensions moved) / `crossed_thresholds[]` / `watchlist_alerts_hit[]`
   (the −10/−5/+5/+10 ladder) / `news[]`. This is the adjacent-snapshot diff that decides whether
   anything is worth saying.
2. **AlertEvent** - a deterministic, gated event the AI may turn into words. Carries `type`,
   `severity`, `deterministic_reason`, a **`facts{}` block of verbatim numbers**, `dedup_key`,
   `cooldown_hours`, and `suppressed{}` (with reason) so suppression is auditable.
3. **NotificationMessage** - the AI output, contract-bound: `headline` (1 line, ≤90 chars),
   optional `detail` (1 line, ≤120), `tickers[]`, `facts_used[]` (must be a subset of the event's
   `facts`), `source_event_ids[]`, `severity`, `template_id`. Guardrail: `facts_used` ⊆ event facts
   → no invented numbers.
4. **HourlyDigest** - the roll-up: a ≤2-line `summary` + `sections[]` (by type), `event_count`,
   `suppressed_count`. This is the core driver - the hourly update.

## Message guardrails - "what makes a message solid"

A message is only sent if it passes the contract:
- **Length:** headline ≤ 90 chars / 1 line; optional detail ≤ 120 / 1 line. No walls of text.
- **Grounded:** every number in the text appears in the source event's `facts{}` (`facts_used ⊆ facts`).
- **Ticker inclusion:** include a ticker only when it has a fired, non-suppressed event this run;
  in a digest, name at most the top `N` by severity, summarise the rest as a count.
- **Dedup + cooldown:** one message per `dedup_key` within `cooldown_hours`; re-arming on the same
  threshold within the window is suppressed (logged, not sent).
- **Severity ordering:** `invalidated` > `portfolio_risk` > `strong_setup` > `price_alert` > `score_jump` > `watchlist_upgrade`.
- **Plain English, deterministic fallback:** if AI is off/unavailable, the `message-templates.json`
  deterministic template renders the same facts - the message always sends.

## Templates (`contracts/notifications/message-templates.json`)

Concise 1-2 line templates per event type, with `{slots}` filled from `facts{}`, plus an
`ai_rephrase` instruction the composer uses when AI mode is on (same facts, warmer prose). The
hourly digest has its own template. Deterministic render is always the fallback.

## Test register (`contracts/notifications/test-register.json`)

Golden cases: `input` (a ChangeSnapshot/AlertEvent) → `expect` (`max_lines`, `max_chars`,
`must_include`, `must_not_include`, `tickers`, `no_invented_numbers`). The composer (deterministic
and AI) must pass the whole register before a prompt/template change is promoted - the "register of
how we pass testing" so messages are assembled properly. Run in CI alongside the worker pytest suite.

## Next build (not done here)
1. `change_register.py` in `stock_scanner/` - build `ChangeSnapshot` from this run vs the prior
   (`stock_scanner_runs` lookback). 2. `message_composer.py` - deterministic render from templates;
   AI rephrase behind the Account AI toggle. 3. Persist messages/digests (new `stock_messages` table)
   for the in-app feed + delivery audit. 4. Wire the test register into CI. 5. The hourly GitHub
   Actions workflow calls composer → Telegram/WhatsApp.
