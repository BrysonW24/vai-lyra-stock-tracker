# lyra-reporting - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
Source authority, privacy-safe aggregation, founder reports, and decision receipts. Today this splits
cleanly: the **user-facing reporting loop is wired and tested**; **owner/business reporting is greenfield**.

## Lyra as it is today
The outbound reporting machinery exists and runs on a cron:
- `workers/stock_scanner/digest_job.py` - the daily digest, and the Friday weekly report.
- `workers/stock_scanner/review_job.py` + `outcome_job.py` - periodic reviews + outcome-labelled coaching follow-ups.
- `.github/workflows/nightly-maintenance.yml` drives the digest compose + delivery sweep.
- `notification_deliveries` + `notification_engagements` tables record what was sent and opened; the
  engagement beacon is mounted in `app/layout.tsx`.
- `/api/health` is the machine-readable liveness + version + scan-freshness report.

There is no founder business-report surface (revenue/retention/owner analytics) - that is greenfield.

## How it works
Nightly job composes the digest -> `dispatchNotificationEvent` -> multi-channel send -> deliveries
logged; opens logged via the beacon. The report content is deterministic; AI never writes a number into it.

## Strengths (verified)
- The outbound reporting loop is genuinely wired end to end and tested (gap-to-95 V6/V9, 91-92/100).
- Privacy-safe by construction: Langfuse is metadata-only, content gated (estate posture); reports aggregate.

## Gaps, risks, what is missing
- No owner/business reporting surface (KPI/revenue/retention) - see also `lyra-metrics`.
- Decision receipts are implicit (git history + `CHANGELOG.md`), not formalised here.
- Reporting is user-facing digests; there is no founder "state of the app" scheduled report yet.

## Where to find it
`workers/stock_scanner/{digest_job,review_job,outcome_job}.py`, `.github/workflows/nightly-maintenance.yml`,
`src/lib/notifications/`, tables `notification_deliveries` / `notification_engagements`, `src/app/api/health`.

## Posture
User-facing reporting wired and tested; owner/business reporting greenfield.
