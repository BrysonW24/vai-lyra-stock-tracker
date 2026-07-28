# AUDIT-LOG.md - Lyra user-readiness trend

Standing trend view over all `lyra-audits` runs: overall + per-vertical movement. Append a
column each audit; the dated reports stay the evidence. Flag which runs are comparable.

## Overall (weighted /100)

| Run | Version | SHA | Overall |
| --- | --- | --- | --- |
| 2026-07-27 | 0.82.0 | 85f779d | **82.3** |

## Per-vertical (overall /100)

| # | Vertical | Wt | 2026-07-27 |
| --- | --- | --- | --- |
| 1 | Scanner & Signal Engine | core | 84 |
| 2 | Data Layer & Persistence | core | 89 |
| 3 | Command Centre & Dashboard Shell | core | 73 |
| 4 | Portfolio & Watchlist Overlays | core | 71 |
| 5 | AI Copilot, Entitlement & Grounding | core | 85 |
| 6 | Notifications & Multi-Channel Delivery | core | 83 |
| 7 | Onboarding & Demo->Account Journey | core | 83 |
| 8 | Auth, Accounts & Middleware | core | 90 |
| 9 | Worker Fleet & Scheduler | peri | 77 |
| 10 | Scout, Findings & Intelligence Feed | peri | 72 |
| 11 | Knowledge Layer & GenUI | peri | 86 |
| 12 | Solo & Community Surface | peri | 87 |
| 13 | Paper Trading & Track Record | peri | 83 |
| 14 | iOS Native Shell | peri | 87 |
| 15 | Release Engineering & Quality Gates | peri | 83 |
| 16 | Landing & Acquisition Surfaces | peri | 85 |

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