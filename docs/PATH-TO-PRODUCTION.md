# Lyra — Path to Production

The single source of truth for getting Lyra from "demo-first multi-user-ready app" to a
live, multi-tenant product. Pairs with `docs/MULTI-USER-GO-LIVE.md` (the Supabase
provisioning steps) and `docs/vision.md` / `docs/horizons.md` (the product north star).

**Legend:** ✅ done · ◑ partial · ⏳ not started · 🔧 needs you (provisioning/keys/deploy)

---

## The nine phases

### Phase 1 — Backend stand-up ✅
- ✅ Canonical multi-user schema (`supabase/migrations/001–017`) applied to project
  `droqoofjbclszlceowrp` — 32 tables, RLS on every table, signup→profile bootstrap
  trigger live, seed data in.
- ✅ Supabase MCP wired in `.mcp.json`; `config.toml` carries the real project ref.

### Phase 2 — Live market data ⏳ 🔧
- 🔧 Add a market-data provider key (Finnhub recommended) to the worker env.
- 🔧 Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend flips
  from demo to live automatically — `data.ts` already reads live, RLS-scoped).
- 🔧 Run `npm run worker:scan`; confirm rows in `stock_candles`, `stock_indicators`,
  `stock_signals`, `stock_scanner_runs`.
- Decision: once live history exists, choose whether to keep the deterministic
  `buildScoreHistory` or read real history from `stock_signal_scores`.

### Phase 3 — Per-user worker loop ◑
- Worker models + schema already carry `user_id`; single-operator `DEFAULT_USER_ID`
  stamping works (149 tests green).
- Remaining: generalise `main.py` to load all active users and build one overlay set
  per user from the shared global signals (compute signals once, fan out overlays).

### Phase 4 — Alerts end-to-end ⏳
- Engine + Telegram client exist; `stock_alerts` + `notification_channels` carry `user_id`.
- Remaining: per-user preference gating (`user_alert_preferences` / `ticker_alert_preferences`
  / quiet hours / mutes) and delivery to each user's saved chat id.

### Phase 5 — Frontend write paths ◑
- ✅ Portfolio + watchlist writes go through the RLS-enforced server client, require
  auth, stamp `user_id` (security hole closed).
- Remaining: persist onboarding/operator-profile + account profile/settings to
  `operator_profiles` / `onboarding_progress` / `profiles` / `user_settings` for
  signed-in users (localStorage stays the demo fallback).

### Phase 6 — AI layer ◑
- ✅ Deterministic Daily Brief shipped (the grounding facts).
- Remaining: AI-phrased-but-grounded brief + per-ticker explain, gated by Account AI
  mode. See "AI integration spec" below.

### Phase 7 — Quality gates ⏳
- ✅ Worker suite green (149 tests). ✅ `tsc` clean.
- Remaining: frontend test runner (Vitest) + unit tests; a real `next build`; a CI
  workflow (type-check + lint + vitest + pytest on every push).

### Phase 8 — Deploy ⏳ 🔧
- 🔧 Deploy frontend to Vercel with the two `NEXT_PUBLIC_*` vars.
- 🔧 Schedule the worker (GitHub Actions hourly workflow or cron) with worker env.

### Phase 9 — Launch hardening ⏳
- 🔧 Legal: "research only, not financial advice" surfaced app-wide, privacy policy,
  terms (required before public signups).
- 🔧 Rate-limit auth + API routes; re-verify RLS with a second real account.
- 🔧 Error monitoring + Supabase backup/retention; cost controls via `api_usage_logs`.

---

## Critical paths

- **You live (single operator):** Phase 1 ✅ → Phase 2 → Phase 8. Everything else is additive.
- **Open to other people:** add Phase 3 (per-user worker), Phase 5 remainder (write paths),
  and Phase 9 §legal at minimum.

---

## AI integration spec

**Core principle (already product doctrine):** the backend is truth, AI is interpretation.
Deterministic engines decide the *what* (score, status, action-state); AI only ever
explains the *why* and *so-what* in plain English. AI never invents a number or overrides
a recommendation — which is also the compliance guarantee ("research, not advice").

**Placement philosophy:** lead with AI *embedded in context*, not a floating chatbot
bubble. A generic bubble invites the open-ended questions that are easiest to hallucinate
on. Offer one scoped **"Ask Lyra" panel** (grounded strictly in the user's own
portfolio/watchlist/signals) as the conversational surface; a bubble can come later.

**Surfaces (priority order):**

1. **Daily Brief, AI-phrased (Phase 6, first build).** Same deterministic facts already
   computed by `buildDailyBrief`, written in natural prose and *tailored to the user's
   profile* (beginner vs experienced, learning style — captured in onboarding). Cached
   daily → near-zero cost. Deterministic version is always the fallback.
2. **"Explain this setup" on the ticker page.** Turns the deterministic score breakdown
   into plain English + "what would invalidate this", on demand.
3. **Typed UI cards (GenUI).** AI tool-calls render as structured cards (comparison table,
   sizing widget, "what changed since yesterday"), never raw walls of text. Per
   `.claude/rules/ai-features.md`.
4. **Attention triage.** "Here are the 3 setups worth your attention today and why" —
   the vision's "ranked, explainable decision queue".
5. **Alert enrichment.** Deterministic decides *when* an alert fires; AI writes the
   one-line human sentence in the Telegram/in-app message.
6. **Trade-review coaching.** AI reads the user's `trade_day_snapshots` and summarises
   "what the setup looked like on entry, what played out, what to learn" — personal,
   sticky pattern recognition.
7. **Education personalisation.** Uses the onboarding learning-style/knowledge signals to
   pitch explanations at the right level.
8. **"Ask Lyra" panel (grounded chat).** Free-form questions answered ONLY from the user's
   grounded data — a grounded analyst, not a generic chatbot.

**Cost/architecture:** tiered. Deterministic templates do the bulk for free; AI is
reserved for interpretive moments; briefs cached; Account already exposes off /
bring-your-own-key / hosted modes. Prompts versioned, eval-gated before promotion, and
no tenant data sent to a model unless the user enables AI (per the rules).

**Mental model:** Lyra is a deterministic analyst that can talk — not a chatbot that
shows stock data. AI is the narration layer over a trustworthy engine.

---

## What's verifiable here vs. needs your switches

Everything **code/config** for all nine phases can be built and verified in-repo
(`tsc` + `pytest`). The steps that inherently need *you* are the 🔧 items: a Supabase
project's keys (done), a market-data provider key, a Vercel deploy, a cron schedule, and
live end-to-end verification with real accounts. Those are listed explicitly above and in
`docs/MULTI-USER-GO-LIVE.md`.
