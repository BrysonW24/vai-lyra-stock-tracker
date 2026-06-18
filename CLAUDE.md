# CLAUDE.md - Lyra Stock Oversold-Recovery Radar

## What is this?

Lyra is a research-first tech stock oversold-recovery scanner. It looks for beaten-down names showing an early turn - the score rewards an RSI in the 35-50 reset band, a still-negative-but-improving MACD histogram, and price sitting within ~10% of its 60-period low. It tracks hourly OHLCV data, calculates RSI, MACD, moving averages, volume ratios, deterministic score components, signal lifecycle states, portfolio overlays, watchlist overlays, and alert payloads before presenting them in a dense dashboard. Note: it is a dip/early-turn (mean-reversion) strategy, not a buy-strength momentum strategy - a high score means "beaten-down name turning up," not "stock breaking out to new highs."

It runs in three modes: **demo** (no keys, built-in sample data), **live** (Supabase + a market-data source), and **AI** (bring your own key + model for plain-English explanations). Run `npm run doctor` to see which mode you're in.

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS.
- Data access: Supabase anon key for read-only dashboard queries.
- Worker: Python with pandas, yfinance, ta, Supabase Python client, requests, pytest.
- AI: provider/model-agnostic gateway (`src/lib/ai/gateway.ts`) - Anthropic, OpenAI, OpenRouter, Gemini. Bring your own key + model.
- Scheduler: GitHub Actions workflow at `.github/workflows/hourly-stock-scanner.yml`.
- Notifications: Telegram Bot API from the backend worker only.

## Project Structure

- `src/app/` - Next.js App Router pages for overview, radar, ticker detail, alerts, and settings.
- `src/components/` - dashboard layout and analytics display components.
- `src/lib/` - Supabase fetch helpers, demo fallback data, env validation, formatting helpers, and the AI gateway (`src/lib/ai/`).
- `workers/stock_scanner/` - Python scanner package for universe loading, market data, indicators, derived features, scoring, overlays, alerts, Supabase persistence, Telegram, and scheduler guard.
- `contracts/notifications/` - JSON contracts for the AI notification layer (schema, templates, test register).
- `sql/` - Supabase schema and seed SQL.
- `tests/` - focused Python worker tests.

## Key Commands

- `npm run dev` - run the dashboard locally.
- `npm run build` - build the Next.js frontend.
- `npm run type-check` - run TypeScript checks.
- `npm run test` - run frontend unit tests (Vitest).
- `npm run doctor` - report which mode you're in and what's configured.
- `npm run worker:scan` - run the scanner worker locally.
- `npm run worker:test` - run worker tests.

## Conventions

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
- Backend/middleware owns RSI, MACD, score, action state, lifecycle state, portfolio risk state, watchlist trigger state, and alert payload truth.
- Frontend may format, sort, and color values, but must not recalculate core trading logic.
- The dashboard must gracefully fall back to demo data when Supabase env vars are not configured.
- The worker should be provider-abstracted so yfinance can be replaced later.
- AI explains; the deterministic engine decides. The AI never invents a number and never gives advice - research only.
- Use a plain hyphen `-` in copy, never an em dash.

## Environment Variables

See `.env.example`. Frontend variables are `NEXT_PUBLIC_*`; worker-only secrets are unprefixed and must stay backend-only.
