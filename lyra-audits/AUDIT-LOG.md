# AUDIT-LOG.md - Lyra user-readiness trend

Standing trend view over all `lyra-audits` runs: overall + per-vertical movement. Append a
column each audit; the dated reports stay the evidence. Flag which runs are comparable.

## Overall (weighted /100)

| Run | Version | SHA | Overall |
| --- | --- | --- | --- |
| 2026-07-27 | 0.82.0 | 85f779d | **82.3** |
| 2026-07-29 | 0.89.0 | f731153 | **91.7** |

_2026-07-29 is a post-remediation re-score at v0.89.0 (fresh graders, same rubric/verticals), framed
as a gap-to-95 audit. Comparable to 2026-07-27 as a trend; per-integer moves reflect a new grader
re-deriving each breakdown from current disk._

## Per-vertical (overall /100)

| # | Vertical | Wt | 2026-07-27 | 2026-07-29 | Gaps to 95 |
| --- | --- | --- | --- | --- | --- |
| 1 | Scanner & Signal Engine | core | 84 | 92 | 3 |
| 2 | Data Layer & Persistence | core | 89 | 93 | 2 |
| 3 | Command Centre & Dashboard Shell | core | 73 | 91 | 3 |
| 4 | Portfolio & Watchlist Overlays | core | 71 | 90 | 5 |
| 5 | AI Copilot, Entitlement & Grounding | core | 85 | 93 | 4 |
| 6 | Notifications & Multi-Channel Delivery | core | 83 | 91 | 4 |
| 7 | Onboarding & Demo->Account Journey | core | 83 | 90 | 3 |
| 8 | Auth, Accounts & Middleware | core | 90 | 94 | 3 |
| 9 | Worker Fleet & Scheduler | peri | 77 | 90 | 3 |
| 10 | Scout, Findings & Intelligence Feed | peri | 72 | 92 | 4 |
| 11 | Knowledge Layer & GenUI | peri | 86 | 93 | 3 |
| 12 | Solo & Community Surface | peri | 87 | 90 | 5 |
| 13 | Paper Trading & Track Record | peri | 83 | 92 | 2 |
| 14 | iOS Native Shell | peri | 87 | 93 | 2 |
| 15 | Release Engineering & Quality Gates | peri | 83 | 91 | 4 |
| 16 | Landing & Acquisition Surfaces | peri | 85 | 92 | 2 |

```
2026-07-27 baseline (v0.82.0)   weighted 82.3/100  [minor polish owed]

 1 Scanner & Signal Engine         84 #################
 2 Data Layer & Persistence        89 ##################
 3 Command Centre & Dashboard She  73 ###############
 4 Portfolio & Watchlist Overlays  71 ##############
 5 AI Copilot, Entitlement & Grou  85 #################
 6 Notifications & Multi-Channel   83 #################
 7 Onboarding & Demo->Account Jou  83 #################
 8 Auth, Accounts & Middleware     90 ##################
 9 Worker Fleet & Scheduler        77 ###############
10 Scout, Findings & Intelligence  72 ##############
11 Knowledge Layer & GenUI         86 #################
12 Solo & Community Surface        87 #################
13 Paper Trading & Track Record    83 #################
14 iOS Native Shell                87 #################
15 Release Engineering & Quality   83 #################
16 Landing & Acquisition Surfaces  85 #################
```

## Why (2026-07-27 - first run, baseline)

- Strongest: **Auth/Middleware (90)**, **Data Layer (89)**, **Solo/Community (87)**, **iOS Shell (87)**, **Knowledge/GenUI (86)** - the plumbing and the security fence are genuinely solid.
- Weakest: **Portfolio/Watchlist (71)** and **Command Centre (73)** - both dragged by real user-facing defects (degenerate watch-rule default-fire; dead `Search: NVDA` box + autocomplete tickers 404ing).
- Biggest single risk is **Scout/Intelligence (72)**: `/intelligence` and `/wire` present PRNG/hardcoded market news as real, 'Live', attributed to named firms - a trust breach on a research-first tool. This is the #1 app-wide P1.
- Coverage is the lowest sub-score almost everywhere: safety-critical logic (RLS fence, the TS display module, onboarding nav, quality-gate self-tests) is under-pinned by behavioural tests.

## Why (2026-07-29 - gap-to-95 re-score, post-remediation v0.89.0)

Full report: `2026-07-29-gap-to-95-audit.md`. The v0.83.0-v0.89.0 remediation wave lifted the weighted
overall **82.3 -> 91.7** and every vertical to 90-94; the 07-27 P1s (degenerate watch-rule, dead search
box, fabricated market news, unexecutable RLS fence) are all verified CLOSED on disk. **0/16 at 95**;
52 concrete gaps remain, all hardening/test-pinning/honesty/polish - no vertical needs a new feature.

- **Coverage is still the dominant lever (~26 of 52 gaps):** the wave pinned the pure decision helpers
  but left the account-backed/server-side/assembler code untested - `mapPortfolio` (V2), PUT rollback +
  DELETE (V4), inbound-webhook parsers (V6), `handleFinish` orchestration (V7/V8), live assemblers (V9),
  `buildLiveWire` (V10), the GenUI route ladder (V11), 5 of 8 quality gates (V15), Solo/Community landing
  copy (V16). All closable by the house pure-extraction pattern.
- **Two real correctness defects to fix first:** (1) the onboarding gate writes `onboarded=true` before
  saves confirm, so a 401-then-abandon releases the mandatory gate with an empty book (V7/V8, S, +3);
  (2) the remediation itself re-introduced fabrication-as-live - the hype meter renders hardcoded demo
  scores under a 'live' label when `hype_scores` is empty (V9, S, +2).
- **Lower-weight residue:** built-but-unwired secondary surfaces (V5 research_analyst + AI Ops store, V9
  valuation_metrics, V12 provenance column, V14 push plugin); serverless in-memory state that never got
  the Redis treatment (V5/V6/V12); and AA-contrast/44px/label polish nits (V3/V4/V13/V16).