# lyra-forecasting - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
Demand, retention, revenue, economics, capacity, reliability, and scenarios. Today: the
economics/capacity/reliability leg is real and enforced; demand/retention/revenue forecasting is greenfield.

## Lyra as it is today
- **Economics + capacity (measured, enforced):** `DATA-ECONOMICS.md` records measured usage, free-tier
  runway, DB growth, call volumes, audited retention benefit horizons, and tripwires - and it is not just
  a doc: the nightly `check:data-economics` gate (`scripts/check-data-economics.mjs`) enforces its budgets.
  `docs/live-data-24-7-conversion.md` covers the always-on conversion.
- **Reliability posture:** the scheduler is TZ/DST-correct with dropped-slot defenses; `HARNESS.md` +
  `LOOPS.md` document the failure modes and the loops that close.
- **Demand / retention / revenue:** greenfield. Lyra is pre-users on a BYOK model, so there is no demand
  curve, cohort retention, or revenue to forecast yet.

## How it works
The economics gate reads real usage numbers against declared budgets on a cron and fails loudly when a
writer would blow a free-tier ceiling. That is the one live "forecast": runway before a tier upgrade.

## Strengths (verified)
- Cost/runway forecasting is real, measured, and gate-enforced - a rare discipline this early.
- Reliability scenarios are documented and tested, not hand-waved.

## Gaps, risks, what is missing
- Greenfield: demand, retention, revenue, and business-scenario forecasting (no users/revenue yet).
- `DATA-ECONOMICS.md` is cost-runway, not a demand model - do not mistake one for the other.

## Where to find it
`DATA-ECONOMICS.md`, `scripts/check-data-economics.mjs`, `docs/live-data-24-7-conversion.md`,
`HARNESS.md`, `LOOPS.md`.

## Posture
Cost-economics + reliability grounded and enforced; demand/retention/revenue forecasting greenfield.
