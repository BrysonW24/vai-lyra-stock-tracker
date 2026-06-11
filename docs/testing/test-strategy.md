# Test strategy - current truth

> **Purpose:** The honest test posture of Lyra: every real vitest and pytest suite, what each covers, what is NOT covered yet, and the ship gate every change must pass. | **Audience:** Engineers and agents writing or reviewing Lyra code. | **Status:** Active | **Owner:** Bryson Walter | **Last updated:** 2026-06-11

## The ship gate

No change ships without all three green, in this order:

```bash
npm run type-check     # tsc --noEmit (pretype-check compiles content/ first)
npm run test           # vitest run - all 8 suites
npm run build          # next build (prebuild compiles content/ first)
```

When worker code (`workers/`, `tests/`) changed, add:

```bash
npm run worker:test    # python -m pytest tests
```

Config: `vitest.config.ts` (node environment, globals on, `@` -> `./src` alias). Pytest discovers `tests/` at the app root.

## What the test estate protects

The testing doctrine follows the product doctrine: **deterministic code decides, so deterministic code gets the tests.** Every module that makes a decision (risk, routing, scoring, guardrails) is a pure function with an injectable clock, which is why these suites are fast, flake-free, and authoritative. Display code formats; it does not decide; it is currently untested by design priority, not by accident.

## Frontend/lib suites (vitest) - 8 suites, ~118 tests

| Suite | Tests | What it actually covers |
|---|---|---|
| `src/lib/trading/__tests__/risk-engine.test.ts` | 14 | The deterministic pre-trade engine: passes a sane paper intent (still requiring approval), blocks on disabled mode (the default), refuses live modes (`no_live_execution`), kill switches, non-allowlisted strategies, blocked symbols/themes, stale quotes, notional/position limits, unconfigured AND breached daily-loss limits, idempotency duplicates, insane quantities; blackouts are warnings in paper mode; `buildIdempotencyKey` determinism; `isHardKilled` trips only on `global`/`user`/`broker` |
| `src/lib/__tests__/signal-events.test.ts` | 15 | Signal events accuracy: RSI event detection, MACD cross detection, Bollinger computation and band-break detection, event derivation from `SignalRow`s, story building, pinned-event merging within `PIN_HOURS` - all against a fixed clock |
| `src/lib/notifications/__tests__/router.test.ts` | 28 | The entire routing policy as pure logic: relevance floor, symbol/theme mutes (entity-tagged and dedupe-key token matches), dedupe collapse, the safety-critical bypass (`kill_switch_enabled`, `order_approval_required` deliver through quiet hours and toggles), paper-trade and order-chatter toggles, digest gates, no-channels drops, overnight quiet-hours wrap (22:00-07:00), instant-alerts deferral, key builders, `isWithinQuietHours` edge cases incl. malformed windows failing OPEN |
| `src/lib/notifications/__tests__/whatsapp-signature.test.ts` | 11 | `verifyWhatsAppSignature`: valid HMAC passes; tampered body, missing header, wrong prefix, non-hex digest, and unset/empty `WHATSAPP_APP_SECRET` all fail closed; constant-time comparison path |
| `src/lib/ai/__tests__/guardrails.test.ts` | 22 | AI policy + guardrails: `AI_NEVER`/`AI_MAY` non-empty and disjoint, read-only tools disjoint from `FORBIDDEN_TOOLS`, every forbidden tool refused for every agent, least-privilege agent/tool matrix, all 8 agent definitions consistent with policy, `trade_readiness` accepts only its 3 verdicts and rejects order-shaped payloads, injection detection (ignore-previous, role prefixes, tool-call lookalikes, fence-marker spoofing), external-content fencing with tombstones, output schema validation, citation enforcement, fabricated-number detection, audit `hashInput` stability and `recordAiRun` write-through |
| `src/lib/ai/__tests__/gateway.test.ts` | 4 | Gateway model resolution: provider defaults, blank/whitespace fallback, bring-your-own-model honoured and trimmed, supported-provider list |
| `src/lib/__tests__/score-history.test.ts` | 8 | `buildScoreHistory`: 7-point series ending exactly at the live score, deterministic backfill behaviour |
| `src/lib/__tests__/daily-brief.test.ts` | 16 | `buildDailyBrief`: deterministic brief construction from dashboard data + market context (regime label, headline, fact lines) |

## Worker suite (pytest) - 17 files, ~170 tests

`tests/` at the app root, run with `npm run worker:test`. Coverage by engine:

| File | Covers |
|---|---|
| `test_signal_engine.py`, `test_indicators.py` | Scoring and indicator math (RSI, MACD, components) |
| `test_alert_engine.py`, `test_relevance_engine.py` | Alert payload truth + relevance scoring |
| `test_watchlist_engine.py`, `test_portfolio_engine.py` | Watchlist trigger state, portfolio overlay/risk state |
| `test_paper_trading.py` | The deterministic hypothetical-position ledger (`workers/stock_scanner/paper_trading.py`) |
| `test_backtest_engine.py` | The backtest engine (`workers/stock_scanner/backtest_engine.py`) - see `docs/testing/backtesting-validation.md` |
| `test_event_risk_engine.py`, `test_outcome_engine.py`, `test_trade_snapshot_engine.py` | Event risk, signal outcomes, trade snapshots |
| `test_hype_engine.py`, `test_sentiment_engine.py`, `test_valuation_engine.py`, `test_market_context.py` | Hype/sentiment/valuation overlays, market context capture |
| `test_scheduler_guard.py` | Market-hours guard: weekday window, `FORCE_SCAN`, guard toggle |
| `test_multiuser.py` | Multi-user scoping of worker writes |

## What is NOT covered yet (the honest list)

- **React components and pages** - zero component tests. All `src/components/` and `src/app/**/page.tsx` rendering is verified only by `next build` and eyeballs.
- **API route handlers** - the Telegram and WhatsApp webhook ROUTES (`src/app/api/webhooks/*/route.ts`) are not unit-tested; only the extracted signature logic is (`whatsapp-signature.test.ts`). Same for `/api/ai/brief`, `/api/notifications`, and the other routes.
- **Notification adapters and templates** - `telegram.ts`, `whatsapp.ts`, `templates.ts`, `audit.ts` have no direct suites; the router contract they sit behind is tested.
- **AI gateway provider adapters** - the network-calling paths in `gateway.ts` (`callAnthropic`, `callOpenAiCompatible`, `callGoogle`) are untested; only `resolveModel` is.
- **TS paper-trading module** - `src/lib/paper-trading.ts` (demo dataset + `computeStrategyReadiness`) is untested in TS; its Python counterpart is tested.
- **Supabase fetch helpers and demo fallback** - `src/lib/data` paths are untested.
- **E2E** - no Playwright. No browser-level test of onboarding, PIN gate, nav, or mobile density.
- **AI evals** - guardrail unit tests exist (above); a model-in-the-loop eval harness does not. Spec: `docs/testing/ai-evals.md`.

When touching any of these, the rule from the repo doctrine applies: if no tests exist, say so in the handoff - never silently skip.

## Priorities for the next test investment

1. Webhook route tests (auth gate, rate limit, command parsing) - highest security value per test.
2. Contract test pinning `WHATSAPP_TEMPLATE_BODIES` byte-stability (registered templates must never drift).
3. `src/lib/paper-trading.ts` readiness gates (the automation gatekeeper deserves its own suite).
4. A smoke E2E: app boots in demo mode, all 24 nav surfaces respond 200.
