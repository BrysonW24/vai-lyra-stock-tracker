# BUGS-LEDGER - Lyra

Reproducible defects with evidence. One row per issue; link the image + the fix commit. Fixed bugs keep
their row (with the fix SHA) for history. Source of the initial two: the 2026-07-29 gap-to-95 audit -
these are the only two genuine user-facing correctness defects in that pass (the other 50 items are
coverage/polish/hardening, tracked in the audit, not here).

| # | Date | Surface | Symptom | Evidence | Status | Fixed in |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-07-29 | Onboarding (V7/V8) | `onboarded=true` written before the watchlist/portfolio saves confirm; a 401-then-abandon releases the mandatory-onboarding gate with an empty book | `src/app/onboarding/page.tsx:270-286` + `middleware.ts:134-137`; audit V7/V8 | OPEN | - |
| 2 | 2026-07-29 | Intelligence feed (V9) | Hype meter renders hardcoded demo scores (NVDA 92 / CRWD 88...) under a `source:'live'` label when `hype_scores` is empty/errored - fabrication-as-live | `src/lib/intelligence-live.ts:196`; `src/components/intelligence/IntelligenceFeed.tsx:102`; audit V9 | OPEN | - |
