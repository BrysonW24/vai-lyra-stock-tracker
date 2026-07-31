# Lyra Emerging Winner Engine - training pipeline + model runbook

> Status: **Phase 0 built + shadow-live** (2026-07-31). Training proper (Phase 2) is gated by the
> point-in-time dataset (Phase 1), which is not built yet. This doc is the TRAINING view: what model we
> train with, and how we begin to train it. It ties the vision + the decks + the built code together.
>
> Companion docs (read for depth, do not duplicate):
> - `research/2026-07-29-emerging-winner-engine.md` - the planning spec (locked decisions, 10 domains, phases).
> - `emerging-winner-engine.md` - the no-ceiling model universe (82 families) + the 9-gate architecture + v1/v2/v3.
> - `README.md` - the two-model framing (A event / B archetype).
> - The 7 deck PNGs (`deck-1of7 ... 7of7`) + 5 family PNGs (`families-1of5 ... 5of5`) - the visual source.
> - Code: `workers/emerging_winner/` (built), `workers/stock_scanner/ml/recovery_model.py` (the reuse pattern).

## 0. Where we are today (honest)

Phase 0 ships the whole pipeline end to end, **shadow-live in production**, with an honest stand-in where
the trained model will sit:

- `workers/emerging_winner/` runs `domains -> scorecard -> classifier -> analogue -> ranker -> risk_gates
  -> distribution -> engine` and writes to the immutable ledger (`supabase/migrations/056_emerging_winner.sql`:
  `emerging_winner_runs` + predictions, service-role-write / anon-read, no `user_id`).
- The classifier is `emerging-winner-classifier-reference-v1`: a transparent **calibrated logistic over the
  10 domain scores**, emitting the EXACT output contract the trained model will (winner-similarity 0-100,
  ordinal stage 0-4, class probabilities, SHAP-like per-domain contributions, coverage-aware confidence),
  stamped `reference-v1 (shadow-live), not trained on real winners`.
- `classifier.py::train_classifier` (line ~175) is a deliberate **Phase 1 seam** - `pragma: no cover`,
  intentionally not implemented, waiting for the labelled dataset. When it lands it refits and re-exports;
  nothing downstream changes.
- `reference_data.py` analogue profiles are ILLUSTRATIVE, and `main.py` scores an ILLUSTRATIVE universe -
  clearly labelled, so the score -> persist -> read-back loop is provably live without pretending the data
  is real.

So: the **product shell + the loop are live**; the **real dataset + the trained models are the work ahead.**

## 1. The model stack (what runs, what is trained)

```
        LYRA EMERGING WINNER ENGINE - Production v1 stack        legend: [DET]=deterministic (no train)
        (decks 1-7 · engine.py orchestrates · 9-gate hierarchy)          [TRAIN]=trained model (Phase 2)
                                                                         [REF]=reference stand-in now
 raw features (10 domains)
        │
        ▼
  ┌────────────────────────────────────────────────────────┐
  │ Model 1 · Domain Signal Engine     domains.py/scorecard │ [DET]   built · engine-owned numbers
  │ 10 domains → 0-100 each · coverage-honest               │
  └───────────────┬────────────────────────────────────────┘
                  │ domain scores + sub-signals + theme + regime
   ┌──────────────┼───────────────────────────────┬──────────────────────────┐
   ▼              ▼                                ▼                          ▼
 ┌──────────┐  ┌────────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
 │ Model 5  │  │ Model 2 · Winner       │  │ Model 3 · Analogue │  │ Model 4 · Archetype│
 │ Risk Gate│  │ Classifier classifier  │  │ analogue.py        │  │ + Ranker ranker.py │
 │ Stack    │  │ ordinal 4-class +      │  │ "most like these 5 │  │ archetype (×8) +   │
 │ risk_gates│ │ winner-similarity+SHAP │  │ past winners/fails" │  │ learning-to-rank   │
 │ [DET→TRAIN]│ │ now:[REF] logistic     │  │ [DET→TRAIN metric- │  │ [DET→TRAIN         │
 │ Gate 1   │  │ champ:[TRAIN] GBDT      │  │ learning] Gate 2   │  │ LambdaMART] G3+G8  │
 │ survive  │  │ Gate 2                  │  │                    │  │                    │
 └────┬─────┘  └───────────┬────────────┘  └─────────┬──────────┘  └─────────┬──────────┘
      │                    ▼                          │                       │
      │        ┌────────────────────────┐            │                       │
      │        │ Model (Gate 7) ·        │            │                       │
      │        │ Outcome distribution    │            │                       │
      │        │ distribution.py         │            │                       │
      │        │ P(2x/5x/10x/-80%)+quant │            │                       │
      │        │ [DET→TRAIN quantile]    │            │                       │
      │        └───────────┬────────────┘            │                       │
      └────────────────────┴──────────────┬──────────┴───────────────────────┘
                                           ▼
                          engine.py → one finding → repo.py → ledger (056, shadow-live)
              winner-similarity · archetype · completeness · outcome dist · risks (mandatory) · confidence
                 engine owns EVERY number · never "buy" · never a price target · research only
```

## 2. What model have we got to train with

**Champion (Production v1, the model we actually train):** a **gradient-boosted decision tree** -
**CatBoost / LightGBM**, an **ordinal 4-class** winner-stage classifier (0 weak -> 4 breakout-archetype)
over the 10 domain scores + sub-signals + theme labels + regime, plus a **LambdaMART** learning-to-rank
model for the research queue. Chosen because Lyra's inputs are mixed, sparse, partially-missing tabular
data and we need to know *which domains drove the call* - SHAP attributions ("theme +18, contract +12,
technical +10, capital -9, sponsorship -7") are exactly the "why it resembles past winners" panel.

| Slot | Model we train (v1) | Family | Why | Status |
|------|--------------------|--------|-----|--------|
| Winner classifier (Model 2 / Gate 2) | **CatBoost/LightGBM ordinal** | GBDT | mixed tabular, missing-tolerant, SHAP-explainable | `[REF]` logistic now; `train_classifier` seam stubbed |
| Research-queue ranker (Model 4 / Gate 8) | **LambdaMART** | learning-to-rank | product problem is "which 5 to research first", not classify | deterministic rank now |
| Historical analogue (Model 3 / Gate 2) | **metric-learning / kNN** | prototype/embedding | "most similar to these 5 past winners" - user-facing explanation | illustrative reference profiles now |
| Risk gate stack (Model 5 / Gate 1) | survival + dilution + **manipulation** classifiers | hazard / boosted-failure | first gate: can shareholders survive to capture upside | rule-based now |
| Outcome distribution (Gate 7) | **NGBoost / quantile / competing-risk** | distributional / survival | skewed small-cap payoffs need P(2x/5x/10x/-80%), not a mean | deterministic estimate now |

**Right now** every trained slot runs an honest deterministic / `reference-v1` stand-in with the identical
output contract, so the product is live and truthful before the models exist.

**The challenger menu** is the 82-family "no-ceiling universe" in `emerging-winner-engine.md` (temporal:
TFT / TCN-GRU-LSTM; graph: dynamic heterogeneous GNN / hypergraph for second-order winners; PU-learning
for imperfect labels; conformal + deep ensembles for uncertainty; stacked super-learner as the final
layer). These are v2/v3 challengers under strict walk-forward control - never the first model.

**Build order (from the spec):** v1 = GBDT classifier + LambdaMART ranker + risk gates + analogue +
calibration/SHAP + shadow-live ledger. v2 = temporal challenger + NLP evidence extraction + causal
contract model + PU-learning + full return distribution. v3 = dynamic heterogeneous GNN + archetype
mixture-of-experts + multimodal alt-data + stacked uncertainty ensemble + Paper-Bot allocation.

## 3. How we begin to train

Dataset first, model second - because survivorship bias would silently fake the whole thing. Training
reuses the proven `recovery_model.py` pattern (`walk_forward_backtest(folds=5)` -> `train_and_export()`
-> frozen JSON -> drift-guarded TS inference).

```
HOW WE BEGIN TO TRAIN  —  the CatBoost/LightGBM winner classifier (Model 2)

 PHASE 1 · build the honest dataset      (the hard gate — NOT built yet)
 ──────────────────────────────────────────────────────────────────────────
  FREE / OFFICIAL POINT-IN-TIME SOURCES                 reconstruct the past as it WAS
  ┌──────────────────────────────────┐
  │ SEC EDGAR fundamentals   (dom 5,6)│──┐
  │ EDGAR Form 4 / 13F       (dom 9)  │  │   ┌──────────────────────────────┐
  │ USAspending / SAM.gov    (dom 7)  │──┼──▶│ POINT-IN-TIME FEATURE STORE   │  as-of T,
  │ theme graph + mention    (dom 4)  │  │   │ DELISTED / dead names INCLUDED│  zero look-ahead
  │ market regime (dom 10, REAL now) │──┘   └───────────────┬──────────────┘
  │ technical + volume (1,2 REAL now)│                      │ snapshot features known at T
  └──────────────────────────────────┘                      ▼
                                          ┌──────────────────────────────┐
                                          │ FIRST-TOUCH BARRIER LABELER   │ winner = ≥ +100%
                                          │ (extend outcome_engine.py)    │ within 12mo · base ~2-4%
                                          │ triple-barrier / competing evt│ (or migrate to composite
                                          └───────────────┬──────────────┘  quality-winner label)
                                                          ▼  rows = (features@T , ordinal label)
 PHASE 2 · train  (classifier.py::train_classifier, mirrors recovery_model.py)
                                          ┌──────────────────────────────┐
   CatBoost/LightGBM ordinal 4-class ◀────│ WALK-FORWARD BY YEAR          │ train ≤2022→test 23
   + LambdaMART ranker · SHAP             │ train ≤2023→test 24 …         │ weight recent regimes
                                          └───────────────┬──────────────┘
                                                          ▼
                                          ┌──────────────────────────────┐
                                          │ VALIDATE for a RARE positive  │ precision@k · lift ·
                                          │ (NOT a single headline AUC)   │ calibration · top-k survival
                                          └───────────────┬──────────────┘
                                                          ▼  passes + calibrated ?
                                          ┌──────────────────────────────┐
                                          │ FREEZE → JSON + drift fixtures │ (recovery_model.py contract;
                                          │ TS inference loads same coeffs │  Python↔TS drift-guarded)
                                          └───────────────┬──────────────┘
                                                          ▼
                                          ┌──────────────────────────────┐
                                          │ SHADOW-LIVE ledger (mig 056)  │ log, do NOT surface, until
                                          │ immutable · ALREADY live now  │ calibration holds ~12mo
                                          └───────────────┬──────────────┘
                                                          ▼  12mo outcomes mature
                                            feedback → refit → challenger promotion (champion/challenger)
```

## 4. The three hard truths (why this is the highest-difficulty tier)

1. **Survivorship bias will silently fake it.** Training on "the small caps that did well" only teaches
   that winners look like winners. The only honest way is **point-in-time with the dead included**:
   reconstruct the universe as it existed at T (incl. names that later delisted / diluted to zero / were
   taken under), snapshot features known at T, label by forward outcome. The repo has no point-in-time
   feature store today - this is the single hardest problem.
2. **Half the special features do not exist / cannot be honestly sourced.** SEC fundamentals / Form 4 /
   13F / USAspending are free, official, point-in-time -> real BUILD pipelines. Private VC rounds, hiring
   velocity, "founder vision" are paywalled / ToS-fraught / not reconstructable point-in-time -> DEFER
   and flag, never fake. Realism is bounded by how much of the BUILD half we build well.
3. **Tiny base rate + non-stationarity.** True multi-baggers are ~2-4%/yr -> wild class imbalance; and a
   2021 winner (zero rates) is not a 2025 winner (AI capex). With few years of history we do NOT trust
   AUC - we validate walk-forward by year with precision@k, lift, calibration, and top-k survival.

## 5. Validation methodology (non-negotiable)

- **Point-in-time snapshots, delisted included.** Only features with an honest as-of timestamp enter a row.
- **Walk-forward by year.** train ≤2022 -> test 2023; train ≤2023 -> test 2024; weight recent regimes,
  keep 3-5yr minimum history.
- **Rare-positive metrics:** precision@k ("of my top 20 that quarter, how many ran"), lift over base rate,
  calibration (reliability curve), survival of the top-k over time - never a single headline AUC.
- **Backtest-first, then shadow-live.** The real horizon is 12 months; validate via historical
  walk-forward, THEN log live predictions to the immutable ledger and let the track record build slowly.

## 6. Doctrine + safety (research, not advice - dialled to maximum)

- **Engine owns every number.** Winner-similarity / probability / percentile / the outcome distribution
  are deterministic engine outputs, rendered as metric-grid keys, never AI prose (`guardProse` rejects any
  figure not in the engine facts).
- **Never "buy", never a price target.** Vocabulary stays research / watch / monitor / compare / paper_bot
  / review_risk. Framed as "calibrated winner-similarity - model estimate", never "will" / "certain".
- **Risks / what's-missing mandatory and never empty.** Every card carries dilution, going-concern, fraud,
  illiquidity, pump-and-dump by default.
- **Shadow-live first.** Compute + log; surface to users only after walk-forward passes and calibration
  holds. The deterministic scanner stays the safety backbone.

## 7. Harness compliance (what shipping training must touch)

1. **Version bump** on any `src|supabase|workers|public|content|sql|contracts` change (prepend `RELEASES`,
   `npm run release`) - the pre-push hook blocks otherwise.
2. **Skill chain:** `/emerging-winner` (`.claude/commands/emerging-winner.md`) owns `workers/emerging_winner/`
   + `src/lib/emerging-winner/` + `src/app/emerging-winners/`; run it before promoting anything from shadow-live.
3. **Migrations:** `056_emerging_winner.sql` is live (runs + predictions ledger). New tables -> next free
   prefix, RLS service-role-write / anon-read, must pass migrations-from-zero + schema-drift.
4. **LOOPS.md** motion entry + **DATA-ECONOMICS** budget for every new table / scheduled worker.
5. **"Green must go red":** a training/scoring worker that stores nothing fails loudly; TZ-safe tests;
   no silent caps; drift-guarded Python↔TS parity for any TS mirror (the `recovery_model.py` contract).

## 8. Code map (module → model → gate → training status)

| Module (`workers/emerging_winner/`) | Model | Gate | Trains in | Now |
|---|---|---|---|---|
| `domains.py` + `scorecard.py` | 1 Domain Signal Engine | inputs | never (deterministic) | live |
| `risk_gates.py` | 5 Risk Gate Stack | Gate 1 | v1 (survival/dilution/manip) | rule-based |
| `classifier.py` | 2 Winner Classifier | Gate 2 | v1 (CatBoost/LightGBM ordinal) | `reference-v1` logistic; `train_classifier` stubbed |
| `analogue.py` + `reference_data.py` | 3 Historical Analogue | Gate 2 | v1 (metric-learning/kNN) | illustrative profiles |
| `ranker.py` | 4 Archetype + Ranker | Gate 3 + 8 | v1 (LambdaMART) | deterministic |
| `distribution.py` | Outcome distribution | Gate 7 | v1-v2 (NGBoost/quantile) | deterministic estimate |
| `engine.py` + `repo.py` + `main.py` | orchestrator + ledger | Gate 8 | never | live (shadow-live, mig 056) |

## 9. Immediate next step (Phase 1, the gate for all training)

Build the **point-in-time small-cap dataset**: (1) pick a delisted-inclusive universe source (Open Question
1 in the spec), (2) stand up the first BUILD pipeline (SEC EDGAR or USAspending) as its own worker +
migration + LOOPS entry + data-economics budget, (3) extend `outcome_engine.py` with the first-touch
+100%/12mo barrier labeler. Only then does `train_classifier` become real and Phase 2 begins. Until then,
the `reference-v1` engine keeps the product honest and shadow-live.
