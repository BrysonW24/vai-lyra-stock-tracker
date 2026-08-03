# Model Report Card

> **North star + version timeline:** [`MODEL-REGISTRY.md`](MODEL-REGISTRY.md). This card grades the
> *current* models; the registry tracks *every version* against the one metric that defines "better"
> (out-of-sample holdout lift@k, currently 1.72x, target ≥2.0x with worst-cohort lift ≥1.0).

_Living document. Regraded after every backtest cycle; history in `model-metrics-history.jsonl`.
Last graded: 2026-08-01 **gen-2** (corpus `a297e8ad...` - theme via SEC SIC + market regime lit;
gen-1 evidence:
[`2026-08-01-real-history-backtest-and-real-v1-champion.md`](../lyra-modelling/research/2026-08-01-real-history-backtest-and-real-v1-champion.md))._

Grades are letter grades against the job each layer claims to do, not against perfection. A grade
only moves on evidence.

## The models, graded

### Emerging Winner Classifier - `emerging-winner-classifier-real-v1` (deployed champion, shadow-live)

| Dimension | Grade | Why |
|---|---|---|
| **Accuracy (real, out-of-time)** | **C+** (was B-; regraded under the volatility null 2026-08-02) | The bar moved, not the model: a barrier label ("touches +100% in 12 months") is largely a volatility measurement, so random selection was too easy a null. A parameter-free trailing-sigma sort scores 1.41x CI90[1.09, 1.73] on the same holdout. The champion (1.94x) beats it PAIRED on identical rows: +0.48, CI90[+0.05, +0.92] - the first rigorous evidence of skill beyond jumpiness, with a thin floor. Within-tier (the honest cut): micro +0.31 and small +0.16 median edge over each tier's own jumpiness-sort, neither significant yet (underpowered at ~44-88 picks/tier); mid leans negative; large is REFUTED - the "2.84x large-tier lead" was the null in disguise (jumpiness alone scores 6.15x there and the champion significantly loses to it, CI[-5.92, -0.46]). Standing rule: no tier claim until the model beats that tier's own jumpiness-sort, paired. Still a survivor-biased optimistic bound. |
| **Calibration** | **A-** (was B+) | ECE 0.017 on the untouched gen-2 holdout; calibration-in-the-large -0.05 (level near-perfect); Spiegelhalter p 0.37; the 3%-base restatement transfers under a 50-draw prevalence-shift stress test (median ECE 0.006, zero rejections). Measured gap to A: recalibration slope 0.755 CI90[0.57, 0.98] - the spread is mildly overconfident, invisible to ECE. Path: artifact-carried slope correction (seam shipped, inert, load-validated, monotone) earning its way through the gen-3 loop, plus live-ledger validation. |
| **Sophistication - process** | **A** (was A-) | Everything from gen-1 (purged walk-forward, one-shot holdout per corpus generation, symbol-clustered CIs, floor gates, drift fixtures, integrity hashes, audited promotion) PLUS the two pieces that closed the loop: the nightly outcome-maturation job (migration 057; live ledger rows now mature into real training + calibration pairs, sharing the corpus's exact label maths) and the scheduled monthly re-eval cadence (model-eval-cadence.yml). Known protocol note: dev-split champion-vs-challenger comparisons are in-sample-flattered once a real-data champion is deployed - the holdout is the only fair fight, and the reports say so. |
| **Sophistication - estimator** | **C-** (was D+) | Two estimator families now run the full honest lifecycle. First real-data bake-off (gen-2 dev, identical purged walk-forward): depth-2 boosted trees lift 1.344x / ROC 0.585 / worst cohort 0.055 vs the linear retrain's 1.27x / 0.548 / 0.000 - the nonlinear family wins the family fight but fails the 1.5x absolute floor and does not threaten the frozen champion (in-sample-flattered 1.75x on the same windows). The seat is earned only by winning gen-3's fresh one-shot holdout on the sponsorship-filled corpus. |
| **Sophistication - data** | **C-** (was D) | 7 of 10 domains now carry real data in the corpus: technical, accumulation, liquidity, business quality (now QUARTERLY EDGAR revenue growth, matching live semantics), capital, theme (SEC SIC, outcome-independent - 80 hot-theme members, 2,316 rows), narrative (benchmark regime, all rows). Sponsorship is live in production (real Form 4 net-buy) with the historical fill running. Still survivor-biased, still no delisted names - the binding constraint stands. |
| **Honesty of presentation** | **A** | Every caveat travels with every number: provenance in the artifact, survivorship + curation caveats in corpus meta and reports, the in-app Evidence surface renders it all from the generated evidence pack, shadow-live gating intact, surfacing not earned and said so. |

> **GEN-3 UPDATE (2026-08-03, corpus a09b4310) - read this first.** The one-shot gen-3 holdout
> produced the project's defining moment: the boosted challenger (frozen pre-committed config)
> scored **2.13x CI90[1.73, 2.49]** - the highest honest number ever, and the LARGEST separation from the
> volatility null on record (+0.67, [+0.27, +1.11]; the gen-2 champion managed +0.48, [+0.05,
> +0.92]) - first by a challenger, not first ever - and the system **REFUSED to promote it** because the paired must-beat against
> the incumbent was a statistical tie (+0.33, [-0.09, +0.84]; a tie keeps the incumbent, and the
> force-reason case did not hold). The champion stays at 1.69x [1.39, 2.10]; the first
> cross-generation paired test proved its apparent decline from gen-2's 1.94x is noise
> (delta -0.18 [-0.57, +0.20]). Insider flow reached 99.86% of training rows; federal awards lit
> for 20.9% of names; the naive linear refit got WORSE with more features (failed both floors) -
> the insider signal lives in interactions only trees can read. **Grades after gen 3:**
> Accuracy C+ · Calibration B+ (DOWN - champion ECE proved feature-generation-sensitive,
> 0.017 -> 0.084) · Process A · Estimator C+ (UP) · Data C+ (UP - nine of ten domains) ·
> Honesty A. Full detail: `lyra-evals/generations/GENERATION-LOG.md` (Generation 3) and the
> v3-vs-v2 board. The per-dimension table below reflects gen-2 and is superseded where it
> disagrees with this block and the generated evidence pack (`model-evidence.json`).

**Overall: B- predictive power on an A process, now capped at C- data.** Gen-2 proved the grade
thesis empirically: the accuracy jump came entirely from lighting data domains, not from tuning -
and the gates correctly refused a retrained challenger that did not beat the incumbent on the
holdout (paired delta-lift -0.02, CI90 [-0.24, +0.28], no detectable difference - the must-beat
rule keeps the incumbent; the earlier "CIs overlapping" phrasing was the invalid overlap habit,
retired in v0.113.0 in favour of the paired test). Remaining path to A across the board:
sponsorship-filled gen-3 corpus, the nonlinear estimator earn-gate (dev evidence now in its
favour), slope-corrected calibration through the standing loop, live-ledger validation, and the
delisted-inclusive universe - where the free-source probe was decisive: yfinance does NOT serve
delisted histories (SIVB and FRC return nothing; recycled tickers like BBBY are an identity trap),
so killing survivorship requires a paid corpus source or a CIK-anchored EDGAR+OTC assembly.

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
