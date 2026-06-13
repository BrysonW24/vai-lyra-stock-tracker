# Live Data 24/7 Conversion - Technical Spec

> How Lyra goes from "hourly cron + curated samples" to an **always-on, always-live**
> research system. Companion to `dr-engagement-finance-app.md`, `dr-charts-for-a-trader.md`,
> and the evidence-pipeline runbook. Status: engineering plan, not yet built.
>
> **One-line thesis:** the product brain (what's important / when to alert / cite-or-refuse)
> is already built; this spec wires a **tiered, push-based nervous system** underneath it so
> data is current 24/7 independent of whether a user is online.

---

## 1. Current state (grounded)

| Layer | Today | Limit |
|---|---|---|
| Ingest | `workers/stock_scanner/` (Python), **hourly GitHub-Actions cron**, market-hours guard, **yfinance** | best-effort, ~hourly, one fragile source, burns Actions minutes |
| Store | Supabase (service-role writes; anon read) | fine; no Realtime publication on data tables |
| Serve | Next.js server components, **statically prerendered + ~10-min ISR**, demo fallback | not push; in-session staleness up to ISR window |
| Evidence surfaces | `/awards /flows /filings /supply-chain` + macro chart tabs = **curated, `*_SAMPLE` flagged** | no live feed at all |
| Brain | deterministic engine, signal-events, Prime Setups, Catalyst Radar, notification router (instant/digest, quiet hours), AI cite-or-refuse | **built** - just fed hourly demo data |

The brain is done. The nervous system is the gap.

---

## 2. Target architecture

```
ALWAYS-ON WORKERS (Coolify-Sydney)            SUPABASE                     FRONTEND (Vercel)
┌───────────────────────────────┐     ┌────────────────────┐     ┌──────────────────────────┐
│ price-stream  (wss, mkt hours) │────▶│ market_quotes      │     │ static shell (instant)   │
│ edgar-poller  (1-5 min)        │────▶│ filings, insider_tx│──┐  │ + SSR/ISR first paint    │
│ gov-poller    (daily)          │────▶│ gov_awards         │  │  │ + Realtime subscription  │
│ fred/rba-poller (on release)   │────▶│ macro_series       │  ├─▶│   to YOUR rows (RLS)     │
│ transcript-poller (earnings)   │────▶│ transcript_passages│  │  │ = live UI, no refresh    │
│ scanner (on new candle)        │────▶│ stock_signals      │  │  └──────────────────────────┘
└───────────────────────────────┘     └─────────┬──────────┘  │
                                                 │ trigger      │ Realtime (postgres_changes)
                                                 ▼              │
                                    ┌──────────────────────────┴┐
                                    │ deterministic engine       │  recompute signals/events
                                    │ → notification router       │  instant push OR hourly digest
                                    └────────────────────────────┘  (per-user preference, built)
```

Three moves make it "always alive":
1. **Workers write continuously**, decoupled from user presence - Supabase is always current.
2. **Supabase Realtime** pushes row changes to connected clients - the UI updates without a refresh and reflects the latest the moment a user connects.
3. **The engine + notification router** (already built) decide what matters and when to interrupt, reading the live stream instead of the hourly batch.

---

## 3. The freshness contract (tier by source - do NOT make everything real-time)

| Source | Auth | Cadence | Mechanism | Cost |
|---|---|---|---|---|
| Market prices/quotes | keyed | seconds, market hours | **websocket** consumer | **licensed (the cost center)** |
| Momentum signals/scores | n/a | on new candle (1-5 min) | scanner recompute | compute only |
| SEC filings 8-K/10-Q/S-1 | keyless (UA) | poll 1-5 min | `data.sec.gov` + full-text | free |
| Insider Forms 3/4/5 | keyless (UA) | poll 5-15 min | EDGAR submissions XML | free |
| Gov contracts/grants (US) | key (free) | daily | USAspending / SAM.gov / Grants.gov | free |
| Gov contracts/grants (AU) | keyless | daily | AusTender, GrantConnect, data.gov.au (CKAN), ARENA | free |
| Macro (US) | key (free) | on release | FRED API | free |
| Macro (AU) | keyless | on release | RBA statistical tables (CSV) | free |
| Transcripts | varies | on earnings date | IR pages / licensed vendor | free-ish / licensed |
| News / intelligence | varies | continuous | news API / GDELT | varies |

**Implication:** stream the one thing that's truly real-time (prices); event/poll everything
else on its own clock. The entire evidence layer (EDGAR/gov/FRED/RBA) is **free to run live**.

---

## 4. Component design

### 4.1 Always-on worker host (Coolify-Sydney)

Replace the hourly cron with a small **supervised process group** (one container, a process
manager, or a tiny PM2/systemd set):

- **`price-stream`** - long-running websocket consumer (Finnhub `wss://ws.finnhub.io` or
  Polygon). Subscribes to the universe; on tick, upserts `market_quotes`. Sleeps outside
  market hours (reuse `scheduler_guard.should_run_now`).
- **`scheduler`** - an in-process cron (APScheduler / `schedule`) running each poller at its
  tier cadence. Pollers are pure functions: fetch → normalise → resolve entity (ticker/theme)
  → idempotent upsert.
- **GitHub Actions cron stays as a fallback heartbeat** (e.g. every 30 min) that runs a
  catch-up scan if the always-on host is down - belt and braces, not the primary.

Alternative for the lighter pollers: **Supabase `pg_cron` + Edge Functions** (the daily/
on-release feeds), keeping only `price-stream` on Coolify. Either works; the rule is
*one always-on process owns the websocket*, everything else is scheduled.

### 4.2 Per-source ingestors (one module each, in `workers/`)

Each ingestor implements: `fetch() → parse() → resolveEntities() → upsert()`, with:
- **Idempotency** via a `content_hash` (or natural key) so re-runs don't duplicate.
- **Rate discipline**: SEC fair-use (descriptive `User-Agent`, ≤ ~10 req/s, cache ETags);
  FRED/USAspending request budgets; backoff + jitter.
- **Entity resolution**: map filer CIK / agency recipient / series → ticker + World Radar
  theme. This is the non-trivial part - keep a reviewed mapping table, log unresolved rows.
- **Provenance**: every row carries `source_url`, `observed_at`, `published_at`.

Canonical endpoints (confirm exact params at build):
- EDGAR submissions `https://data.sec.gov/submissions/CIK{10-digit}.json`; full-text
  `https://efts.sec.gov/LATEST/search-index?q=...`; Forms 3/4/5 in the submissions feed.
- USAspending `https://api.usaspending.gov/api/v2/search/spending_by_award/` (POST).
- SAM.gov `https://api.sam.gov/...` (free key). Grants.gov search API.
- AU: AusTender + GrantConnect data exports; `https://data.gov.au` CKAN
  (`/api/3/action/datastore_search`); ARENA publishes via data.gov.au.
- FRED `https://api.stlouisfed.org/fred/series/observations` (free key). RBA statistical
  tables (CSV download per table).

### 4.3 Supabase schema (one table per source)

```sql
create table filings (
  id text primary key,                 -- accession no
  symbol text, cik text,
  form text, what_changed text,
  passages jsonb,                       -- [{section, excerpt}]
  source_url text not null,
  filed_at timestamptz not null,
  observed_at timestamptz default now(),
  content_hash text unique
);
-- analogous: insider_tx, gov_awards, capex_events, transcript_passages,
--            macro_series (key,label,region,value,delta,observed_at),
--            market_quotes (symbol, price, change_pct, ts)

alter table filings enable row level security;
create policy "public read filings" on filings for select using (true);  -- evidence is public-read
-- per-user tables (portfolio, notes, research_queue) use: using (auth.uid() = user_id)

-- live push:
alter publication supabase_realtime add table filings, insider_tx, gov_awards,
  capex_events, transcript_passages, macro_series, market_quotes, stock_signals;
```

Evidence/market tables are **public-read** (RLS `true`); anything user-owned stays
`auth.uid() = user_id`. Only the **service role** (server-only, in the worker) writes.

### 4.4 Frontend conversion (per surface, mechanical)

Each surface already calls a `list*()` from a curated lib (`lib/filings.ts`, `lib/gov-awards.ts`,
`lib/insider-flow.ts`, `lib/capex-events.ts`, `lib/transcripts.ts`, `lib/chart-pack.ts`,
`lib/market-board.ts`). Convert in four steps:

1. **Read the table** in the server component (`supabase.from('filings').select()...`),
   **falling back to the curated array when empty** - identical to `getDashboardData()`'s
   demo fallback. SSR/ISR stays as the instant first paint.
2. **Subscribe for liveness** with a small client hook:
   ```ts
   supabase.channel('filings')
     .on('postgres_changes', { event: '*', schema: 'public', table: 'filings' }, refetch)
     .subscribe();
   ```
   Now the surface is live in-session without a refresh.
3. **Drop the `*_SAMPLE` flag** (and the "illustrative" note) once the table is populated.
4. **Freshness stamp** - render `observed_at` as "updated 2m ago" so liveness is visible and
   trusted.

Keep the curated arrays as the **offline/empty fallback** forever - the app must never blank.

### 4.5 Engine + notifications (already built - just rewire the input)

The scanner recomputes signals/events on each new candle and writes `stock_signals` +
signal-events. The **notification router** consumes threshold crossings and fires per the
user's preference - **instant push** (Realtime + Telegram/WhatsApp) or **hourly digest**
(batched, quiet-hours-aware, deduped). No new code in the brain; point it at the live stream.

---

## 5. Migration phases (each shippable; free sources first)

- **Phase 0 - reference pipe (1 surface end-to-end).** Stand up the Coolify worker host + a
  `filings` table + Realtime + the EDGAR poller + convert `/filings` to read-table-with-
  fallback + a freshness stamp. Proves the whole pattern with a **keyless** source.
- **Phase 1 - evidence layer (free/keyless).** Add insider (Forms 3/4/5), gov awards (US +
  AU), FRED/RBA macro, transcripts. All cheap to run live; closes the highest-priority gaps
  with real data.
- **Phase 2 - market data (licensed).** `price-stream` websocket + the `FinnhubProvider`;
  scanner recompute on live candles → live Command / Charts / signals. This is where the cost
  + entitlements work lands.
- **Phase 3 - liveness + ops.** Realtime subscriptions on every live surface, notification
  wiring to the live event stream, staleness monitor + last-good fallback, caching +
  entitlements for market data.

---

## 6. Cost & scaling

- **Frontend: ~free at any scale.** Static + CDN + per-user Realtime (RLS-scoped). 10 or
  10,000 users cost the same to serve; no per-request compute.
- **Supabase:** Realtime + Postgres on a paid tier; the load is row writes + fan-out, modest
  for this data volume. Connection count scales with concurrent users (Realtime) - fine into
  the thousands on standard tiers.
- **Worker host (Coolify-Sydney):** one small always-on container (+ the websocket). Cheap.
- **Cost center = licensed market data.** EDGAR/USAspending/AusTender/GrantConnect/FRED/RBA
  are free/keyless. Control market-data cost with: cache quotes server-side (30-60s),
  entitlement gates (only stream the user's universe), and a single shared consumer (not
  per-user streams).

---

## 7. Observability & reliability

- **Freshness stamp** on every live surface (`observed_at` → "updated Nm ago").
- **Staleness monitor:** a heartbeat per pipe; if `max(observed_at)` exceeds the pipe's SLA,
  flag the surface ("data delayed"), fall back to last-good, and alert ops via Telegram.
- **Idempotent writes** (`content_hash`/natural key) so retries + catch-up runs are safe.
- **Backfill** path per pipe (re-pull a window) for cold starts + gap recovery.
- **Market-hours guard** (`scheduler_guard`) so the price stream + scanner sleep off-hours.
- The **GitHub Actions fallback heartbeat** catches a dead worker host.

---

## 8. Security & compliance

- **RLS everywhere**; service-role key server-only (worker), never shipped to the client.
- **Provenance is mandatory** - every row stores `source_url` + timestamps. This is what lets
  the **grounded AI copilot** cite the exact passage + freshness (cite-or-refuse already
  enforced in `src/lib/ai/`).
- **SEC fair-use:** descriptive `User-Agent`, caching, rate limits.
- **Licensing:** market-data redistribution terms + transcript/news rights are the real
  constraints - store rights metadata, don't redistribute beyond entitlement.
- Research-not-advice framing stays on every surface.

---

## 9. Flip-to-live checklist (per surface)

1. Worker ingestor writing the table (idempotent, with provenance).
2. Table + RLS + added to `supabase_realtime` publication.
3. Surface `list*()` reads the table → curated fallback when empty.
4. Client Realtime subscription + freshness stamp.
5. Drop the `*_SAMPLE` flag + "illustrative" note.

**Acceptance per surface:** data matches the official source within the pipe's SLA; the UI
updates live in-session; it degrades to last-good (never blank) if the feed stalls; every row
links to its source with a timestamp.

---

## 10. Bottom line

Convert by **standing up one always-on worker host, adding Supabase Realtime, and walking the
surfaces from curated-with-fallback to live one pipe at a time** - free/keyless evidence
sources first, licensed market data last. The frontend and the decision brain don't change;
they were built for this. The result is exactly the brief: always listening, always alive,
current the moment a user connects - with real-time *or* hourly-digest delivery as a per-user
choice, not a weekly batch.
