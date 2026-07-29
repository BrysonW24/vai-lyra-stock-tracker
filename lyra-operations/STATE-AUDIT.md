# lyra-operations - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
The worker fleet, its scheduling, and the incident/enforcement discipline that keeps the loops honest:
the hourly scan heartbeat, the nightly maintenance sweep, the RBA decision alert, timezone/DST-correct
cron gating with dropped-slot defenses, the horizon-2 workers (events, fundamentals, intelligence,
scout), and the learning ledger. Maps to V9 (Worker Fleet & Scheduler, 90/100).

## Lyra as it is today
Five Python workers ship on disk (`workers/stock_scanner`, `events_worker`, `fundamentals_worker`,
`intelligence_worker`, `scout`; snapshot line 43) driven by three scheduled GitHub Actions workflows
(plus `ci`, `deploy-smoke`, `sync-solo-branch`).

- **Hourly scan** (`hourly-stock-scanner.yml`) fires two offset crons `17 * * * *` and `47 * * * *`
  (`:15-16`), gated to a single run by `concurrency.group: hourly-stock-scanner, cancel-in-progress: false`
  (`:19-21`), 15-minute timeout. The doubled cron is a deliberate dropped-slot defense: a comment at
  `:9-14` records the single `:05` cron actually firing every ~2h for days, dropping the US open. On
  failure it pages Telegram + Slack (`:64-79`); every run re-enables the workflow via
  `gh api -X PUT .../enable` to reset GitHub's 60-day idle auto-disable clock (`:84-88`).
- **Nightly maintenance** (`nightly-maintenance.yml`) fires `5 22 * * 1-5` (22:05 UTC, after the US
  close year-round; `:12-13`) as two jobs. `schema-drift` runs `check-schema-drift.mjs --require-db`
  and `check-data-economics.mjs --require-db` (`:45,:52`) and goes red on its own. `maintain` runs the
  four horizon-2 workers (`:89-96`), then `outcome_job` + `digest_job` (`:99,:102`), then the
  notification-dispatch sweep (`:107-121`), then a "Report worker failures" step that fails the run at
  the END if any worker recorded a failure (`:127-135`).
- **RBA decision alert** (`rba-decision-alert.yml`) fires 2:31pm Sydney year-round via two month-gated
  crons - `31 4 * 4-10 1-5` (AEST, UTC+10) and `31 3 * 1-3,11,12 1-5` (AEDT, UTC+11) (`:19-22`) - so a
  fixed UTC offset cannot drift an hour for half the year. Calendar-gated by
  `macro_calendar.RBA_DECISION_DATES` (~8 real runs a year, ~250 cheap no-ops; `:8-9`).

The scan itself (`workers/stock_scanner/main.py`) opens a run row, gates on `should_run_now`
(`:215`, finishes `status="skipped"` if out of window), captures market context best-effort
(`:172-186`, any failure swallowed so it can never break the deterministic scan), loops tickers ->
indicators -> signal -> alert routing, runs a per-user overlay loop (`:270-303`), and always calls
`finish_run` with an explicit status/counts, including `status="failed"` + re-raise on exception
(`:423-437`).

## How it works
Market-hours gating is real and DST-correct. `scheduler_guard.should_run_now`
(`scheduler_guard.py:19-34`) evaluates the weekday AND clock in `America/New_York` (`:14,:29`) against
a widened `9:00-16:30 ET` band (`:15-16`) so the twice-hourly cron reliably catches both open and
close, and DST is handled by the zone rather than a fixed UTC window. `force_scan` and
`enable_market_hours_guard=false` both bypass (`:20-24`). This is pinned by `tests/test_scheduler_guard.py`
- including a DST-tracking case asserting summer-open runs and winter-premarket does not (`:46-57`),
a weekend block (`:34-37`), and the force-scan bypass (`:40-43`).

The horizon-2 workers are best-effort but never invisible. Each nightly worker step ends
`|| echo "<name>" >> "$RUNNER_TEMP/worker-failures"` (`nightly-maintenance.yml:89-96`); the final
"Report worker failures" step (`:127-135`) turns the run red and lets "Notify on failure" fire. Both
the fundamentals and intelligence workers gate persistence on `provider.is_live`
(`fundamentals_worker/main.py:58,77`; `intelligence_worker/main.py:80`) - the demo provider fetches
for shape but writes nothing, so fabricated financials/news never reach the live tables. The
fundamentals worker also fails the run when it fetched rows but persisted zero (`main.py:109-116`),
the earned fix for the 42P10 partial-index bug.

## Strengths (verified)
- **Dropped-slot and idle-disable defenses are real, not aspirational.** Two offset hourly crons
  (`hourly-stock-scanner.yml:15-16`) plus a per-run keepalive PUT (`:84-88`), both with the incident
  that motivated them documented inline.
- **TZ/DST correctness is proven by test, not just reasoned.** `scheduler_guard.py` uses
  `America/New_York`; the RBA workflow uses month-split AEST/AEDT crons; `test_scheduler_guard.py:46-57`
  pins the DST boundary.
- **"A green must be able to go red" is enforced in the fleet.** The nightly's record-continue-fail-at-end
  pattern (`nightly-maintenance.yml:82-96,127-135`) directly replaced the `|| echo "(non-fatal)"` that
  hid the events + fundamentals workers failing for months (`harness-incidents.jsonl:1`), and the
  fundamentals fetched-but-zero guard (`fundamentals_worker/main.py:109-116`) is pinned by
  `tests/test_worker_honesty.py:146-155`.
- **Live-vs-demo honesty on the write path is tested.** `test_worker_honesty.py:209-260` asserts the
  demo providers persist nothing for events, scout and intelligence.
- **Every loop is documented end to end.** `LOOPS.md` lists 10+ loops with cadence, sinks, and the
  guard that closes each (scan `:16`, horizon-2 `:257-268`); `HARNESS.md:112-120` names the two core
  schedules and flags any unscheduled worker as "built-but-not-wired".
- **Incident memory is machine-readable and gate-checked.** `harness-incidents.jsonl` (13 rows) parses
  under `check:ledgers` (`HARNESS.md:31`), so a ledger that stops teaching goes red.

## Gaps, risks, what is missing
- **[correctness] Hype meter renders demo scores under a 'live' label (V9 gap 1, S, +2).**
  `intelligence-live.ts:196` returns `hypeMap: Object.keys(hypeMap).length > 0 ? hypeMap : demoTickerHypeMap`
  while `source: 'live'` (`:197`). When `hype_scores` is empty (realistic on a partially hand-applied
  migration - `LOOPS.md:263` notes intelligence "needs migration 049 applied"), the feed presents
  fabricated demo literals under a live banner - a "one law" spirit violation the remediation wave
  re-introduced. Fix: when source resolves to 'live', never fall back to `demoTickerHypeMap`.
- **[functionality] `valuation_metrics` is written nightly with zero readers (V9 gap 3, S, +1).**
  `fundamentals_worker/main.py:85-86,219-222` upserts the table every live night, but a repo-wide grep
  finds no `valuation_metrics` reference under `src/` - `fundamentals-live.ts:93` deliberately
  recomputes valuation instead. A table written nightly that nothing consumes; drop the write or wire
  a reader.
- **[coverage] The new read-side assemblers are untested (V9 gap 2, M, +2).** `fundamentals-live.ts`
  has zero tests, and neither `getIntelligenceLive`'s join/unmapped-drop/empty-degradation
  (`intelligence-live.ts:140-202`) nor `getFundamentalsLive`'s coercion/dedup is pinned - only the
  pure validators/engines are (`test_valuation_engine`, `test_hype_engine`, `test_relevance_engine`,
  `test_sentiment_engine`, `test_intelligence_schema_pin`). The empty-hype path that also proves gap 1
  is the case to add.
- **[risk, latent] Migrations are applied BY HAND via the Supabase SQL editor**
  (`nightly-maintenance.yml:23-27`), so "someone forgot" is the normal failure mode; the nightly
  `schema-drift --require-db` gate is the only thing that surfaces it. The intelligence worker's
  dependence on migration 049 (`LOOPS.md:263`) sits behind that same manual step.
- Note: this is a peripheral vertical at 90/100 projecting to 95 once the three V9 gaps close - no
  missing feature, all hardening/honesty/coverage.

## Where to find it
- **Workflows:** `.github/workflows/hourly-stock-scanner.yml`, `nightly-maintenance.yml`,
  `rba-decision-alert.yml` (plus `ci.yml`, `deploy-smoke.yml`, `sync-solo-branch.yml`).
- **Scheduler gate:** `workers/stock_scanner/scheduler_guard.py`; RBA calendar in
  `workers/stock_scanner/macro_calendar.py` (`RBA_DECISION_DATES`).
- **Scan entry:** `workers/stock_scanner/main.py`; nightly entries `outcome_job.py`, `digest_job.py`,
  `rba_decision_job.py`.
- **Horizon-2 workers:** `workers/events_worker/main.py`, `workers/fundamentals_worker/main.py`,
  `workers/intelligence_worker/main.py`, `workers/scout/main.py`.
- **Read-side (where the gaps surface):** `src/lib/intelligence-live.ts:196-197`,
  `src/lib/fundamentals-live.ts`, `src/app/intelligence/page.tsx`.
- **Tests:** `tests/test_scheduler_guard.py`, `tests/test_worker_honesty.py`, `tests/test_valuation_engine.py`,
  `tests/test_hype_engine.py`, `tests/test_intelligence_schema_pin.py`.
- **Docs:** `LOOPS.md` (loop map, horizon-2 `:257-268`), `HARNESS.md` (Layer 5 schedules `:112-120`),
  `harness-incidents.jsonl` (13 earned-gate incidents), `DATA-ECONOMICS.md` (nightly budget tripwires).

## Posture
Strong and wired - scheduling is TZ/DST-correct and defended against dropped slots, honesty gates are
real and tested; the residual is one live-label fabrication (hype meter), one dead nightly write
(`valuation_metrics`), and untested read-side assemblers.
