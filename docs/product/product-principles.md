# Product principles

> **Purpose:** The seven principles every Lyra decision is tested against, each grounded in shipped code and stated with what it concretely forbids. | **Audience:** Anyone building, reviewing, or writing copy for Lyra. | **Status:** Active | **Owner:** Bryson Walter | **Last updated:** 2026-06-11

These are not values-poster words. Each principle is enforced somewhere in the codebase today, and each has a forbid-list that makes violations reviewable. When a feature idea conflicts with a principle, the principle wins until the principle itself is deliberately changed in this doc.

## 1. Research-first

Lyra is a research console that may one day carry a bot - not a bot with a dashboard bolted on. The product's job is to make the user a better analyst of momentum, themes, and risk.

Grounding: the entire signal pipeline ends in displays and alerts, not orders. The only consumer of the pre-trade engine is the Paper Trading simulator and the Bot Readiness demo (`src/lib/trading/risk-engine.ts` header comment). The roadmap doctrine is "bot last, foundations first" (`docs/product/trading-bot-readiness.md`).

**Concretely forbids:** shipping any execution capability before the research surfaces are trustworthy; prioritising bot features over data quality; any UI copy that frames Lyra as a trading bot today.

## 2. Evidence-first

Every claim a user sees traces back to evidence: a signal row, a deterministic trigger reason, a citation. If the evidence does not exist, the claim does not ship.

Grounding: `NotificationEvent` carries a mandatory deterministic `triggerReason` and `evidenceRefs` (`src/lib/notifications/types.ts`); `OrderIntent` freezes `signalSnapshot`, `riskSnapshot`, and `evidenceSnapshot` "so the decision is auditable forever" (`src/lib/trading/types.ts`); AI outputs require citations (`enforceCitations` in `src/lib/ai/guardrails/schema.ts`) and numbers absent from evidence are flagged as fabricated (`assertNoFabricatedNumbers`); paper trades freeze a `thesisSnapshot` at entry (`src/lib/paper-trading.ts`).

**Concretely forbids:** uncited AI claims; alerts without a trigger reason; presenting stale data as current without a staleness disclosure (an explicit `AI_NEVER` entry in `src/lib/ai/policy.ts`); editorial "facts" that bypass the `content/` JSONL layer where they would be reviewable and updatable.

## 3. Risk-first

The risk machinery was built BEFORE the trading machinery, and it fails closed. Unknown or missing context refuses; an unconfigured limit is a failing check, not a default-open.

Grounding: `runPreTradeChecks` is "intentionally conservative: unknown or missing context fails closed" - an unconfigured daily-loss limit FAILS the `max_daily_loss` check; stale quotes fail `quote_fresh`; `DEFAULT_TRADING_SETTINGS` ships disabled with zero notional allowance (`src/lib/trading/risk-engine.ts`, `src/lib/trading/types.ts`). The 11-switch kill vocabulary exists before there is anything to kill (`ALL_KILL_SWITCHES`). The paper simulator charges fees and slippage on every fill so P/L "is honest about cost drag instead of flattering the strategy" (`src/lib/paper-trading.ts`).

**Concretely forbids:** default-open anything; optimistic fills or cost-free simulations; loosening a blocking check to make a demo look nicer; shipping a new risky layer without its kill path documented in `docs/runbooks/kill-switch.md`.

## 4. AI-native: AI explains, deterministic decides

AI is woven through the product as a narrator and analyst - never as a decision-maker. Deterministic code owns every number, every routing decision, every (future) order.

Grounding: "LLMs never generate orders" (`src/lib/trading/types.ts`); "AI never originates notifications - it may only phrase a payload the deterministic router has already approved" (`src/lib/notifications/types.ts`); the AI layer's tool surface is read-only and `create_order`/`send_notification`/`change_settings` are named forbidden tools refused for every agent (`src/lib/ai/policy.ts`); the Daily Brief route grounds the model on deterministically computed facts and falls back to the deterministic render on any failure (`src/app/api/ai/brief/route.ts`).

**Concretely forbids:** any AI write path into the risk engine, router, settings, or portfolio; AI-originated alerts; an AI feature without a deterministic fallback; treating external or channel-inbound text as instructions (it is fenced data - `src/lib/ai/guardrails/injection.ts`).

## 5. Mobile-first

Lyra is built to be read on a phone in seconds: maximum information density that stays calm and legible at 390px. Density is the feature, not the compromise.

Grounding: the global 15px rem base in `src/app/globals.css` ("Global density baseline"); 9px micro-labels across stat components (`text-[9px]` in `src/components/MetricStrip.tsx`, `ChartPrimitives.tsx`, `FeatureTiles.tsx` and others); one-eye-line stat grids (`grid-cols-4` in `ExecutiveStrip.tsx`); the always-on horizontally-scrollable bottom nav so every surface is reachable without a menu (`src/components/AppShell.tsx`); the iOS 16px input pin so density never triggers focus-zoom (`globals.css` coarse-pointer rule). Full standard: `docs/product/mobile-experience.md`.

**Concretely forbids:** desktop-only layouts; stat values larger than `text-sm md:text-base`; horizontal overflow at 390px outside deliberate carousels/ticker strips; sub-16px font-size on text inputs (breaks iOS); hiding core surfaces behind hamburger menus.

## 6. Demo-safe

With zero keys configured, the entire product runs on built-in demo data and makes no privileged calls. Every integration degrades to an honest no-op, never a crash and never a silent fake-success.

Grounding: `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK` (`.env.example`); "Demo mode is the safe default" (`SECURITY.md`); unset `TELEGRAM_BOT_TOKEN` / `WHATSAPP_ACCESS_TOKEN` produce `demo_logged` DeliveryRecords that say what WOULD have been sent (`src/lib/notifications/telegram.ts`, `whatsapp.ts`); unset webhook secrets fail closed (401/403); the worker no-ops safely with no Actions secrets (`.github/workflows/hourly-stock-scanner.yml` in the public repo).

**Concretely forbids:** features that require keys to merely render; error screens in keyless mode; demo states that pretend to be live (the `demo_logged` status exists precisely so demo sends are never mistaken for real ones); committing any real `.env`.

## 7. No-advice

Lyra produces research context, never personalised financial advice. Every signal-like output says so, in code, not just in a footer.

Grounding: "Signal logic is research software, not investment advice" (`CLAUDE.md` conventions); the deterministic notification templates append `RESEARCH_SUFFIX = 'Research, not advice.'` (`src/lib/notifications/templates.ts`); the WhatsApp approval template hard-codes "This is a research platform - live execution disabled" (`src/lib/notifications/whatsapp-templates.ts`); "Never give buy/sell advice or price targets" is a system-prompt rule on the AI brief (`src/app/api/ai/brief/route.ts`) and an `AI_NEVER` entry (`src/lib/ai/policy.ts`); `/paper` and `/trading` render explicit research-only footers (`src/app/paper/page.tsx`, `src/app/trading/page.tsx`).

**Concretely forbids:** buy/sell/hold recommendations; price targets; "you should" phrasing anywhere in product copy or AI output; removing the research-not-advice suffixes to save characters; marketing claims that imply returns.

## Using the principles

In review, the question is never "is this nice?" but "which principle does this serve, and which does it strain?" A change that strains a principle needs either a redesign or an explicit, dated amendment to this document - silent erosion is the failure mode these exist to prevent.
