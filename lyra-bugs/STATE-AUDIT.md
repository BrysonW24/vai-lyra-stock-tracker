# lyra-bugs - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
Reproducible defect evidence (screenshots + repro notes) and the bug ledger.

## Lyra as it is today
The home is established and the ledger (`BUGS-LEDGER.md`) is seeded with the two real correctness defects
the 2026-07-29 gap-to-95 audit surfaced (see below). No screenshot evidence has been captured yet - Lyra's
defect inventory currently lives as prose in the audit, not as image+repro rows like Podium's `podium-bugs`.

The authoritative current defect inventory is `lyra-audits/2026-07-29-gap-to-95-audit.md`: 52 gaps, of
which two are genuine user-facing correctness defects (the rest are coverage/polish/hardening):
1. **Onboarding gate releases before saves confirm (V7/V8).** `onboarded=true` is written before the
   watchlist/portfolio saves; a 401-then-abandon leaves a user past the mandatory gate with an empty book.
2. **Hype-meter fabrication-as-live (V9).** `intelligence-live.ts:196` falls back to hardcoded demo hype
   scores under a `source:'live'` label when `hype_scores` is empty - a one-law violation on a realistic
   partial-migration state.

## How it works
Log each reproducible defect as a `BUGS-LEDGER.md` row (surface, symptom, evidence image, status, fix
commit) with a screenshot alongside. Fixed bugs keep their row with the fix SHA for history.

## Strengths (verified)
- The ledger is seeded from a rigorous, evidence-cited audit rather than starting empty.

## Gaps, risks, what is missing
- No screenshot/repro capture flow yet.
- The 50 non-correctness gap-to-95 items are not tracked here (they live in the audit) - deliberate, to
  keep this ledger to genuine defects, not hardening tasks.

## Where to find it
`lyra-bugs/BUGS-LEDGER.md`, `lyra-audits/2026-07-29-gap-to-95-audit.md`.

## Posture
Home established, ledger seeded with the two known correctness defects; no screenshot evidence yet.
