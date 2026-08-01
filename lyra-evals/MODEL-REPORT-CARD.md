# Model Report Card

> **North star + version timeline:** [`MODEL-REGISTRY.md`](MODEL-REGISTRY.md). This card grades the
> *current* models; the registry tracks *every version* against the one metric that defines "better"
> (out-of-sample holdout lift@k, currently 1.72x, target ≥2.0x with worst-cohort lift ≥1.0).

_Living document. Regraded after every backtest cycle; history in `model-metrics-history.jsonl`.
Last graded: 2026-08-01 (corpus `ef1b5c52...`, evidence:
[`2026-08-01-real-history-backtest-and-real-v1-champion.md`](../lyra-modelling/research/2026-08-01-real-history-backtest-and-real-v1-champion.md))._

Grades are letter grades against the job each layer claims to do, not against perfection. A grade
only moves on evidence.

## The models, graded

### Emerging Winner Classifier - `emerging-winner-classifier-real-v1` (deployed champion, shadow-live)

| Dimension | Grade | Why |
|---|---|---|
| **Accuracy (real, out-of-time)** | **C+** | Genuine but modest skill: holdout lift 1.72x CI90[1.38, 2.05] at top-5%, ROC-AUC 0.585, on a survivor-biased corpus (optimistic bound). At a realistic 3% deployment base that restates to ~5.6% top-k precision - a real research-queue edge, nowhere near a tradeable signal. Worst quarterly cohort is thin (0.11): entire regimes produce almost nothing. |
| **Calibration** | **B+** | ECE 0.042 on untouched holdout; probabilities mean what they say at corpus prevalence. Will need recalibration at deployment prevalence. |
| **Sophistication - process** | **A-** | Purged walk-forward (calendar-unit spans), embargo, one-shot holdout discipline, symbol-clustered bootstrap CIs, floor gates, drift fixtures, immutable point-in-time ledger design, corpus hash + load-time integrity checks, forced-promotion audit trail. This process layer is genuinely rigorous. |
| **Sophistication - estimator** | **D+** | Deliberately basic: an 11-feature stdlib logistic over aggregated 0-100 domain scores. No interactions, no nonlinearity, no sequence information, ~5 features effectively alive. The deck's CatBoost/LightGBM ordinal upgrade remains unbuilt. Basic is the honest choice at this data size, but it is basic. |
| **Sophistication - data** | **D** | The binding constraint. Survivor-biased free-data corpus; 5 of 10 domains constant-absent (government, sponsorship, adoption, narrative, theme); fundamentals are annual-only; no delisted names; no dated theme source. The model can only be as good as this layer. |
| **Honesty of presentation** | **A** | Every caveat travels with every number: provenance in the artifact, survivorship + curation caveats in corpus meta and reports, shadow-live gating intact, surfacing not earned and said so. |

**Overall: C+ predictive power on an A- process, capped by D data.** The 2026-08-01 cycle proved the
machinery can learn real signal and refute its own hypotheses; the next grade move must come from
data, not tuning.

### Deterministic reference scorecard (M1 composite / fallback classifier)

| Dimension | Grade | Why |
|---|---|---|
| Accuracy (real) | **F as a ranker** | Holdout lift 0.68x CI[0.49, 0.89] - its top picks contain FEWER winners than random. The hand-designed weights bet on `technical` and comfortable `liquidity`, both of which anti-predict real 12-month doublers. |
| Role honesty | **B** | It was always labelled a hypothesis, and its legibility (10 named domains, transparent subsignals) is exactly what let the backtest refute it cleanly. Keep it as the interpretable feature layer and coverage report; never as the ranking authority. |

### Bootstrap-synthetic champion (retired 2026-08-01)

Refuted: dev 0.78x CI[0.62, 0.97], holdout 0.70x CI[0.47, 0.92]. It learned the hand-designed
hypothesis faithfully - the hypothesis was wrong. Retained in git history; its honest role was proving
the training lifecycle end to end, which it did.

### Oversold-Recovery model (scanner family) - not regraded this cycle

Still synthetic-trained (`recovery-model.json`, OOS AUC 0.802 on its own synthetic generator - says
nothing about markets). Its inference path has no production call site yet. **Next in line for
exactly this backtest treatment**; until then its registry entry keeps the synthetic provenance label.

### M3 analogues / M4 ranker / M5 risk gates / M6 timing

Not probability models: M3 remains illustrative (unchanged), M5 gates are deterministic capital
protections (their value is blocking, not ranking - the pump-block invariant is pinned by tests),
M6 stays shadow-only (its macd scale bug was fixed this cycle before it could ever graduate).

## Sophistication ladder (where this sits, honestly)

```
Level 0  screens / hand-picked lists            <- where most retail tools live
Level 1  hand-weighted composite scores         <- reference scorecard (REFUTED as a ranker)
Level 2  linear model, real labels, honest CV   <- real-v1 champion is HERE (with L4-grade eval discipline)
Level 3  nonlinear tabular (GBDT), interactions, per-regime validation
Level 4  point-in-time multi-source features (filings, insider, contracts), delisted-inclusive corpus
Level 5  sequence/graph models, regime conditioning, ensembles with uncertainty
```

The eval discipline (purge, holdout, clustered CIs, integrity hashes) is already Level-4 grade; the
estimator is Level 2 and the data is Level 1.5. That gap IS the roadmap.

## How it improves over time (staged, evidence-gated)

_The full target-state architecture - the most sophisticated stack this app can honestly carry,
with earn-gates and the "arrived" definition - is [`lyra-modelling/NORTH-STAR.md`](../lyra-modelling/NORTH-STAR.md).
The stages below are its near-term slice._

**Stage 1 - more of the same data (cheap, weeks).** Widen the corpus sample toward the full ~10k
listing; add ASX via the same pipeline once a point-in-time fundamentals source exists for it;
re-run the standing loop. Expected effect: tighter CIs, not higher lift.

**Stage 2 - deep-domain features (the real unlock, build-per-domain).** Form 4 insider flow (CIK-safe,
same EDGAR discipline - next clean build), 13F ownership deltas, USAspending awards, a DATED theme
source (so theme stops being a leak risk and becomes a feature). Each domain lights up an honest 0.00
weight. Gate: a domain ships only with its own as-of discipline tests.

**Stage 3 - kill survivorship (the multi-week data project).** Delisted-inclusive point-in-time
universe (EDGAR historical filers x delisted price history). This is what makes precision numbers
real rather than optimistic bounds, and unlocks the -80% ruin class for the risk gates.

**Stage 4 - estimator upgrade (only after Stage 2).** GBDT ordinal (the deck's design) behind the same
artifact contract; interactions between fundamentals and liquidity are where a tree model should
find nonlinear structure a logistic cannot. Gate: must beat real-v1 on the standing loop's dev
walk-forward AND a fresh one-shot holdout, same floors, same CIs.

**Stage 5 - the live loop closes.** Ship the outcome-maturation job (pattern:
`workers/stock_scanner/outcome_job.py`); nightly real scans accumulate ledger predictions; after 12
months `load_training_dataset` auto-upgrades to genuine live point-in-time rows and
`monitor.model_health` starts scoring live calibration - the surfacing gate finally has real teeth.

## The standing testing + improvement suite

**Regression layer (every CI run):** 509 Python tests including 40+ pins added this cycle (purge
units, EDGAR as-of + concept discipline, label honesty, corpus integrity, forced-promotion audit,
feed-semantics fixes) + 1,174 vitest tests + the drift guard (frozen artifact == served inference,
<1e-6).

**Eval loop (repeatable, on demand or after any model/data change):**

```bash
npm run worker:emerging-winner-backtest -- build      # refresh corpus (disk-cached, incremental)
npm run worker:emerging-winner-backtest -- retrain    # challenger on dev, curated-excluded, purged WF
npm run worker:emerging-winner-backtest -- compare    # fair fight vs deployed champion, clustered CIs
npm run worker:emerging-winner-backtest -- eval       # all models x all slices (random headline)
npm run worker:emerging-winner-backtest -- holdout    # ONE-SHOT confirmation - never iterate on it
npm run worker:emerging-winner-backtest -- promote    # floor-gated; forced only with a recorded reason
npm run worker:emerging-winner-backtest -- record     # append grades to model-metrics-history.jsonl
```

**Improvement rules (standing):**
1. The random-sample slice is always the headline; curated and pooled numbers are disclosures.
2. Any lift > ~2x from this feature set triggers a mandatory leakage decomposition before it is
   reported anywhere.
3. The holdout is scored once per corpus generation. Iterating against it converts it to a second
   dev set; when that happens, cut a NEW later holdout.
4. A challenger is promoted only over a beaten champion (CI separation), through the floor gate or
   with a recorded force-reason; surfacing promotion is a separate, founder-gated decision fed by
   `monitor.model_health` live calibration - never by backtest numbers alone.
5. Every cycle appends to `model-metrics-history.jsonl` with the corpus hash, so the grade trajectory
   is auditable and a regression is visible the cycle it happens.
