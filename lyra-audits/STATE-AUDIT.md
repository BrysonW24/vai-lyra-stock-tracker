# lyra-audits - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
The recurring user-readiness audit system: dated whole-app reports, the movement log, and (as of this
run) the per-domain state audits. The most mature operating domain in the estate.

## Lyra as it is today
This folder holds a real, trend-tracked audit practice, not a stub:
- `README.md` - the methodology (the fixed five-dimension rubric).
- `AUDIT-LOG.md` - the trend: weighted **82.3 (2026-07-27) -> 91.7 (2026-07-29)**, per-vertical columns.
- `2026-07-27-user-readiness-audit.md` - the baseline: 16 verticals, ~534 lines, file:line evidence.
- `2026-07-29-gap-to-95-audit.md` - the follow-up: all 16 verticals 90-94, **52 gaps to 95** enumerated.

Two older audits predate the folder convention and still live in `docs/audits/2026-07-16-full-app-audit.md`
and `docs/readme-improvement-audit-2026-07-16.md` - candidates to index or migrate here.

## How it works
Rubric = functionality/25 + correctness/25 + resilience/20 + coverage/15 + polish/15. Each run is
read-only, cites file:line, and (this session) is workflow-parallelised (one auditor per vertical/domain).
Output: a dated report + an `AUDIT-LOG.md` column. Per-domain `STATE-AUDIT.md` files now live in every
`lyra-*` folder, anchored to `status/lyra-today-snapshot.md`.

## Strengths (verified)
- Evidence-cited and trend-tracked - the 82.3 -> 91.7 movement is documented per vertical.
- Remediation-proven: the 2026-07-27 P1s were all closed and re-verified on disk.
- Honest re-scoring: the 2026-07-29 pass caught a defect the remediation itself re-introduced (V9 hype meter).

## Gaps, risks, what is missing
- Older `docs/audits/*` not yet migrated into this home.
- No automated cadence trigger - audits run when a human/agent starts one.
- The per-domain state audits (this folder set) are new as of 2026-07-29; no second data point yet.

## Where to find it
`lyra-audits/*`, `docs/audits/2026-07-16-full-app-audit.md`, `status/lyra-today-snapshot.md`,
`lyra-folder-convention.md`.

## Posture
Established and trend-tracked - the reference home other domains should grow toward.
