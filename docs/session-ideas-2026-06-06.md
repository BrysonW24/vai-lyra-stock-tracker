# Parked ideas — captured 2026-06-06

Ideas raised during the Holdings Momentum / carousel / changelog session that are
worth building but were intentionally deferred. Promote into `horizons.md` when scheduled.

## 1. Macro / economic context surface (AU-first)
A surface (not inside the stock panels — it's market-wide, not ticker-specific) showing
local macro context for a configurable **country of residence** (default Australia):

- RBA **cash rate** + recent moves
- **Inflation** (CPI) and interest-rate context
- **RBA chart packs** (published monthly) — surface/link the latest
- **ABS** releases (jobs, migration, resources) — talks to the local market, not the Nasdaq

Rationale: helps the user understand the *local* market backdrop (jobs, migration, rates)
even though it isn't correlated to US tech / Nasdaq names. Keep it as its own "Macro" route
or a top-of-Command strip, clearly separated from the ticker signal.

Data sources to evaluate: RBA statistical tables / chart-pack PDFs, ABS API, an econ-data
provider. None wired yet — would need a connector + a country-of-residence setting.

## 2. "Performance" carousel slide (4th slide per holding)
Add a 4th slide to the holdings dossier carousel (Chart → Setup → Intel → **Performance**):
win rate, recent setups → outcomes, simple backtest read. The data libs already exist
(`src/lib/outcomes.ts`, `src/lib/backtest.ts`, `src/lib/trade-snapshots.ts`).

## 3. What's New changelog — shipped today, portable upward
`/whats-new` shipped 2026-06-06 (Wiz §I pattern: week-grouped, category-filtered feed).
Same pattern is already scoped for the **founder portal** as `/portal/whats-new` in
`vd-business/design-system/references/annotations/wiz-density-patterns.md` §I — this app's
implementation is a working prototype of that. Manifest-driven via `src/lib/release-notes.ts`.

## Real-data status at time of capture
Live: TradingView candle charts only. Demo: signals/scores/portfolio/intel (no Supabase
keys), news (no Finnhub key), alerts/AI off. `npm run doctor` is the source of truth.
