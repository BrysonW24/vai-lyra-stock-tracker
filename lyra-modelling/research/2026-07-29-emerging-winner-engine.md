# Lyra Emerging Winner Engine - research + planning spec

> Status: **Research / planning** (approved direction, build started 2026-07-29)
> Owner: founder. Author of this pass: Claude (Opus 4.8).
> This is the models-space planning artifact for Lyra's flagship predictive model. It records the
> decisions that are locked, the option menus behind them (kept so choices stay revisitable), the
> full architecture, the honest data reality, and the phased build plan. It does not ship code by
> itself - the code lives under `workers/emerging_winner/` and must stay in lockstep with this doc.

## 0. The one-sentence definition

Build a 10-domain, historically trained, interpretable **classification-and-ranking** system that
learns what prior small-cap winners looked like *before* they broke out, then scores today's small
caps by archetype fit, domain completeness, and risk-adjusted opportunity.

It is **research, not advice.** It never says "buy," never prints a price target, and the deterministic
engine owns every number. See §9 (Doctrine and safety).

## 1. Two model classes - and why this one is the flagship

Lyra now has two distinct model classes on the table. They are not rivals; they share one platform.

| | **Model A - Event model** (the diagrams / "Phoebe") | **Model B - Structural archetype model** (THIS doc) |
|---|---|---|
| Question | "Will stock X hit +20% in Y days?" | "What kind of stock is this, and how close is it to the profile of past big winners?" |
| Universe | Liquid names (today: 63 NASDAQ mega-caps) | US small / micro caps (< ~$2B), point-in-time incl. delisted |
| Horizon | 21 / 63 / 126 trading days | 12 months (multi-bagger label) |
| Signal | Technical momentum / recovery | Business + narrative + market-structure + capital-flow + theme + policy + sponsorship + traction |
| Output | Probability of a near-term move | Winner-similarity + archetype + domain completeness + risks |
| Reuses | (exists in repo, mostly) | Reuses A's plumbing, aims it at a different label + universe |

**Decision: build Model B first** (see §2). Model B is the differentiated, research-native, product-
aligned model - closer to how a discretionary great investor actually thinks. Model A becomes a
fast-follow *timing* tenant on the same rails. The powerful end-state combines them:

> Archetype model says "this looks like a future winner." Event model says "timing is improving right now."

Nothing like Model B exists in Lyra today. Verified against the substrate audit (2026-07-29): everything
built is technical momentum on 63 mega-caps ([`workers/stock_scanner/universe.py`](../../workers/stock_scanner/universe.py));
the small-cap surface is curated/demo; there is no fundamental / insider / government-spend / VC /
hiring pipeline anywhere ([`gov-awards.ts`](../../src/lib/gov-awards.ts),
[`filings.ts`](../../src/lib/filings.ts), [`insider-flow.ts`](../../src/lib/insider-flow.ts) are hand-authored
"illustrative sample" literals with no worker and no table).

## 2. Locked decisions + the option menus behind them

Decisions are recorded with the full menu they were chosen from, so we can revisit without
re-deriving. Selected option marked ✅.

### Decision A - Which model first, and how they relate

1. ✅ **Emerging-winner first** - build the shared ML platform, make Model B its first tenant; momentum
   is a fast-follow on the same rails. Keeps the substrate general enough to host momentum cheaply later.
2. Both in parallel - maximal scope, slower to a first honest result, splits the hardest work (the
   point-in-time winner dataset) against the easier momentum work.
3. Momentum model first - faster win (substrate mostly exists), delays the model we actually want.
4. Emerging-winner only - leanest focus, but throws away the reuse from the momentum design.

### Decision B - The "winner" label (drives the whole dataset + data-sourcing effort)

1. ✅ **Multi-bagger, 12mo** - winner = forward return `>= +100%` within 12 months, first-touch. US
   small/micro caps < ~$2B, point-in-time incl. delisted. Base rate ~2-4%. Feel: "the next 2x-3x," absolute.
2. Top-decile, 12mo (relative) - winner = top 10% forward return vs cohort. Base rate ~10% by
   construction - much less imbalance, more stable to learn, but "relative outperformer" not "moonshot."
3. True moonshot, 24mo - winner = `>= +200-300%` within 24 months. Base rate ~0.5-1.5%. Rarest, needs
   deepest history, highest overfit risk.
4. Composite quality-winner - `>= +100%` within 12mo AND still listed AND liquidity grew. Punishes
   pump-and-dumps and dead-cat spikes. Most honest "durable winner" label, slightly more complex definition.

> Note: the label is the single most important design choice. Options 1 and 4 are close; if survivorship
> / pump-and-dump noise proves severe in the data, **migrate the locked label from 1 to 4** (add the
> survival + liquidity-growth conjuncts). The `LABEL` design in `workers/emerging_winner/` must make this
> a one-line change, not a rewrite.

### Decision C - The name

Chosen: **Lyra Emerging Winner Engine.** Alternatives considered: Winner Profile Model, Breakout
Archetype Engine, Opportunity Archetype Classifier, Pre-Winner Pattern Engine.

## 3. What the model outputs (the product, made concrete)

Per current small cap, Lyra surfaces a research card:

```
Opportunity classification   Strong candidate            (4-class: low / emerging / strong / breakout-archetype)
Archetype                    AI infrastructure 2nd-order supplier   (learned archetype, see §5)
Winner similarity            82 / 100                     (calibrated, engine-owned number)
Domain completeness          7 of 10 domains present      (present ONLY over domains we can actually assess)
Strongest domains            Theme strength · Gov/policy · Technical structure · Volume accumulation
Weakest / missing            Institutional sponsorship · Balance-sheet quality · Adoption evidence
What this means              Resembles prior high-performing small-cap infrastructure names,
                             but remains early and under-confirmed.
Risks / what's missing       (mandatory, never empty - see §9)
```

Two questions, one system:
- **Classification:** is this stock in the vicinity of becoming a major winner?
- **Ranking:** among all current small caps, which are the most promising?

## 4. The 10-domain scorecard + honest data reality

The model is not raw chaos into one black box. Every small cap is assessed on 10 domains; each domain
rolls up multiple sub-signals to a 0-100 score. The learned model then consumes the domain scores +
sub-signals + theme/category labels + regime data.

**Coverage honesty is a first-class concept.** A domain we cannot source yet is `unavailable`, which is
NOT the same as a domain assessed and found weak. Domain completeness is computed only over *available*
domains. As pipelines get built, domains flip from `unavailable` to `full` with no engine refactor.

Data-reality legend (from the 2026-07-29 substrate audit):
**REAL** = real live data in the repo now · **PARTIAL** = some sub-signals sourceable now · **BUILD** =
sourceable from free/official data but no pipeline exists yet · **DEFER** = paywalled / ToS-fraught /
not honestly reconstructable point-in-time.

| # | Domain | Key sub-signals | Data reality now | Source to build |
|---|--------|-----------------|------------------|-----------------|
| 1 | **Technical structure** | RSI recovery, MACD turn, trend strength, base formation, breakout proximity, price off lows, vol contraction, multi-timeframe | **REAL** | already computed ([`signal_engine.py`](../../workers/stock_scanner/signal_engine.py), [`indicators.py`](../../workers/stock_scanner/indicators.py), [`derived_features.py`](../../workers/stock_scanner/derived_features.py)) |
| 2 | **Volume / accumulation** | volume ratio, accumulation days, relative turnover, block activity, repeated high-vol support, rising vol on up days | **REAL** | already computed (indicator snapshot) |
| 3 | **Liquidity / tradability** | avg daily $ volume, spread quality, mcap band, float, dilution risk, vol-adjusted tradability | **PARTIAL** | $ volume from candles now; float/dilution needs fundamentals |
| 4 | **Theme strength** | exposure to AI/AGI/robotics/quantum/defence/space, macro fit, infra-bottleneck fit, supply-chain position, mention velocity, gov-demand linkage | **PARTIAL** | curated theme graph ([`themes.jsonl`](../../content/themes.jsonl), [`supply-chain-nodes.jsonl`](../../content/supply-chain-nodes.jsonl), [`value-chain.ts`](../../src/lib/value-chain.ts)); needs small-cap coverage + mention velocity |
| 5 | **Business quality** | revenue growth, gross-margin direction, operating leverage, burn quality, product credibility, customer concentration, survivability | **BUILD** | SEC EDGAR financials (free, point-in-time by filing date); repo has none |
| 6 | **Capital / survivability** | cash runway, debt, financing dependence, dilution history, shelf registrations, balance-sheet resilience | **BUILD** | SEC EDGAR (share count, cash, shelf S-1/S-3) |
| 7 | **Government / policy** | gov awards, defence contracts, procurement, policy alignment, strategic priorities, grants | **BUILD** | USAspending.gov (free), SAM.gov; map company -> awards |
| 8 | **Adoption / traction** | users, customers, bookings, partnerships, enterprise logos, procurement wins, usage growth | **DEFER** | mostly private / paywalled; partial via filings + news |
| 9 | **Sponsorship / smart money** | insider buying, institutional ownership changes, fund interest, strategic investors, capital-market validation | **BUILD** | SEC EDGAR Form 4 (insider) + 13F (institutional), free, point-in-time |
| 10 | **Narrative timing / attention** | market beginning to care (not manic), news attention, catalyst calendar, competitor read-throughs, sector rerating, macro-regime fit | **PARTIAL** | market regime REAL ([`market_context.py`](../../workers/stock_scanner/market_context.py)); news key-gated Finnhub; social attention BUILD |

**Honest verdict:** ~half the domains (1, 2, and the regime part of 10) are REAL now; three more (5, 6, 7,
9) are BUILD from free/official point-in-time sources over a multi-week ingestion effort; domain 8 is
largely DEFER. The model's realism is bounded by how much of the BUILD half we build well. This is a
data-engineering project first and an ML project second.

## 5. Winner classes + archetypes

### The 4-class ladder (better than binary yes/no)

- Class 0 - low potential / weak setup
- Class 1 - emerging: interesting but incomplete
- Class 2 - strong candidate
- Class 3 - breakout archetype / potential major winner

### Archetype classes (the genuinely differentiating layer)

Not all winners are the same kind of winner. A second model classifies *which type* of winner a name
resembles, so Lyra categorises opportunity types, not just scores them:

1. Infrastructure enabler
2. Government-backed strategic tech
3. Platform adoption breakout
4. Resource / commodity leverage winner
5. Defence / geopolitics beneficiary
6. Second-order supply-chain winner
7. Turnaround with improving structure
8. Speculative narrative with real traction

Example: "resembles the 2025-2026 'second-order AI infrastructure supplier' archetype with high
similarity, but is missing sponsorship and liquidity confirmation."

## 6. Model architecture

Four cooperating layers (matches the founder spec):

- **Layer 1 - Domain signal engine.** Deterministic. Computes the 10 domain scores + sub-signals from
  raw data. *This is the first slice (see §11).* Ships the product shell with zero ML and stays inside
  Lyra's "engine decides, AI explains" law.
- **Layer 2 - Winner classifier (Model B-core).** Predicts the 4-class label from domain scores + sub-
  signals + theme labels + regime. **Champion = gradient-boosted trees (LightGBM / CatBoost / XGBoost).**
  Chosen because the data is mixed, tabular, sparse, partially missing, nonlinear, and we need to know
  *which domains* drove the call. SHAP attributions ("theme +18, contract +12, technical +10, capital
  -9, sponsorship missing -7") are exactly the explanation Lyra should give.
- **Layer 3 - Archetype classifier (Model C).** Predicts the winner archetype (§5).
- **Layer 4 - Ranking layer (Model D).** Ranks all current candidates by winner probability x archetype
  fit x completeness x confidence, minus a risk penalty. Honors the anti-bubble tiebreak
  ([`src/lib/twin/ranking.ts`](../../src/lib/twin/ranking.ts)): never promote a lower-scored name above a
  higher one, never hide risk.

Why not a deep net first: sparse tabular data + interpretability requirement = boosted trees win. A
graph model (the diagrams' DGNN) is a later challenger for domain 4/6 once the entity graph is real.

## 7. The three hard truths (why this is the highest-difficulty tier)

A model like this is either done honestly or it is worse than useless.

1. **Survivorship bias will silently fake it.** Training on "the small caps that did well" just teaches
   the model that winners look like winners. The only honest way is **point-in-time with the dead
   included**: reconstruct the universe as it existed at time T (including names that later delisted,
   diluted to zero, or got taken under), snapshot features as known at T, label by forward outcome. Free
   data is almost all survivorship-biased, so rebuilding an honest point-in-time universe with the
   failures is the hardest single problem here. The repo has no point-in-time / feature-store concept
   today (audit-confirmed).
2. **The special features do not exist yet, and half cannot be honestly sourced.** SEC fundamentals /
   Form 4 / 13F / USAspending are free, official, point-in-time -> real pipelines (BUILD). Private VC
   funding rounds, historical hiring velocity, and "founder vision" are paywalled / ToS-fraught / not
   reconstructable point-in-time -> DEFER and flag, never fake.
3. **Tiny base rate + non-stationarity.** True multi-baggers are ~2-4% a year -> wild class imbalance,
   few positives. And a 2021 winner (zero rates) is not a 2025 winner (AI capex). With only a few years
   of history we do not trust AUC; we validate with **walk-forward by year**, **precision@k** ("of my top
   20 picks that quarter, how many ran"), **lift over base rate**, and **calibration** (see §8).

## 8. Validation methodology (non-negotiable)

- **Point-in-time snapshots, delisted names included.** No look-ahead. Only features with an honest as-of
  timestamp enter a training row.
- **Walk-forward by year.** Train <= 2022 -> test 2023; train <= 2023 -> test 2024; and so on. Weight
  recent, regime-relevant winners (AI / AGI / robotics / quantum / defence / power / space / infra /
  strategic supply chains) more, but keep enough history for robustness (3-5 years minimum).
- **Metrics that matter for a rare positive:** precision@k, lift, calibration (reliability curve), and
  survival of the top-k over time - not a single headline AUC.
- **Backtest-first, then shadow-live.** The real forward horizon is 12 months, so we cannot wait for it
  to validate. We validate via rigorous historical walk-forward, THEN log live predictions to an
  immutable ledger and let the real track record build honestly and slowly (reuses the diagrams'
  prediction-ledger discipline).

## 9. Doctrine and safety (research, not advice)

A "moonshot small-cap tip list" is the single most abused surface in finance. The honesty is dialled to
maximum, not relaxed. The doctrine reconciliation (from the guardrail audit) holds without bending:

- **Engine owns numbers.** The winner-similarity / probability / percentile are deterministic engine
  outputs, rendered as metric-grid keys, never as AI-generated prose. `guardProse`
  ([`src/lib/ai/guardrails/prose.ts`](../../src/lib/ai/guardrails/prose.ts)) rejects any figure not in the
  engine facts.
- **Never "buy," never a price target.** Action vocabulary stays research / watch / monitor / compare /
  paper_bot / review_risk ([`src/lib/findings/types.ts`](../../src/lib/findings/types.ts)). Framed as
  "calibrated winner-similarity - model estimate," never "prediction" / "will" / "certain."
- **Risks / what's-missing is mandatory and never empty.** Every card carries `whatItDoesNotProve` +
  explicit risks. For small caps: dilution, going-concern, fraud, illiquidity, pump-and-dump are called
  out by default.
- **Shadow-live first.** Compute + log predictions; surface to users only after historical walk-forward
  passes and calibration holds. Deterministic scanner remains the safety backbone.
- **Small doctrine updates** (documented, not code-bending): a dated amendment to
  [`docs/vision.md`](../../docs/vision.md) and [`docs/product/product-principles.md`](../../docs/product/product-principles.md)
  distinguishing certainty language (banned) from a calibrated probability band (permitted, engine-owned).

## 10. Reuse map + harness compliance

**Reuse (do not rebuild):**
- Model machinery: the train -> walk-forward -> frozen-JSON -> drift-guarded pattern of
  [`workers/stock_scanner/ml/recovery_model.py`](../../workers/stock_scanner/ml/recovery_model.py) (replace
  the estimator + data source, keep the export/drift contract).
- Label spine: extend [`workers/stock_scanner/outcome_engine.py`](../../workers/stock_scanner/outcome_engine.py)
  with a first-touch barrier labeler; reuse the look-ahead-safe same-candle-source labeling.
- Card + queue: the `Finding` type (`scores`, `whySurfaced`, `evidence[].whatItDoesNotProve`, `risks[]`),
  [`prime-setups.ts`](../../src/lib/prime-setups.ts), [`next-best-actions.ts`](../../src/lib/next-best-actions.ts),
  feed sections, and the GenUI render path.
- Deterministic backbone: [`score-model.ts`](../../src/lib/score-model.ts) / `signal_engine.py` stay the
  engine the model annotates, never overrides.

**Net-new:** point-in-time feature store + delisted universe, first-touch multi-horizon barrier label,
immutable prediction ledger, the 4 model layers, EDGAR / USAspending / theme-graph ingestion, the
scorecard surface.

**Harness (from the enforcement audit) - what shipping this must touch:**
1. Version bump on any `src|supabase|workers|public|content|sql|contracts` change (prepend to
   [`src/lib/version.ts`](../../src/lib/version.ts) RELEASES, `npm run release`).
2. Skill-chain coverage: a new top-level `workers/emerging_winner/` needs an owning chain row in
   [`SKILL-CHAIN.md`](../../SKILL-CHAIN.md). Recommend a new `/model-platform` (or `/emerging-winner`)
   chain since this is a vertical, not an extension of scoring.
3. Migrations: any new table -> `supabase/migrations/056_*.sql` (next free prefix; mind missing 041),
   RLS'd service-role-write / anon-read; must pass migrations-from-zero + schema-drift (hand-apply to
   prod the night it lands or the nightly reddens by design).
4. LOOPS.md motion entry + DATA-ECONOMICS budget for any new table/scheduled job.
5. "Green must go red": a scoring/training worker that stores nothing must fail loudly; TZ-safe tests;
   no silent caps; drift-guarded Python<->TS parity if a TS mirror is added.

## 11. Phased build plan

| Phase | What | Ships / proves | Effort · risk |
|-------|------|----------------|---------------|
| **0 - Domain scorecard (FIRST SLICE)** | Deterministic 10-domain engine, coverage-honest, over the features that are REAL now; unavailable domains flagged with the exact pipeline to build | The product shell + the honest domain map, testable today, zero ML | **small · low** |
| 1 - Point-in-time dataset | Reconstruct small-cap universe incl. delisted; snapshot features as-of T; first-touch +100%/12mo labels | The honest training set (the hardest piece) | large · high |
| 2 - Winner classifier | LightGBM 4-class on domains + sub-signals; walk-forward by year; SHAP | Calibrated winner-similarity, backtested | medium · med |
| 3 - Archetype classifier | Learned archetype tags (§5) | "resembles X archetype" | medium · med |
| 4 - Explainability layer | why it scored, missing domains, archetype, risks | The research card (§3) | small · low |
| 5 - Live research queue | rank current small caps; immutable shadow-live ledger | The ranked queue UX, shadow-live | medium · med |
| 6 - Feedback loop | mature outcomes over 12mo; refine domains; challenger promotion | The compounding loop | ongoing |

Data pipelines (BUILD, feed phases 1+): SEC EDGAR financials (domains 5, 6), EDGAR Form 4 / 13F (domain
9), USAspending / SAM.gov (domain 7), theme-graph small-cap expansion + mention velocity (domain 4),
news/social attention (domain 10). Each is its own worker + migration + LOOPS entry + data-economics budget.

## 12. Open questions (still to decide)

1. Small-cap universe source (which provider gives delisted/point-in-time coverage honestly, and at what
   cost). This gates Phase 1 realism.
2. Exact mcap band + liquidity floor for "investable" small caps.
3. Whether to migrate the label from Decision B option 1 to option 4 (add survival + liquidity conjuncts)
   after seeing pump-and-dump noise in the data.
4. Archetype taxonomy: fixed (the 8 in §5) vs learned/clustered from the winner set.
5. Where the surface lives (`/emerging-winners` research queue vs folding into `/small-caps`).

## 13. Relationship to the diagrams (Model A)

The 7 PNGs in this folder (`../*.PNG`) are Model A - the momentum/event engine. They are not wasted: the
hosting, champion/challenger, prediction-ledger, monitoring, and shadow-live discipline they specify is
the *platform* both models share. Model A becomes the **timing** tenant. The flagship combination:
archetype model finds the future winner; event model confirms the timing is turning now.
