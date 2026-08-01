# Lyra Emerging Winner Engine — SOTA build requirements, training + hosting runbook

> Status: **research pass, 2026-07-31.** Companion to [`TRAINING-PIPELINE.md`](TRAINING-PIPELINE.md)
> (which says *what we train with today*). This doc says *what the highest-accuracy honest version of
> this model looks like in 2026*, what it therefore requires us to build, how to train it correctly for
> a rare positive with overlapping 12-month labels, and how to host it for tens of dollars a month.
>
> Method: read of the built lifecycle in `workers/emerging_winner/` + the spec + the decks, then three
> independent web-research passes (estimators/calibration/uncertainty · financial-ML validation +
> point-in-time data · hosting/MLOps/compliance). Every non-obvious claim carries a source at the end.
>
> **The headline:** the lifecycle you built is right, and the estimator is the *least* important thing to
> upgrade. The accuracy ceiling of this model is set by (a) the point-in-time dataset, (b) the validation
> regime, and (c) calibration — in that order. Swapping logistic → LightGBM is a ~1-day change that moves
> the number less than fixing the purge/embargo gap, which is a ~1-day change that moves the *honesty* of
> the number a lot.

---

## 0. What exists today (verified read, not summary)

| Stage | File | Verdict |
|---|---|---|
| Dataset | `dataset.py` | **Architecturally correct.** `assemble_training_rows` only emits rows with a matured outcome, so un-matured predictions are never labelled 0 — that is the censoring bug most people ship, and you don't have it. |
| Labeler | `dataset.py::first_touch_barrier` | Correct *shape* (first-touch, down-checked-before-up = conservative). Three real gaps — §3.2. |
| Train | `train.py` | Walk-forward + precision@k + lift + calibration bins + Brier. Right metric family. **One serious gap: no purge, no embargo** — §4.1. |
| Deploy | `classifier.py::load_champion_model` | Champion/reference dispatch with provenance stamping. This is better than most production ML I see at this scale. Keep it exactly as-is. |
| Monitor | `monitor.py` | Drift guard + live calibration + an honest "not yet earned" verdict. Keep. Two additions in §6. |
| Infer | `engine.py` → `classify()` → ledger 056 | Batch-to-immutable-ledger. This is the *correct* serving architecture for 2026 — §5.1. Do not build an endpoint. |

**The single most important structural property you already have:** the frozen-artifact + drift-fixture
contract (inherited from `recovery_model.py`). Every recommendation below is designed to slot into that
contract without changing it. `dataset → train → freeze → deploy → monitor → infer` survives every
estimator upgrade in this document.

---

## 1. The build requirements, inferred

What the model needs in order for its numbers to *mean* anything, ranked by how much accuracy each unlocks
per unit of effort. This is the honest answer to "what do we have to build."

```
 ACCURACY CEILING — what actually binds it            effort   unlocks   status
 ─────────────────────────────────────────────────────────────────────────────────────
 R1  Delisted-inclusive point-in-time universe          XL      ████████  NOT BUILT ← the gate
 R2  Purged + embargoed walk-forward CV                 S       ██████    NOT BUILT ← cheapest big win
 R3  Overlapping-label sample weights (uniqueness)      S       █████     NOT BUILT
 R4  SEC EDGAR ingestion (domains 5, 6, 9)              L       ██████    NOT BUILT (spec'd)
 R5  Out-of-fold probability calibration layer          S       █████     measured, never applied
 R6  Per-cohort precision@k (not pooled)                S       ████      pooled today
 R7  USAspending ingestion (domain 7)                   M       ████      NOT BUILT (spec'd)
 R8  GBDT estimator + TreeSHAP                          S       ███       stdlib logistic today
 R9  Real ordinal head (CORAL/cumulative-link)          S       ██        hand-spread `_ordinal_mass`
 R10 Conformal / Venn-ABERS uncertainty band            M       ██        confidence is heuristic
 R11 PU-learning correction                             M       ██        n/a until real labels
 R12 Trial-count deflation (PBO/CSCV)                   S       ███       not tracked
```

**Read that table honestly: R8 — the thing that sounds like "the model" — is eighth.** The deck's
CatBoost/LightGBM upgrade is a small win bolted onto a dataset and a validation regime that have to be
built first, exactly as `TRAINING-PIPELINE.md` §9 already says. This research pass does not change that
conclusion; it sharpens it and adds R2/R3/R5/R6/R12, which are cheap and are *not* currently in the plan.

### 1.1 R1 — the dataset gate, with prices

The spec's Open Question 1 ("which provider gives delisted/point-in-time coverage honestly, and at what
cost") now has an answer:

| Source | Delisted? | True point-in-time? | Cost (2026) | Verdict for Lyra |
|---|---|---|---|---|
| **SEC EDGAR** (Submissions, XBRL companyfacts/frames, Financial Statement Data Sets, Form 4, 13F) | Yes — dead filers stay in EDGAR forever | Yes, if you join on **filing/acceptance date**, never period-end | **Free**, public domain, no licence risk | **Build this. It is the foundation.** Covers domains 5, 6, 9. Zero commercial-licence exposure — the only source here with that property. |
| **Sharadar SF1 + SEP + Tickers** (Nasdaq Data Link / QuantRocket) | Yes — 16,000+ tickers incl. delisted, explicitly survivorship-bias-free | Yes — `ARQ`/`ARY` as-reported dimensions vs `MRQ`/`MRY` restated | Professional tier required for commercial use; low hundreds $/yr scale | **The recommended paid piece.** Cheapest source with both delisted prices *and* as-first-reported fundamentals. |
| **Norgate Data** | Yes — markets itself on survivorship-bias-free US/AU/CA | Prices yes; fundamentals thin | 6/12-month terms, price unpublished, 3-week trial | Good AU angle. Fundamentals weaker than Sharadar. |
| **EODHD** | Dedicated delisted dataset (full fundamentals post-2018, EOD-only pre-2018) | Partial — no explicit as-reported guarantee | Commercial internal-use **$399/mo**; enterprise $2,499/mo | Too expensive for the coverage delta. Cross-check source only. |
| **FMP** | Explicit Delisted Companies API | History depth scales with tier | $22–$149/mo | Cheap cross-check, not source of truth. |
| **Polygon / "Massive"** | Reference tickers incl. delisted; depth not guaranteed at low tiers | Prices only | $29–$199/mo; individual tiers are **individual-use-only** | Licence terms are a blocker for a commercial product at the cheap tiers. |
| **CRSP / Compustat PIT** | Gold standard, delisting *reason* codes | Yes, the academic benchmark | Institutional quote-only, effectively out of reach | Only via a university affiliation. |
| **Tiingo** | Community-reported **gaps** in delisted coverage | Partial | Low | Do not use for survivorship-critical work. |

**Recommended R1 stack:** SEC EDGAR (free, keyed on **CIK not ticker**) as the identity + fundamentals
backbone, plus **Sharadar SF1+SEP professional** for delisted-inclusive prices and as-reported
fundamentals. Budget: low hundreds of dollars a year, which fits `DATA-ECONOMICS.md` discipline. Everything
else is a cross-check.

### 1.2 The point-in-time gotchas that will silently fake the model

Each of these creates look-ahead that no test catches, because the code is "correct" and the data lies:

1. **As-restated vs as-first-reported.** If a company restates FY2024 revenue in a 2026 10-K/A, a naive
   query for "FY2024 revenue" leaks a future-known number into a 2025-dated row. Only Sharadar
   (`ARQ`/`ARY` + `datekey`), Compustat PIT and CRSP separate these. Insist on the flag; never trust an API
   that just returns "the value for that period."
2. **Filing-date vs period-end.** Small caps use the full 90-day window. Timestamp every fundamental
   feature by **acceptance date**, not period-end, or you leak a quarter.
3. **Ticker recycling.** Tickers get reused after delisting, sometimes within months on OTC. Joining a
   multi-year panel on raw ticker splices two unrelated companies together. **Key on CIK.** This is a
   schema decision to make now, before the first ingestion worker lands.
4. **Index / mcap-band membership must be as-of T.** "Is this a small cap" must be answered with the
   market cap at T, not today's. Using today's universe definition is the classic invisible leak.
5. **Corporate actions.** A +100%/-80% first-touch classifier is extremely sensitive to split/dividend
   adjustment applied at the wrong historical date. Verify the adjustment methodology of whatever price
   source you pick, on a known split, before trusting a single label.
6. **Delisting is not always ruin.** Acquisition at a premium is a *positive* outcome and may legitimately
   touch the +100% barrier; bankruptcy is `down_80`; going-private and uplisting are neither. CRSP has
   delisting-reason codes; on a cheaper source you must build that classification yourself. **Defaulting
   every delisting to ruin biases the model toward avoiding exactly the names that get bought.**
7. **Pre-CV leakage.** The subtlest one, and the one practitioners flag as bigger in practice than CV
   mechanics: choosing which features to engineer by looking at the full dataset. Feature selection has to
   happen inside the fold, or your purged CV is theatre.

### 1.3 The point-in-time join — you do not need a feature store

The 2026 answer for a team this size is **not** Feast/Tecton/Chronon. It is DuckDB's `ASOF JOIN`, which is
the exact "most recent value known as of T, no peeking" primitive, free, embeds in Python, and handles
millions of rows on a laptop:

```sql
-- every prediction row gets only fundamentals FILED on or before its as-of date
SELECT p.cik, p.as_of, f.revenue, f.filed_date
FROM   pit_events p
ASOF JOIN fundamentals f
  ON   p.cik = f.cik
 AND   p.as_of >= f.filed_date;   -- ASOF LEFT JOIN keeps rows with no filing yet → honest NULL
```

Note this is also *how the 056 ledger already works* — you built a point-in-time store by accident, or
rather by taste. `assemble_training_rows` is the as-of join, executed by construction rather than by SQL.
Graduate to Feast only if you ever need low-latency online feature serving, which a nightly batch never does.

---

## 2. What model to train — the 2026 answer for this exact problem

### 2.1 Estimator: LightGBM primary, CatBoost challenger, TabPFN as a second opinion only

The deck says "CatBoost/LightGBM ordinal." The 2026 evidence refines that into a specific call.

- **GBDT remains correct.** TabArena (2026, the living benchmark that replaced TabZilla/AutoML-benchmark)
  finds boosted trees still competitive on practical tabular data, with deep models closing the gap only at
  high compute budgets, and it warns that single-paper "beats GBDT" claims are sensitive to validation
  protocol. Mixed, sparse, partially-missing tabular data with an explainability requirement is GBDT's home
  turf, and nothing in 2026 changed that.
- **Tabular foundation models are tempting and wrong here — for a specific, measurable reason.**
  TabPFN-2.5 (2026) handles ~50k rows / 2k features in one forward pass and beats tuned XGBoost on
  TabArena-lite. But the 2026 uncertainty benchmark ("High Performance, Low Reliability") found TFMs win on
  AUC (~0.89 vs ~0.86) while scoring **worse on size-stratified coverage** than GBDT — they are measurably
  more overconfident under noise and heterogeneity. Lyra's entire product claim is a *calibrated*
  winner-similarity. Overconfidence is the one failure mode you cannot ship. Also: Real-TabPFN-2.5 is
  **non-commercial licensed**, which is a hard blocker. → Use as an ensemble member or a sanity second
  opinion, never as the arbiter.
- **LightGBM over CatBoost — and the tiebreaker is your own architecture, not accuracy.** CatBoost's real
  edge is ordered target-statistics encoding for high-cardinality categoricals in small-N, which matters for
  the *archetype* model (Model 3/4) but barely for Model 2, whose features are 10 numeric domain scores.
  What decides it is export portability: `lgb.Booster.dump_model()` gives a clean JSON tree structure that a
  ~40-line stdlib Python tree-walker and a ~40-line TypeScript mirror can both execute — **preserving the
  frozen-JSON + drift-fixture + Python↔TS parity contract you already have**, with zero new runtime
  dependency on the serving path. CatBoost's oblivious-tree format is exportable but fussier; m2cgen (the
  obvious transpiler) explicitly **does not support CatBoost** and appears unmaintained since 2022. So:
  **LightGBM champion, CatBoost registered challenger** (it may well win on the archetype/ranker slots).
- **Monotone constraints are free regularisation and free trust.** All three GBDTs support
  `monotone_constraints`. Where the sign is theoretically known — higher business-quality score should never
  *decrease* predicted winner probability, all else equal — constrain it. In a small-N, tiny-base-rate
  regime this is cheap regularisation, and it doubles as a doctrine guarantee: the engine cannot produce a
  card where a better balance sheet lowered the score, which is the kind of nonsense a user would (rightly)
  never forgive.
- **Native missing handling, not `0.0` imputation.** `dataset.py::domain_features` currently imputes a
  missing domain as `0.0` (neutral) and hands the model `completeness` to compensate. That is a sound
  *linear-model* workaround. GBDTs learn the optimal default split direction for missing values natively —
  strictly more expressive. Feed `None` through, and add a `{domain}_present` indicator per domain.
  **Important nuance:** today missingness is *global* (a pipeline is unbuilt for everyone) and carries no
  signal. The moment EDGAR/USAspending land, missingness becomes *name-specific* — a company with no
  government awards is genuinely different from one we haven't looked up — and it becomes real signal.
  Build the indicators now so that transition needs no schema change.

### 2.2 Ordinal head: replace `_ordinal_mass` with a real cumulative-link decomposition

`classifier.py::_ordinal_mass` spreads a single probability across four stages with hand-tuned triangles.
It is honest (deterministic, sums to 1, documented as a UI convenience) but it is not a model, and the
class probabilities it emits are not calibrated in any meaningful sense.

The 2026 answer is a rank-consistent threshold decomposition — **CORAL/CORN**-style, or **OGBoost** (2025),
a scikit-learn-compatible ordinal gradient booster that learns a latent continuous score plus a learned
threshold vector (i.e. cumulative-link / proportional-odds implemented as boosting). Two direct benefits
for Lyra:

1. It borrows statistical strength across the four stages, which matters enormously at a 2-4% base rate.
2. Its continuous `decision_function` latent score is a **better ranking signal than a class probability** —
   which is precisely what Model 4 (the research-queue ranker, Gate 8) needs. The product question is "which
   5 to research first," and a monotone latent score answers it more directly than P(winner).

Practical form that keeps your contract: train K−1 = 3 binary LightGBM boosters on cumulative thresholds
(`P(stage > 0)`, `P(stage > 1)`, `P(stage > 2)`), enforce monotonicity by construction, export all three
tree-sets into the same frozen JSON. Class probabilities are then differences of cumulative probabilities —
real, not spread.

### 2.3 Imbalance: do almost nothing, and definitely do not SMOTE

This is the most important "what NOT to do" in the whole document, because the intuitive move is the wrong one.

- **SMOTE and synthetic oversampling wreck calibration.** van den Goorbergh et al. (2022) measured it:
  random oversampling, random undersampling and SMOTE **did not improve AUROC** over training on the raw
  imbalanced data (undersampling actively *hurt* discrimination at extreme imbalance), and all three caused
  severe miscalibration — calibration intercepts of −4.5 or worse at a 1% event rate. Lyra's 2-4% base rate
  is in that regime. Their prescription: **train on the true prior and move the decision threshold
  post-hoc.** For Lyra there isn't even a decision threshold to move — you rank. So the honest answer is:
  train on the true class prior, full stop.
- **Class weighting is acceptable but not free.** `scale_pos_weight` / `class_weights` distorts the
  predicted probability scale and must be corrected in the calibration step (§2.4). Test plain
  class-weighting *before* reaching for focal loss — a 2026 applied comparison in insurance fraud found
  plain class-weighted XGBoost beat focal-loss variants.
- **PU learning becomes relevant only later, and it's already partly handled.** The positive-unlabeled
  framing (nnPU, Elkan-Noto) applies when "not a winner" is a mix of true negatives and right-censored
  future positives. `dataset.py::assemble_training_rows` already excludes un-matured predictions entirely,
  which is the clean solution and better than a correction term. Revisit PU only if you later decide to
  train on partially-matured windows to get more positives — which you will be tempted to do, and which is
  where nnPU earns its keep.

### 2.4 Calibration: currently measured, never applied — close this

`train.py::calibration_bins` and `monitor.py::_verdict` measure calibration and gate on ECE. Nothing in the
pipeline *fits a calibrator*. The raw GBDT probability goes straight to `winner_similarity`.

- Fit the calibrator **strictly out-of-fold** (nested, or a held-out calibration fold, refit every retrain).
  In-sample calibration looks perfect and fails live.
- At a 2-4% event rate: **isotonic is risky** (too few positives per fold, stair-step overfit),
  **Platt underfits** the tail, **beta calibration** is a good pragmatic middle, and **Venn-ABERS** is the
  theoretically right answer — distribution-free, *finite-sample* validity (not merely asymptotic), and it
  emits a probability **interval** [p₀, p₁] per prediction rather than a point. That interval is a far more
  honest input to the `confidence` field than the current `margin × completeness` heuristic, and it is
  exactly the kind of engine-owned number your doctrine permits. The 2025 ICML "Generalized Venn and
  Venn-Abers Calibration" work extends this to **multicalibration** — finite-sample guarantees *conditional
  on subpopulation*, i.e. calibrated per regime or per theme, not just marginally. That is the ceiling here.
- **Report adaptive (equal-mass) ECE, not equal-width.** At a 2-4% base rate almost every predicted
  probability clusters near zero, so `calibration_bins`' current equal-width `int(p * bins)` binning puts
  nearly all mass in bin 0 and leaves upper bins near-empty and noisy. This is a real defect in the current
  metric, not a nitpick — it makes ECE look better than it is. Switch to quantile bins.

### 2.5 Uncertainty: conformal, and specifically *not* the naive kind

Marginal conformal prediction systematically starves the minority class of coverage — the exact failure
mode here. Two upgrades:

- **Mondrian (class-conditional) conformal** guarantees per-class coverage, but at extreme imbalance the
  rare-class sets blow up in size. The 2025 long-tailed-classification work gives the fix: **PAS**
  (prevalence-adjusted softmax, threshold on p(y|x)/p(y)) and **INTERP-Q**, which interpolates between
  marginal and class-conditional thresholds via a tunable dial — reported cutting poorly-covered classes by
  57% for a 64% set-size increase. A dial between "shortlist stays short" and "we don't miss winners" is
  precisely the Gate-8 research-queue trade-off.
- **Adaptive conformal for non-stationarity.** A conformal calibration fitted once loses validity as regimes
  shift. **DtACI** (Gibbs & Candès, JMLR v25) runs an ensemble of adaptive-conformal instances at different
  learning rates and aggregates, removing ACI's step-size tuning. This is the principled version of the
  "2021 winner ≠ 2025 winner" problem your spec §7.3 names.
- Cheaper interim: **CatBoost virtual ensembles** give per-prediction epistemic uncertainty from a single
  trained model (truncations of the boosted sequence) without training K models — useful for saying *why*
  confidence is low (sparse data vs genuinely ambiguous signal), which is a better card than a single word.

Libraries: **MAPIE** (scikit-learn-contrib, mature, has Mondrian natively) for the core; `crepes` if you
want lighter; `torchcp` only if a deep leg appears.

### 2.6 Explainability: TreeSHAP in **interventional** mode, not the default

`classifier.py` computes SHAP-like contributions as `weight × standardised feature` — correct for a
logistic, and it must become TreeSHAP for a GBDT. Two production-grade details:

- **Use the interventional / data-reference mode, not the default path-dependent mode.** Your 10 domain
  scores are correlated *by construction* (sponsorship correlates with capital quality; technical with
  volume). Path-dependent TreeSHAP under correlated features can hand credit to a feature merely because it
  correlates with the true driver, and split it unstably between the two. Interventional mode costs more
  compute (irrelevant at a few thousand rows nightly) and better approximates the true interventional
  Shapley value. Getting this wrong produces a "why it resembles past winners" panel that is subtly,
  persistently wrong — the worst possible failure for a product whose whole claim is the explanation.
- **SHAP interaction values are a product feature you get for free.** TreeSHAP computes them exactly.
  "Theme strength is only bullish *combined with* government contract" is a materially better card than ten
  marginal bars, and it's native to the tool.
- **Grouped permutation importance for the global/model-card view**, since each domain is itself an
  aggregate of sub-signals — permute the group, not the feature. Local = TreeSHAP, global = grouped
  permutation.
- **Never LIME.** Unstable local surrogate, strictly dominated by exact TreeSHAP on a tree ensemble.
- **Monitor the SHAP attribution distribution, not just the score distribution.** When the *reasons* shift
  before accuracy degrades, that's your earliest regime-change warning — and it costs one extra table.

### 2.7 The other model slots, briefly

| Slot | Deck plan | 2026 refinement |
|---|---|---|
| Model 3 · Historical analogue | metric-learning / kNN | Keep. kNN over a learned metric on the domain vector is right and is user-facing-explainable. Prototype set must be delisted-inclusive or the analogues are all survivors. |
| Model 4 · Ranker (Gate 8) | LambdaMART | Keep — but feed it the **ordinal latent score** from §2.2, not P(winner). Evaluate with per-cohort precision@k, not NDCG over a pooled set. |
| Model 5 · Risk gates (Gate 1) | survival + dilution + manipulation | Survival analysis is genuinely the right family here (competing risks: delist-for-ruin vs delist-for-acquisition vs survive). This is where the delisting-reason classification from §1.2(6) pays off twice. |
| Gate 7 · Outcome distribution | NGBoost / quantile / competing-risk | Keep NGBoost or quantile-GBDT — but only for *continuous side-outputs* (time-to-barrier, magnitude given a win), never as the primary classification head. |

---

## 3. Concrete gaps in the built code, with fixes

These are specific, verified against the files as they stand today. Each is small.

### 3.1 `train.py::walk_forward_metrics` — no purge, no embargo *(the big one)*

```python
train_end = f * fold_size
Xtr, ytr = X[:train_end], y[:train_end]
Xte, yte = X[train_end:test_end], y[train_end:test_end]
```

With a 252-trading-day label horizon, a training row whose barrier window *overlaps* the test fold shares
outcome information with it. Training on it leaks. This is the canonical financial-ML error, and the fix is
the canonical one (López de Prado, AFML Ch. 7):

- **Purge**: drop any training row whose label interval `[t₀, t₀+252d]` overlaps any test-fold label
  interval. At a 12-month horizon the purge width is ~12 months — **not a few days**.
- **Embargo**: additionally drop training rows for a short window *after* the test fold, to block
  serial-correlation leakage. de Prado suggests ~1% of the sample; for slow-moving small-cap fundamentals a
  multi-week embargo is defensible.
- `TrainingRow` already carries `predicted_at` — the timestamps you need are already in the dataclass. The
  fix is to thread `predicted_at` (and a derived `label_end`) into `walk_forward_metrics` and filter. This
  is why it's a small change: **the data model is already right.**
- Later: **CPCV** (combinatorial purged CV) gives a *distribution* of out-of-sample precision rather than a
  single point — which matters enormously when a single test fold contains a handful of positives. Bound
  S to 6–10 groups to keep the combinatorial cost sane.

### 3.2 `dataset.py::first_touch_barrier` — three gaps for real data

Correct as written for a close-price series; three things it needs before it touches real prices:

1. **Intraday extremes.** First-touch on daily *closes* misses a barrier touched intraday. Use daily
   high/low. (Your current down-before-up ordering within a bar stays — it's the conservative choice.)
2. **Delisting is an outcome, not a missing value.** Feed a terminal event into the labeler: ruin-delist →
   `down_80`; acquisition/premium buyout → `up_100` if the consideration clears the barrier, else
   `neither`; going-private / uplisting → `neither`. Silently dropping delisted names *is* survivorship bias
   re-entering through the labeler, after you went to all the trouble of keeping them in the universe.
3. **Total-return adjusted prices**, with the adjustment applied as-of the correct historical date.

Also: keep Decision B option 4 (composite quality-winner: `+100% AND still listed AND liquidity grew`) as a
**one-line change** as the spec promises. It is anti-pump-and-dump and is very likely where you end up.
`label_from_barrier` is the right seam for it.

### 3.3 No overlapping-label sample weights

If you score the same symbol monthly with a 12-month horizon, twelve consecutive rows share ~11/12 of their
label window. Naive i.i.d. treatment overweights redundant observations and inflates every metric. The
standard fix (AFML Ch. 4) is three composable pieces:

- **Average uniqueness**: a label's weight at time t is 1/(number of concurrent label windows overlapping t),
  averaged over its lifespan.
- **Return-attribution weighting**: weight by absolute log-return captured, so unambiguous winners/ruins
  count more than marginal near-threshold outcomes.
- **Sequential bootstrap** for any bagged ensemble: draw one sample at a time, dynamically reducing the draw
  probability of anything overlapping what's already drawn.

Reference implementation to port from: `mlfinpy` (the maintained community fork of the archived `mlfinlab`).

### 3.4 `precision_at_k` is pooled, not per-cohort

`precision_at_k(oos_y, oos_p, k_frac=0.05)` takes the top 5% across the *entire* out-of-sample pool. The
product question — and the spec's own words — is "of my top 20 that quarter, how many ran." Those are
different numbers, and the pooled one flatters you: a model that ranks 2021 above 2023 globally scores well
while being useless quarter-by-quarter. Fix: group OOS predictions by scoring cohort (quarter), compute
precision@20 within each, and report the **distribution** (median, IQR, worst quarter) — not the mean alone.
"Worst quarter precision@20" is the number that tells you whether to surface this to a user.

### 3.5 Elevate PR-AUC over ROC-AUC as the headline

`TRAINING-PIPELINE.md` correctly says "never a single headline AUC," and then the bootstrap run is reported
as "OOS AUC 0.83." Under extreme imbalance ROC-AUC stays visually flattering because the false-positive-rate
denominator is dominated by the huge negative class (Saito & Rehmsmeier, PLOS ONE 2015). **Average precision
(PR-AUC) is the right primary discrimination metric**; keep Brier as the primary proper scoring rule; keep
ROC-AUC as a reference number only.

### 3.6 The bootstrap result is a plumbing proof, not evidence — say so louder

`make_bootstrap_dataset` generates labels from a **logistic** propensity over the features, then `train.py`
fits a **logistic** to recover it. OOS AUC 0.83 / 4.85× lift is therefore a near-tautology: it proves the
standardisation, gradient descent, walk-forward split, metric code and export are wired correctly — which is
genuinely valuable and is exactly what a bootstrap is for. It proves **nothing whatsoever** about whether
the winner hypothesis is learnable. `dataset.py`'s provenance string says this; the headline number in
`TRAINING-PIPELINE.md` §0 doesn't, and headline numbers travel. Suggest restating it as
*"machinery verified (bootstrap recovery: AUC 0.83) — no evidence yet about real winners."*

Also worth noting: the bootstrap rows are drawn i.i.d., so "walk-forward by fold" over them is index-order,
not time-order. It's still a valid leak-free split, but it cannot detect the leak class §3.1 is about — so
fixing §3.1 will not change the bootstrap number, and shouldn't be expected to.

### 3.7 No trial-count deflation

You will try many feature sets, labels, hyperparameters. Bailey/de Prado's **CSCV → Probability of Backtest
Overfitting** and the **Deflated Sharpe** logic exist precisely for that: report significance adjusted for
the number of configurations searched. For a classifier the analogue is deflating precision/lift by the
trial count. Cheap version that costs nothing: **log every training run** (config + OOS metric) to a small
table, so the denominator is at least *known*. `pypbo` if you want the full CSCV computation.

---

## 4. How to train — the regime, end to end

```
  HONEST TRAINING REGIME · Emerging Winner Classifier (Model 2)          ★ = not built yet

  ┌── DATA ───────────────────────────────────────────────────────────────────────┐
  │ EDGAR (CIK-keyed) ─┐                                                          │
  │ Sharadar SF1/SEP  ─┼─► DuckDB ASOF JOIN ─► point-in-time rows ★               │
  │ USAspending       ─┤   (filing-date, as-first-reported, delisted INCLUDED)    │
  │ theme graph/regime─┘                                                          │
  └───────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
  ┌── LABEL ──────────────────────────────────────────────────────────────────────┐
  │ first_touch_barrier: +100% / −80% / 12mo, intraday highs+lows,                │
  │ delisting-reason aware ★  ·  option-4 quality conjuncts one line away         │
  └───────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
  ┌── WEIGHT ★ ───────────────────────────────────────────────────────────────────┐
  │ average uniqueness × return attribution × recency decay                       │
  └───────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
  ┌── SPLIT ★ ────────────────────────────────────────────────────────────────────┐
  │ walk-forward by YEAR, PURGED (≈12mo) + EMBARGOED  → later: CPCV (S=6..10)     │
  │ feature selection happens INSIDE the fold, never before                       │
  └───────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
  ┌── FIT ────────────────────────────────────────────────────────────────────────┐
  │ LightGBM, true class prior (NO SMOTE), monotone constraints where signed,     │
  │ native missing + {domain}_present indicators,                                 │
  │ 3 cumulative-threshold boosters = rank-consistent ordinal head                │
  └───────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
  ┌── CALIBRATE ★ ────────────────────────────────────────────────────────────────┐
  │ Venn-ABERS (or beta) fitted OUT-OF-FOLD → probability + [p₀,p₁] interval      │
  └───────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
  ┌── VALIDATE ───────────────────────────────────────────────────────────────────┐
  │ PRIMARY  per-cohort precision@20 (median + worst quarter) · lift              │
  │          average precision (PR-AUC) · Brier · adaptive(equal-mass) ECE        │
  │ REFERENCE ROC-AUC · top-k survival over time · PBO across all trials ★        │
  └───────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
  ┌── FREEZE ─────────────────────────────────────────────────────────────────────┐
  │ trees + calibrator + metrics + dataset provenance → ONE JSON artifact         │
  │ drift fixtures INCLUDING near-split-boundary rows ★                           │
  └───────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
              deploy (champion) → shadow-live ledger 056 → monitor → refit
```

**Cadence.** Retrain **quarterly to semi-annually**, not nightly. With a 12-month label maturation lag,
frequent refits chase noise; the nightly job should *score*, not train. Score monthly-to-nightly against the
last stable champion. This is the opposite of the reflex, and it's right for this horizon.

**Recency weighting.** de Prado's time decay can decay by *cumulative uniqueness* rather than calendar
time — which matters here because you cannot afford to throw away positives, and a strict calendar decay
discards the rare ones you have. Combine with explicit **regime features** (VIX level/trend,
small-vs-large-cap breadth, credit spreads, IPO/SPAC issuance rate) so one model conditions on regime
rather than needing hard regime switching. `market_context.py` already gives you the start of this.

---

## 5. How to host it

### 5.1 Serving: you already have the right architecture — do not build an endpoint

Batch-precompute-into-Postgres, read from the app. Google's own framing of batch inference is exactly this
pattern; practitioner consensus is that the large majority of ML use cases never need a live endpoint, and a
real-time endpoint is justified only when the prediction depends on data unknowable before the request. A
nightly scored universe written into an immutable ledger is not that. `engine.py → repo.py → 056` is
correct, cheaper (near-zero marginal read cost through Supabase), and *more auditable* than a live path.
**No inference endpoint. Ever, for this model.**

### 5.2 Where the Python job runs: keep GitHub Actions, with one guard

You already run `hourly-stock-scanner.yml` and `nightly-maintenance.yml`. That's the right answer.

| Option | 2026 cost for a few-min nightly job | Verdict |
|---|---|---|
| **GitHub Actions** (current) | 2,000 min/mo free (Pro 3,000); public repos free; $0.006/min Linux overage. A 5-min nightly ≈ 150 min/mo | **Keep.** Already built, effectively free. |
| **Google Cloud Run Jobs** | 240k vCPU-sec + 450k GiB-sec free/mo → **$0/mo** at this scale; reuses your existing `Dockerfile`; Cloud Scheduler ~free | **The fallback**, if GH cron reliability ever bites. |
| **Modal** | $30/mo free credit, 5 crons on Starter | Best Python-native DX; second vendor account. |
| **Fly.io Machines** | ~$0.02/mo compute for 5 min/night, but no free tier for new accounts and no native cron | Cheap, needs an external trigger. |
| **AWS Lambda container** | Forever-free 1M req + 400k GB-sec; 10 GB image limit (you're nowhere near) | More IAM ceremony, no benefit here. |
| Render / Railway cron | $1/mo min (Render), no durable free tier (Railway) | No advantage over Cloud Run. |
| Supabase Edge Functions | Deno, not Python | Wrong runtime for training. |

**The one guard to add:** GitHub auto-disables `schedule`-triggered workflows after **60 days of repo
inactivity**, and disabling the schedule disables *every other trigger in that workflow file*. Your repo is
very active so this is low-risk today — but a silently-disabled cron is the single most common cause of
"why didn't last night's predictions appear," and it fails *quietly*, which violates your own
"green must go red" rule. Cheapest fix consistent with your harness: have the nightly job write a
metrics/heartbeat artifact commit, or add a trivial keepalive workflow. Also note GH cron is explicitly
best-effort and can be delayed under load — fine for nightly, never rely on it for a hard SLA.

**Training vs scoring should be separate workflows.** Nightly = score. Quarterly (manual-dispatch +
schedule) = train, validate, and only then promote. Training pulls `lightgbm`/`shap` from pip; the *serving*
path stays dependency-free (§5.4). That split is what lets you keep the CI-portable property you deliberately
built.

### 5.3 Artifact versioning: git is your registry — don't adopt MLflow

For a solo founder with one small model, the honest 2026 answer is that MLflow (needs a tracking server +
artifact store), W&B (free tier explicitly **forbids corporate use** — relevant the moment Vivacity is a
company), DVC and HF Hub are all overhead you don't need. You already do the right thing: **freeze to JSON,
commit next to the TS mirror**, which atomically co-versions the Python model and its TypeScript
re-implementation. That co-versioning is the property that actually matters for your drift guard, and no
registry gives it to you better than git does.

Two cheap additions:

1. A `model_versions` row in Supabase (or a metadata block in the artifact — you're already 80% there via
   `dataset.provenance` + `training`): version, trained-at, **data date range + data hash**, git SHA, OOS
   metrics. That last one closes reproducibility.
2. If the artifact ever outgrows the repo (LightGBM trees are bigger than 11 logistic coefficients —
   expect low MBs, still fine for git), **Cloudflare R2** free tier is 10 GB + zero egress, and it pairs
   naturally with the Postgres metadata table. Not needed yet.

### 5.4 Cross-language parity with a GBDT — the failure mode changes

Your `verify_drift_guard` proves Python↔Python agreement at <1e-6 today. When the estimator becomes a tree
ensemble, **the nature of the risk changes and your fixtures need to change with it**:

- A logistic's risk is accumulated float drift. A GBDT's is a **branch flip**: `feature <= split_value`
  where the feature sits within float-epsilon of the threshold. That's a much smaller attack surface *and*
  a much more discrete failure — one flipped branch can move a probability materially.
- Therefore: **drift fixtures must include rows engineered to sit near known split thresholds**, not just
  the 10 random seeds `train.py` currently generates. Random sampling will essentially never hit a boundary
  case, so today's fixture design would pass while the real bug ships.
- Dump split thresholds at **full float64 precision** (a default `json.dump`/`JSON.stringify` round-trip can
  lose repr precision on some doubles — verify explicitly).
- Set tolerance on probability at ~1e-9 relative, but treat **ranking-order parity** and **ordinal-stage
  parity** as the assertions that actually gate a release. A 10th-decimal probability difference is a
  non-issue; a reordered research queue is a product bug.
- Options considered and rejected: **m2cgen** (transpiles to JS, but **does not support CatBoost** and looks
  unmaintained since 2022); **ONNX + onnxruntime-web** (standard and robust, but adds a WASM runtime to a
  serverless/edge path and a binary artifact you can't diff in a PR); **Treelite/lleaves** (Python-side
  speed only, irrelevant to parity). **Verdict: hand-written tree walker over `dump_model()` JSON**, which
  preserves the human-diffable, dependency-free artifact you already rely on.

### 5.5 MLOps hygiene: the minimum that pays, and what to skip

Grounded in Google's *Rules of ML* (esp. Rule 4 "keep the first model simple and get the infrastructure
right", Rule 9 "sanity-check before deployment", Rule 10 "watch for silent data failures") and the *ML Test
Score* rubric.

**Do — and most of it you already have:**

- Seeded, reproducible training (`seed=42`, `TRAINED_AT` fixed — already done, and the comment explaining
  why coefficients don't depend on it is exactly right).
- **A pre-publish floor gate**: the new champion must beat a floor on per-cohort precision@k *and* ECE
  before it's allowed to overwrite `emerging-winner-model.json`. Today `train_and_export` writes
  unconditionally. This is the single highest-value addition to `train.py` — a bad retrain currently ships
  silently.
- Drift fixtures as a **blocking CI gate on every retrain** (you have the gate; make sure the boundary rows
  from §5.4 are in it).
- **Input freshness/shape assertions** before the nightly write: row count in a sane range, no unexpected
  nulls in required columns, as-of date is actually today. Rule 10.
- Output-distribution sanity: not all identical, not all NaN, roughly matching the historical distribution,
  before the ledger write.
- Model-card metadata alongside the artifact (§5.3) — documentation, not infrastructure.

**Skip at this scale:** shadow deployment / canary / traffic-splitting (your immutable ledger + nightly
batch already gives you the safe equivalent: score, sanity-check, then write), automated retraining
triggers (a bad retrain ships silently — you want a human in the quarterly loop), a feature store,
Airflow/Dagster/Prefect (a DAG of one node is a script; Dagster+ Solo is no longer free as of May 2026 —
$10/mo base), and a dedicated drift-monitoring platform. If you ever want a free run-history/alerting UI
over the same script, **Prefect Cloud's Hobby tier** (free: 5 deployments, 500 min/mo) is the cheapest
upgrade — but you'd be buying observability, not orchestration.

**One tool worth a look later:** **NannyML** is specifically designed for *performance estimation when
labels arrive late* — which is Lyra's exact situation (12-month maturation). That's a better fit than
Evidently for your problem, and it's the only monitoring tool in this space that addresses the actual
constraint rather than routing around it.

---

## 6. Monitoring additions

`monitor.py` is already good. Three additions:

1. **Feature drift**: PSI on each domain-score distribution vs the training window. Thresholds: <0.1 stable,
   0.1–0.25 investigate, ≥0.25 retrain. Cheap, interpretable, one query.
2. **Attribution drift**: track the mean |SHAP| per domain over time. When the *reasons* shift before
   accuracy degrades, that's the earliest regime-change signal you can get.
3. **Coverage drift**: `mean_completeness` is already tracked — add an alert when a domain flips from
   available to unavailable for a large fraction of the universe, because that means a pipeline broke, and
   a broken pipeline silently degrades every prediction while all tests stay green.

Keep `_verdict`'s honest gate (`lift ≥ 2.0 AND ECE ≤ 0.1`). Suggest tightening it once real labels exist to
also require **worst-quarter precision@k above base rate** — a model that works on average and fails in one
regime is not one to surface.

---

## 7. Compliance — one item is time-sensitive

- **EU AI Act Article 50 transparency obligations apply from 2 August 2026 — that is two days from today.**
  If Lyra has (or may have) EU users, model-derived numbers should carry a visible "model-generated"
  disclosure. Your architecture already satisfies the substance — engine-owned numbers, `guardProse`,
  mandatory risks, an immutable audit trail of which model version produced which number — so this is a UI
  copy change measured in minutes, not an engineering programme. High-risk (Annex III) obligations don't
  land until 2 December 2027 and likely don't apply to a research/screening product regardless. Max Art. 50
  exposure is €15M / 3% turnover; immaterial at your scale, but the copy change is ten minutes.
- **US SEC**: the predictive-data-analytics conflicts rule (S7-12-23) was **formally withdrawn 12 June
  2025**. No rule specifically targets algorithmic conflicts today. General anti-fraud and
  adviser-status analysis still apply if output becomes personalised and actionable — your "research, never
  advice / never buy / never a price target" doctrine is the correct posture and should not be relaxed.
- **Australia (ASIC/APRA)**: 2026 AI guidance targets *licensed* entities; a research product sits outside
  that perimeter unless it functions as financial advice. What does apply regardless: ACCC consumer law on
  misleading claims about what the model does. Which is another way of saying: the shadow-live gate and the
  honest provenance strings are compliance features, not just taste.

---

## 8. What NOT to do (consolidated)

1. **Don't SMOTE, don't oversample, don't undersample.** Evidenced to wreck calibration at low event rates
   without improving discrimination. Train on the true prior.
2. **Don't ship a walk-forward without purge + embargo** on a 12-month overlapping label. Everything
   downstream is fiction if this is wrong.
3. **Don't treat un-matured predictions as negatives.** (You don't. Keep not doing it.)
4. **Don't drop delisted names at the labeler** after including them in the universe — that reintroduces
   survivorship bias one layer down.
5. **Don't default every delisting to ruin** — acquisitions at a premium are winners.
6. **Don't join a multi-year panel on ticker.** Key on CIK.
7. **Don't do feature selection outside the fold.** Bigger practical leak than CV mechanics.
8. **Don't fit the calibrator in-sample.** It will look perfect and fail live.
9. **Don't use equal-width ECE bins** at a 2-4% base rate — use equal-mass.
10. **Don't headline ROC-AUC.** Average precision + per-cohort precision@k + Brier.
11. **Don't use marginal conformal** on a rare class — it starves the class you care about.
12. **Don't use default path-dependent TreeSHAP** on correlated domain scores — use interventional mode.
13. **Don't use LIME.** Ever, here.
14. **Don't make TabPFN/TFMs the arbiter** — measurably more overconfident under noise, and Real-TabPFN-2.5
    is non-commercially licensed.
15. **Don't build an inference endpoint.** Batch-to-ledger is strictly better for this shape.
16. **Don't retrain nightly.** Score nightly, train quarterly.
17. **Don't adopt MLflow/W&B/DVC/Airflow/Dagster** at this scale. Git + a metadata row + cron is correct.
18. **Don't let `train_and_export` overwrite the champion unconditionally.** Add the floor gate.
19. **Don't build drift fixtures from random rows once the model is a tree ensemble** — engineer
    near-split-boundary rows, or the guard passes while the bug ships.
20. **Don't quote the bootstrap AUC as evidence about winners.** It's a plumbing proof and should read like one.

---

## 9. Recommended sequence

Ordered by (unlocked accuracy ÷ effort), and deliberately putting the cheap correctness fixes *before* the
expensive data work, because they're what make the expensive data work trustworthy when it arrives.

| # | Work | Where | Size |
|---|---|---|---|
| 1 | Purge + embargo in walk-forward; thread `predicted_at`/`label_end` through | `train.py` | S |
| 2 | Per-cohort precision@k (median + worst quarter); PR-AUC primary; equal-mass ECE bins | `train.py`, `monitor.py` | S |
| 3 | Pre-publish floor gate before artifact overwrite | `train.py` | S |
| 4 | Restate the bootstrap headline as a machinery proof | `TRAINING-PIPELINE.md` | XS |
| 5 | Boundary-row drift fixtures | `train.py`, `monitor.py` | S |
| 6 | Overlapping-label sample weights (average uniqueness) | `dataset.py` | S |
| 7 | Out-of-fold calibrator (beta → Venn-ABERS) applied, not just measured | `train.py`, `classifier.py` | M |
| 8 | Trial log table for PBO/trial-count deflation | new migration | S |
| 9 | LightGBM estimator + JSON tree export + stdlib walker + TS mirror; TreeSHAP (interventional) | `train.py`, `classifier.py` | M |
| 10 | Rank-consistent ordinal head (3 cumulative boosters) replacing `_ordinal_mass` | `classifier.py` | M |
| 11 | Labeler: intraday high/low, delisting-reason handling, total-return adjustment | `dataset.py` | M |
| 12 | **SEC EDGAR ingestion worker** (CIK-keyed, filing-date stamped) → domains 5, 6, 9 | new worker + migration | **L** |
| 13 | **Sharadar SF1/SEP** delisted-inclusive PIT prices + as-reported fundamentals | new worker + migration | **L** |
| 14 | USAspending ingestion → domain 7 | new worker + migration | M |
| 15 | Conformal band (Mondrian + PAS/INTERP-Q dial), DtACI adaptation | `classifier.py` | M |
| 16 | CPCV replacing single-path walk-forward | `train.py` | M |

Items 1–8 are a week of work, need no new data, and are the difference between a number you can defend and
a number you can't. Items 12–13 are the multi-week gate `TRAINING-PIPELINE.md` §9 already names — nothing
here changes that, and everything here is designed to be waiting for them when they land.

Harness note: 12–14 each need their own worker + migration (next free prefix after 056) + `LOOPS.md` motion
entry + `DATA-ECONOMICS.md` budget + version bump, per `TRAINING-PIPELINE.md` §7. Items 1–11 touch `workers/`
and so still need the version bump.

---

## Sources

**Estimators + tabular SOTA**
- [TabArena: A Living Benchmark for ML on Tabular Data (arXiv:2506.16791)](https://arxiv.org/abs/2506.16791)
- [TabPFN-2.5 Model Report — Prior Labs](https://priorlabs.ai/technical-reports/tabpfn-2-5-model-report)
- [High Performance, Low Reliability: Uncertainty Benchmarking for Tabular Foundation Models (arXiv:2605.28554)](https://arxiv.org/html/2605.28554v1)
- [The state of Tabular Foundation Models, 2026](https://mindfulmodeler.substack.com/p/the-state-of-tabular-foundation-models)
- [Tabular data: Deep learning is not all you need (arXiv:2106.03253)](https://arxiv.org/abs/2106.03253)
- [CatBoost missing-values processing](https://catboost.ai/docs/en/concepts/algorithm-missing-values-processing)
- [LightGBM Advanced Topics (monotone constraints)](https://lightgbm.readthedocs.io/en/latest/Advanced-Topics.html)
- [OGBoost: ordinal gradient boosting (arXiv:2502.13456)](https://arxiv.org/abs/2502.13456)
- [CORN / rank-consistent ordinal regression (arXiv:2111.08851)](https://arxiv.org/abs/2111.08851)

**Imbalance, calibration, uncertainty**
- [The harm of class imbalance corrections for risk prediction models (arXiv:2202.09101)](https://arxiv.org/pdf/2202.09101)
- [Focal loss vs class-weighted XGBoost, insurance fraud (2026)](https://burning-cost.github.io/2026/03/31/focal-loss-insurance-fraud-detection/)
- [nnPU — PU learning with a non-negative risk estimator (arXiv:1703.00593)](https://arxiv.org/pdf/1703.00593)
- [Generalized Venn and Venn-Abers Calibration, ICML 2025 (arXiv:2502.05676)](https://arxiv.org/abs/2502.05676)
- [Understanding Model Calibration — ICLR Blogposts 2025](https://iclr-blogposts.github.io/2025/blog/calibration/)
- [Adaptive (equal-mass) ECE](https://insightful-data-lab.com/2025/08/22/adaptive-ece-expected-calibration-error-with-adaptive-binning/)
- [Conformal Prediction for Long-Tailed Classification — PAS / INTERP-Q (arXiv:2507.06867)](https://arxiv.org/pdf/2507.06867)
- [MAPIE — Mondrian conformal prediction](https://mapie.readthedocs.io/en/v0.9.0/theoretical_description_mondrian.html)
- [DtACI — Conformal Inference for Online Prediction with Arbitrary Distribution Shifts (JMLR v25)](http://www.jmlr.org/papers/v25/22-1218.html)
- [Uncertainty in Gradient Boosting via Ensembles, ICLR 2021 (arXiv:2006.10562)](https://arxiv.org/pdf/2006.10562)

**Explainability**
- [TreeSHAP — Consistent Individualized Feature Attribution for Tree Ensembles (arXiv:1802.03888)](https://arxiv.org/abs/1802.03888)
- [Interventional SHAP values and interaction values (AAAI)](https://ojs.aaai.org/index.php/AAAI/article/view/26322/26094)
- [Aligning Shapley contributions and permutation feature importance — Amazon Science](https://assets.amazon.science/ea/92/35606b124fe89226a23e02cc1956/a-model-explanation-framework-aligning-shapley-contributions-and-permutation-feature-importance.pdf)

**Financial-ML validation**
- [Purged cross-validation (overview)](https://en.wikipedia.org/wiki/Purged_cross-validation)
- [AFML Ch. 4 — sample weights / average uniqueness](https://www.oreilly.com/library/view/advances-in-financial/9781119482086/c04.xhtml)
- [Sequential bootstrapping — Hudson & Thames](https://hudsonthames.org/bagging-in-financial-machine-learning-sequential-bootstrapping-python/)
- [mlfin.py — maintained fork of mlfinlab (sampling/labelling)](https://mlfinpy.readthedocs.io/en/latest/Sampling.html)
- [Bailey, Borwein, López de Prado, Zhu — The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf)
- [Bailey & López de Prado — The Deflated Sharpe Ratio](https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf)
- [pypbo — PBO/CSCV in Python](https://github.com/esvhd/pypbo)
- [Backtest Overfitting in the ML Era (Knowledge-Based Systems, 2024)](https://www.sciencedirect.com/science/article/abs/pii/S0950705124011110)
- [Saito & Rehmsmeier — PR plot more informative than ROC on imbalanced data (PLOS ONE 2015)](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0118432)

**Point-in-time data**
- [SEC EDGAR Application Programming Interfaces](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [Sharadar (sharadar.com)](https://www.sharadar.com/) · [Sharadar SF1 on Nasdaq Data Link](https://data.nasdaq.com/databases/SF1) · [QuantRocket Sharadar overview](https://www.quantrocket.com/sharadar/)
- [Norgate Data](https://norgatedata.com/)
- [EODHD delisted companies data](https://eodhd.com/financial-apis/delisted-stock-companies-data) · [EODHD commercial pricing](https://eodhd.com/commercial-pricing)
- [FMP delisted companies API](https://site.financialmodelingprep.com/developer/docs/stable/delisted-companies) · [FMP pricing](https://site.financialmodelingprep.com/pricing-plans)
- [Massive (Polygon.io) pricing](https://massive.com/pricing)
- [CRSP subscription information](https://www.crsp.org/subscription-information/)
- [Tiingo delisted-coverage gaps (AmiBroker forum)](https://forum.amibroker.com/t/tiingo-and-delisted-stocks/26140)
- [Look-Ahead Bias in Quant Research](https://ariaanalyst.pro/blog/look-ahead-bias-quant)
- [DuckDB ASOF JOIN](https://duckdb.org/docs/current/guides/sql_features/asof_join)
- [Feature Store Comparison 2026](https://mlopsplatforms.com/posts/feature-store-comparison-2026/)

**Hosting + MLOps**
- [Google Cloud — What is batch inference?](https://cloud.google.com/discover/what-is-batch-inference)
- [Batch vs Real-Time ML Inference: 90% of predictions can be batch](https://stacksimplify.com/blog/batch-vs-realtime-inference/)
- [GitHub Actions billing](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
- [GitHub community discussion #32197 — scheduled workflows disabled after 60 days](https://github.com/orgs/community/discussions/32197)
- [Google Cloud Run pricing](https://cloud.google.com/run/pricing) · [Cloud Scheduler pricing](https://cloud.google.com/scheduler/pricing)
- [Modal pricing](https://modal.com/pricing) · [Fly.io pricing](https://fly.io/docs/about/pricing/) · [Render cron jobs](https://render.com/docs/cronjobs)
- [Weights & Biases pricing (free tier forbids corporate use)](https://wandb.ai/site/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing)
- [m2cgen (no CatBoost support; unmaintained since 2022)](https://github.com/BayesWitnesses/m2cgen)
- [sklearn-onnx — LightGBM conversion](https://onnx.ai/sklearn-onnx/auto_tutorial/plot_gexternal_lightgbm.html)
- [Google — Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml)
- [The ML Test Score (Breck, Cai et al., Google Research)](https://research.google.com/pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- [Prefect pricing](https://www.prefect.io/pricing) · [Dagster+ Solo pricing update, May 2026](https://support.dagster.io/articles/3171123463-dagster-solo-and-starter-pricing-updates-may-2026)
- [Drift detection 2026 — Evidently / NannyML / Alibi Detect](https://pythondatabench.com/article/data-drift-detection-python-evidently-nannyml-alibi-detect-2026)
- [Population Stability Index (PSI)](https://coralogix.com/ai-blog/a-practical-introduction-to-population-stability-index-psi/)

**Compliance**
- [EU AI Act Article 50 transparency rules](https://artificialintelligenceact.eu/transparency-rules-article-50/)
- [What actually applies from August 2026 — EU AI Act](https://www.digitalapplied.com/blog/eu-ai-act-august-2026-transparency-obligations-agency-checklist)
- [SEC — S7-12-23 (Predictive Data Analytics), withdrawn June 2025](https://www.sec.gov/rules-regulations/2025/06/s7-12-23)
- [Proskauer — SEC formally withdraws fourteen rule proposals](https://www.proskauer.com/alert/sec-withdraws-fourteen-rule-proposals)
- [AI governance in Australia — APRA, ASIC and the 2026 letters](https://www.quickailab.com/articles/gov-08-ai-governance-in-australia-apra-asic-and-the-2026-letters)
