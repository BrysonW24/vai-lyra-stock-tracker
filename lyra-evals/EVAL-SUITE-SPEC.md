# The evaluation suite — tests, generational benchmarking, and the visual evidence set

> Research pass 3, 2026-08-01. Companion to [`MODEL-REPORT-CARD.md`](MODEL-REPORT-CARD.md),
> [`MODEL-REGISTRY.md`](MODEL-REGISTRY.md) and
> [`lyra-modelling/NORTH-STAR.md`](../lyra-modelling/NORTH-STAR.md).
>
> Question asked: what suite of tests is right for this modelling choice, so that gen-1 → gen-2 → gen-3
> is a *properly benchmarked* trajectory, and so every component is explainable and visualised — shareable,
> honest about strengths, honest about where it falls short.
>
> Two web-research passes: (1) named model-validation test suites, behavioural/invariance testing, slice
> discovery, statistical tests for comparing model generations, calibration depth, reporting standards;
> (2) the visual/explainability artefact set and the libraries that generate it headlessly in CI.
>
> **Headline:** your backtest *statistics* are stronger than most production ML teams'. The gaps are in
> four other places — comparing generations, testing model *behaviour* (not just metrics), discovering
> failure slices automatically, and monitoring during the 12-month label gap. One of them is a live
> statistical error in the current loop. §2.

---

## 1. What the suite already does that almost nobody does

Stating this first because the gap list below is long, and length shouldn't read as a verdict.

Genuinely rare, verified in the report card and registry: a **one-shot holdout scored once per corpus
generation** with a written rule against iterating on it; **symbol-clustered block bootstrap** (correct —
rows are not independent); **purge + embargo** on a 12-month overlapping label; a **standing rule that
>2× lift triggers mandatory leakage decomposition** *before* the number is reported; a published
**leakage-ablation waterfall** (2.77 → 1.47 → 1.35 → 1.31) that shows the headline getting *smaller*;
**forced-promotion audit** with recorded reasons; **corpus integrity hashes** in the metrics history;
and the explicit self-flag that dev-split champion-vs-challenger is in-sample-flattered once a real-data
champion is deployed.

That last one is the tell. Teams that notice that failure mode are not the teams that need convincing
about rigour. Most of what follows is additive, not corrective — except §2.

---

## 2. The one statistical error currently in the loop

From the gen-2 report card:

> *"the gates correctly refused a retrained challenger that did not beat the incumbent on the holdout
> (1.91x vs 1.94x, CIs overlapping)"*

**Comparing two confidence intervals for overlap is not a valid test of difference.** It is a well-known
inferential error: two CIs can overlap substantially while the paired difference is significant, and
(less often) can fail to overlap while the difference is not. The correct object is a CI on the
**difference**, not the relationship between two separate CIs.

Here the error was *conservative* — you refused a promotion, which is the safe direction — so nothing bad
shipped. But the same test will eventually block a genuinely better challenger, and it will do so
invisibly, which is worse than the reverse.

**The fix is small and you already own every piece of it.** Both models score the *same* holdout rows.
So:

```
for b in 1..B:
    resample SYMBOLS with replacement (block bootstrap — as you already do)
    Δ_b = lift@k(challenger, resampled) − lift@k(champion, resampled)
report: mean(Δ), CI90(Δ), and P(Δ ≤ 0)
```

Promotion gate becomes **`CI90(Δ) excludes 0`**, not "CIs don't overlap." This is the single
highest-value change in this document: it is maybe 30 lines inside the existing `compare` step, it makes
the gen-N→gen-N+1 decision statistically defensible for the first time, and it is what the rest of the
generational protocol in §7 builds on.

Corollary for the report card: **1.94× vs 1.72× (gen-2 vs gen-1) has never been tested either.** Those
are different corpora and different holdout windows, so a paired test isn't directly available — which is
itself worth saying out loud in the registry. See §7.3 for how to make cross-generation claims honestly
when the corpus changes underneath you.

---

## 3. Tier 1 — tests to add now (cheap, no new data, high value)

### 3.1 Average precision (PR-AUC) as the headline discrimination metric

The report card leads with **ROC-AUC 0.592**. At a 13.4% base rate, ROC-AUC is systematically flattering:
the false-positive-rate denominator is dominated by the huge negative class, so the curve stays visually
respectable while precision collapses. Saito & Rehmsmeier (PLOS ONE 2015) is the standard citation;
Davis & Goadrich (ICML 2006) proves a curve dominates in ROC space iff it dominates in PR space and gives
the correct PR interpolation (linear interpolation valid in ROC space is *not* valid in PR space).

**Do:** report **average precision** with the no-skill baseline drawn at prevalence (not 0.5), demote
ROC-AUC to a secondary reference number. Your precision@k and lift are already the right *product*
metrics; AP is the right *discrimination* metric to sit beside them.

### 3.2 Calibration slope and intercept, plus Spiegelhalter's z — the fix for the prevalence gap

The card reports **ECE 0.017 at corpus prevalence** and correctly flags deployment-prevalence
recalibration as the open step. ECE alone is a weak instrument: it is binned, threshold-free but
bin-choice-sensitive, and carries no significance test.

The clinical-prediction-model literature is a decade ahead of ML here. **Van Calster et al.'s calibration
hierarchy** (J Clin Epidemiol 2016) defines four levels:

| Level | What it means | Your status |
|---|---|---|
| **Mean** calibration | mean predicted = mean observed (calibration-in-the-large) | **not explicitly verified** |
| **Weak** calibration | intercept = 0 *and* slope = 1 | **not verified** |
| **Moderate** calibration | the full smoothed reliability curve lies on the diagonal | implicitly claimed by your reliability diagram + ECE |
| **Strong** calibration | correct at every covariate pattern | unattainable — cite it so nobody demands it |

Most teams do exactly what you do: claim moderate calibration via a reliability diagram, and never verify
weak calibration — which is the *cheaper and higher-powered* first check. It is one logistic regression of
the outcome on `logit(p̂)`:

- **intercept** → are predictions systematically high or low overall. This is precisely the
  corpus-10%-vs-deployment-3% problem, measured rather than asserted.
- **slope** → are predictions too extreme (slope < 1 = overconfident in the tails, the classic rare-event
  failure) or too flat.

Add **Spiegelhalter's z-test** (1986) alongside for a formal p-value on "is this calibrated," derived from
the Brier-score residual decomposition. Closed-form, a few lines. Reference implementation in the
`calzone` package.

**Do:** report `calibration intercept`, `calibration slope`, `Spiegelhalter z (p)` next to ECE in every
cycle, and state which hierarchy level you have verified. This turns "A- calibration, deployment
recalibration pending" into a measured claim with a number attached.

### 3.3 Reliability diagram with per-bin n and CI bands

At a 13.4% base rate the upper deciles will be sparse. An unshaded reliability curve looks most precise
exactly where it is noisiest. **Annotate n per bin and draw bootstrap or Wilson bands.** You already
bootstrap; this is reusing it.

### 3.4 Top-k churn between generations — pick stability

You measure whether gen-2's *metrics* beat gen-1's. You do not measure whether gen-2 **picks the same
names**. For a research-queue product this matters more than a fractional lift difference: a model whose
headline is stable while its top-20 churns completely is telling you the signal is noise-dominated, and it
destroys user trust in a way no metric captures.

**Do:** on a fixed scoring date, compute **Jaccard overlap of the top-k sets** and **Spearman ρ / Kendall
τ of the full score vectors** between consecutive generations, reported as a distribution across scoring
dates, not a single number. Add to `model-metrics-history.jsonl`.

### 3.5 Information coefficient time series — the finance-native check

Precision@k is a top-slice metric; IC tests whether the *whole ranking* carries information. Standard
quant practice: compute cross-sectional **Spearman IC per scoring period**, then test the IC *series*:

- mean IC > 0 with a **Newey-West / HAC-adjusted** t-stat (mandatory — your labels overlap in time, so
  the IC series is autocorrelated and a naive t-stat is anti-conservative);
- **IC Information Ratio** = mean(IC) / std(IC) across periods;
- leave-one-period-out robustness — is the whole result carried by 2021?

This directly stress-tests the thing your per-quarter chart hints at (2018 and 2022 are thin) but doesn't
quantify.

### 3.6 Decile lift monotonicity, tested not eyeballed

You show lift at top-2/5/10%. Add the **full decile table** and run a **Jonckheere-Terpstra trend test**
for monotonic decrease across deciles, with symbol-clustered bootstrap CIs per decile. A model whose
decile 1 beats chance but whose deciles 2-4 are inverted is a different animal from one with a clean
gradient, and the three-cutoff chart cannot distinguish them.

---

## 4. Tier 2 — the behavioural test layer (this is the biggest structural gap)

509 Python tests is a lot. But reading what they pin — purge units, EDGAR as-of discipline, label honesty,
corpus integrity, forced-promotion audit — they are **pipeline and discipline tests**. Almost none of them
test the **model's behaviour**. Nothing in the suite would catch a model quietly keying off a leakage
proxy, or learning that dilution is *good*, as long as the aggregate metrics looked fine.

The canonical framework is **CheckList** (Ribeiro et al., ACL 2020 best paper) — written for NLP, but the
three test types port directly to tabular:

### 4.1 Minimum Functionality Tests (MFT) — hand-built rows with known answers

20–50 synthetic rows spanning the report card's regime × cap-tier cells, each with an unambiguous expected
direction. A name with strong theme membership, insider net-buying, improving revenue and no dilution
should score high; a name with heavy shelf issuance, deteriorating fundamentals and rising short interest
should score low. **These are golden fixtures for the model the way
`contracts/score-golden-vectors.json` is for the deterministic score** — the same pattern you already
trust, applied one layer up.

### 4.2 Invariance Tests (INV) — perturb what should not matter

The highest-value one for Lyra, given the leakage history:

- **Symbol permutation.** Swap the ticker/CIK identifier while holding every real feature fixed. The score
  must not move. If it does, something is keying off identity — which is the exact class of bug the
  2.77 → 1.31 waterfall kept finding, but discovered by ablation months later rather than by a test in CI.
- **Row-order / batch-composition invariance.** Score the same row alone, and inside a batch of 5,000.
  Identical output required. Tabular pipelines silently fail this when any feature is computed
  group-relative (percentile-within-scan, z-score-within-universe). Worth checking whether any domain
  sub-signal is cross-sectionally normalised — if so, this test will find it.
- **Immaterial noise** on low-importance features → score stability within tolerance.

### 4.3 Directional Expectation Tests (DIR) — perturb what should matter, in a known direction

For every feature where the domain asserts a sign, assert the model honours it: increasing insider
net-buy, decreasing dilution, improving revenue growth must not *decrease* predicted probability, all else
equal. This is a monotonicity sweep, and it doubles as doctrine enforcement — it is the automated version
of "the engine must never produce a card where a better balance sheet lowered the score."

Note the interaction with an earlier finding: gen-1 showed `technical` and `liquidity` **flipping negative**
on real doublers. That is a genuine, data-driven sign inversion, not a bug — so those two features must be
explicitly *excluded* from the DIR set, with the reason recorded. Writing that exclusion list is itself
valuable documentation.

### 4.4 Model assertions on the live path

Kang et al. (MLSys 2020), "Model Assertions for Monitoring and Improving ML Models" — runtime invariants on
live predictions. For Lyra: *"a symbol's winner-similarity must not move more than X between consecutive
nightly scans absent a material feature change."* Cheap, and it fires during the 12-month label gap when
nothing else can.

**Where this lands:** a new `tests/behavioral/` directory, run every CI pass and every retrain. It is the
missing half of "green must go red" — today the pipeline can go red, the model cannot.

---

## 5. Tier 3 — automated slice discovery, for "where it falls short"

Your failure narrative is currently **hand-cut**: per quarter, per market-cap tier. Both are good cuts.
Both are also hypotheses you chose in advance, which means the failure modes you did not think to look for
remain invisible.

**SliceLine** (Sagadeeva & Boehm, SIGMOD 2021) formalises slice-finding as a linear-algebra optimisation
that returns the **top-k conjunctive feature-value slices maximising an error-weighted score**, balancing
slice size against error concentration, without exhaustive enumeration. Python implementation:
`sliceline` (DataDome), **BSD-3-Clause**, v0.2.22 (Jun 2026), actively maintained, optional Numba JIT.

Feed it your holdout feature matrix plus per-row loss and it returns ranked underperforming conjunctions —
things like *"micro-cap ∧ hot-SIC theme ∧ Q3 ∧ low completeness"* — which your two independent cuts would
each individually hide. **This is the single change that would most strengthen the report card's
credibility**, because it converts a chosen narrative into a discovered one.

Presentation layer: **Microsoft Error Analysis** (`raiwidgets` / `responsible-ai-toolbox`, MIT, actively
maintained) gives a decision-tree cohort view fit *on the errors* plus a feature-pair error heatmap, and
produces a shareable interactive dashboard. Alternative if you want it static and committable: fit
`DecisionTreeClassifier` on `y = is_error` and render with `dtreeviz`.

**Do:** run `sliceline` on every holdout, publish the top-5 discovered slices in the report card next to
the hand cuts, and add "worst discovered slice lift" as a registry metric alongside "worst quarterly
cohort."

---

## 6. Tier 4 — the correction your rigour is missing: selection bias

Standing rule #2 (">2× lift triggers mandatory leakage decomposition") is excellent and genuinely unusual.
But it guards against **temporal leakage**. It does not guard against **data snooping across the model
search** — the inflation that comes from trying many feature sets, corpora, and configurations and
reporting the winner.

Gen-2 explicitly involved a search: new theme features via SEC SIC, market regime added, a retrained
challenger evaluated and rejected. That is a search space, and the winner's margin is upward-biased by the
size of that space.

The named remedies:

- **Hansen's SPA test** (2005) / **White's Reality Check** (2000) — tests whether the *best of many*
  candidates genuinely beats a benchmark, controlling family-wise error across the whole search.
- **Model Confidence Set** (Hansen, Lunde & Nason, *Econometrica* 2011) — rather than crowning one winner,
  iteratively eliminates statistically inferior candidates until you are left with the *set* that cannot
  be distinguished from the best. This is arguably the more honest artefact for the registry: "gen-2 and
  the rejected challenger are in the same confidence set" is a truer statement than "gen-2 won."
- **Deflated Sharpe** logic (Bailey & López de Prado) — the general principle: deflate the reported
  statistic by the number of trials.

**The cheapest version that costs nothing and gets most of the benefit: log every training run** — config,
corpus hash, OOS metric — to the metrics history, so the denominator is at least *known* and future-you can
compute the correction. You already append per cycle; extend it to per *attempt*, not per promoted model.

**Suggested standing rule #6:** *the number of configurations evaluated in a cycle is reported alongside
the cycle's headline.* One integer. It makes the search visible.

---

## 7. The generational benchmark protocol (gen-1 → gen-2 → gen-3)

This is the direct answer to "ensure we're actually seeing the proper benchmark."

### 7.1 Within a corpus generation — paired, always

Both models score identical rows, so **always test the paired difference** (§2), never two separate CIs.
Primary: symbol-clustered paired block bootstrap on Δlift@k, Δaverage-precision, ΔECE. Report
`mean Δ`, `CI90(Δ)`, `P(Δ ≤ 0)`.

Confirmatory, optional: **DeLong's test** for correlated AUCs on the same rows (but use a
**cluster-bootstrap variant** — the closed-form covariance assumes independent observations, which
symbol-clustered rows violate); **McNemar's test** if you want to compare decisions at a fixed top-k cut
rather than scores; **clustered Diebold-Mariano** on a per-symbol-quarter loss series.

### 7.2 Across CV folds — never a naive t-test

If any comparison is made across walk-forward folds rather than on the holdout, a plain t-test is wrong:
folds share training data, so their performance estimates are positively correlated and the naive variance
is badly understated (**Nadeau & Bengio, "Inference for the Generalization Error," 2003**). Use the
corrected resampled t-test (R's `correctR` implements it) or — simpler and better here — the same
symbol-clustered block bootstrap.

### 7.3 Across corpus generations — the hard case, and the honest framing

Gen-1 (1.72×) and gen-2 (1.94×) were measured on **different corpora and different holdout windows**. No
paired test exists. Three options, in order of preference:

1. **Re-score gen-1's frozen artifact on gen-2's corpus and holdout**, then run the paired test in §7.1.
   This is the only genuine like-for-like comparison, and because you freeze artifacts it costs one
   inference pass. **Do this.** It converts "gen-2 is better" from an assertion into a measurement, and it
   directly answers whether the improvement came from the model or from the corpus — which the report card
   currently claims ("the jump came from DATA") on plausible but untested grounds.
2. If (1) is impossible for a future generation, state the comparison as **non-paired and confounded**, and
   report both models' numbers on their own corpora with the confound named.
3. Never let a cross-corpus delta into a headline without one of the above.

### 7.4 The decision framing

Alongside the frequentist numbers, consider a **Bayesian comparison with a region of practical
equivalence** (Benavoli et al., JMLR 2017, `baycomp`). It outputs P(gen-N+1 better) / P(practically
equivalent) / P(worse) rather than a binary significant/not. Given ~2,796 winners across 27,420 rows and a
worst-cohort lift of 0.20, "probably equivalent" is very often the true answer, and a framework that can
*say* that is better than one that can only fail to reject.

---

## 8. Tier 5 — monitoring across the 12-month label gap

Migration 057 and the outcome-maturation job closed the loop — but there is still a **12-month window
between a prediction and the label that judges it**, during which you have no principled read on whether
the deployed model is degrading.

**NannyML** (Apache-2.0, actively maintained) is built for exactly this. **CBPE** (Confidence-Based
Performance Estimation) estimates classifier performance *without ground truth*, using the model's own
calibrated confidence plus the observed feature distribution. It is the only tool in this space that
addresses the label-latency constraint rather than routing around it — and it is only valid if the model
is well calibrated, which is the strongest practical argument for doing §3.2 first.

Pair with multivariate drift: **alibi-detect** (Apache-2.0, v0.13.0) for principled tests (MMD,
mixed-type tabular drift, classifier-based drift) or **Evidently** (Apache-2.0, v0.7.21) for PSI/KS with a
CI pass/fail gate. Both are strictly more informative than fixture-based drift guards — which test
*artifact-vs-inference agreement*, a different and equally necessary thing you should keep.

---

## 9. The visual evidence set

The artefact you shared is already better than most institutional model reports. What follows are the
additions that close specific blind spots, each with what it proves.

### 9.1 Add to the evaluation set

| Artefact | What it proves | Generate with |
|---|---|---|
| **PR curve + average precision**, no-skill line at prevalence | Honest discrimination under imbalance — replaces ROC-AUC as headline | `sklearn.metrics.PrecisionRecallDisplay` |
| **Score distribution overlay** (winners vs non-winners) | The most persuasive "does it know anything" chart, and the most honest about overlap — no threshold involved | matplotlib, 3 lines |
| **Separation plot** (Greenhill, Ward & Sacks, *AJPS* 2011) | Purpose-built for **rare binary events**: one sorted strip, actual events as ticks. Shows at a glance whether winners cluster at the high-score end. Designed for exactly your problem shape | ~20 lines matplotlib |
| **Cumulative gains chart** | "Skim the top X%, capture Y% of all winners" — the axis non-technical readers actually reason in | `scikit-plots` |
| **KS statistic plot** | Max separation between cumulative positive and negative capture — instantly legible to anyone from credit risk | `scikit-plots` / `scipy.stats.ks_2samp` |
| **Decile lift table** (n, winners, precision, lift, cumulative capture, CI per decile) | The citable numbers behind the charts; exposes non-monotone deciles the 3-cutoff chart hides | `great-tables` |
| **Target-rate-over-time line** (% of universe hitting +100%/12mo, by quarter) | Makes the base-rate trend a *labelled fact* rather than an artifact hidden inside per-quarter chance markers. Given the corpus-13.4% vs deployment-3% gap, this may be the single most important honesty chart you're missing | matplotlib |
| **Reliability diagram with per-bin n + CI bands** | Stops sparse upper bins from reading as precise | `sklearn.calibration` + your bootstrap |

### 9.2 Add to the comparison set (the gen-1/gen-2/gen-3 story)

| Artefact | What it proves | Notes |
|---|---|---|
| **Forest plot of paired deltas** — one row per metric, Δ with CI, vertical zero line | *The* chart for "is gen-N+1 actually better." Directly renders §2's paired test | The correct replacement for eyeballing two CIs |
| **Dumbbell plot per slice** — two dots (gen N-1, gen N) joined, one row per quarter/cap-tier | "Did it improve *everywhere*, or only on average" | Pairs with the per-quarter chart you have |
| **Bump chart of top-k rank across generations** | Pick churn — visible, intuitive, and it's the thing a user of the research queue actually experiences | **Annotate with the Jaccard overlap number** — a bump chart looks dramatic even when 15/20 names are unchanged |
| **Bland-Altman-style score-agreement plot** between generations | Whether generations diverge systematically at high scores vs low — i.e. whether the disagreement is where it matters | Adapted from clinical method comparison |
| **Grade/metric trajectory over cycles** | The registry as a picture — you already have the data in `model-metrics-history.jsonl` | Line chart per metric, annotated with corpus hash changes |

Explicitly **not** recommended: **critical-difference diagrams** (Demšar 2006) and **win-tie-loss
matrices**. Both are built for comparing many architecturally distinct models across many *independent*
datasets. One model lineage on overlapping, autocorrelated financial windows violates the independence
assumption, and using them would overstate significance.

### 9.3 Add to the failure set

| Artefact | What it proves |
|---|---|
| **Error-rate heatmap over feature pairs** (e.g. cap-tier × completeness, regime × theme) | Where precision collapses in 2D — hypotheses you didn't pre-choose |
| **Cohort error tree** (shallow tree fit on `is_error`) | The conjunctions that predict failure, in readable rule form. Render statically with `dtreeviz` |
| **Small-multiples grid: quarter × cap-tier** | You show these two cuts *separately*; the grid surfaces interaction failures each individually hides |
| **Calibration curve per subgroup** | Whether calibration holds only for the segment that dominates the corpus |
| **SliceLine top-5 discovered slices** (§5) | The discovered, not chosen, failure narrative |

### 9.4 Add to the explainability set — now and after the estimator upgrade

**Now (linear champion):** the learned-vs-hypothesised coefficient chart is already the right artefact,
and the five-domains-at-exactly-zero detail is a genuinely excellent honesty signal. Add a **correlation
heatmap + VIF table** — with 11 correlated features, VIF is what tells a reader whether an individual
coefficient is interpretable at all, and it's what will justify the PDP→ALE switch later.

**After the nonlinear upgrade (Stage 4):**

- **SHAP beeswarm** (global, with direction and spread), **SHAP bar** (mean |SHAP|), **dependence**, and
  **interaction** plots — the last of these is the payoff for going nonlinear and should be shown, since
  interactions are the stated reason for the upgrade.
- **ALE plots, not PDP.** Apley & Zhu (JRSS-B 2020): with correlated features, PDP evaluates the model on
  combinations that never occur (a $50M market cap with $2B daily volume), producing effect curves that are
  artifacts. ALE accumulates *local* differences within the observed conditional distribution. Your ten
  domain scores are correlated by construction, so this is not a subtle preference — PDP would be wrong
  here. Library: `PyALE` (MIT, simplest, has bootstrap CIs) or `alibi`'s ALE (Apache-2.0, more
  production-grade).
- **If EBM ships** (per the previous doc's recommendation): the **shape-function plots are the model**, not
  an approximation of it, with per-bin CIs from bagging. And they overlay directly onto your existing
  learned-vs-hypothesised chart — the same visual idea, one dimension richer. That continuity is a real
  argument for EBM.
- **Local:** SHAP **waterfall** (not force) for static reports — reads top-to-bottom, no JS. For the
  product UI: score positioned against the calibration curve ("a score like this has historically hit ~18%
  of the time"), top 5-6 drivers in plain language, explicit uncertainty. Never phrase attribution as
  causal — Kumar et al. (2020) show Shapley attributions are unstable under feature redundancy and are not
  causal estimates. "Contributed to the score under this model," never "caused."

---

## 10. Charts and numbers that mislead — including ones currently in use

- **ROC-AUC as a headline at a 13.4% base rate.** Currently the lead discrimination stat in the gen-2 card.
  Demote to secondary; lead with average precision. *(§3.1)*
- **Accuracy** — never report it here without prevalence printed adjacent. A model predicting "no" for
  everything scores 86.6%.
- **Two overlapping CIs read as "no difference."** The live error. *(§2)*
- **PDP under correlated features** — do not adopt it at Stage 4; go straight to ALE.
- **SHAP framed causally** — a category error, and a doctrine violation waiting to happen given `guardProse`.
- **Reliability diagrams with sparse bins and no n or CI** — looks most precise where it is least reliable.
- **Bump charts without a Jaccard number** — visually overstates churn.
- **Cross-corpus deltas presented as improvement** without a re-scored like-for-like baseline. *(§7.3)*
- **Critical-difference diagrams on non-independent time folds** — overstates significance. *(§9.2)*
- **Any generational delta without a paired test** — with 2,796 winners and a worst cohort at 0.20, an
  apparent improvement is very often noise.

---

## 11. Reporting standards — what to adopt, and what the report card is missing

**TRIPOD+AI** (Collins et al., *BMJ* 2024) is the current reporting checklist for clinical prediction
models — regression or ML — and it is the best-fitting external standard for what the report card already
is. Adopt it as a **review checklist**, not a process. Items you most likely don't yet satisfy:

| TRIPOD+AI item | What it asks | Lyra status |
|---|---|---|
| **12e** | Rationale for *why these* performance measures, given the decision context | Implicit. Worth one paragraph — you have unusually good reasons |
| **12d / 23b** | Performance **heterogeneity across clusters**, framed as a heterogeneity assessment | You have the breakdowns; frame them as the assessment |
| **12f** | Any **model updating / recalibration** arising from evaluation | The deployment-prevalence recalibration plan belongs here explicitly |
| **13** | How **class-imbalance handling affected calibration** | Directly relevant; document that you do *not* resample and why |
| **20c** | **Covariate-distribution comparison** between development and validation data | Missing — quantify the dev↔holdout shift, don't just report performance separately |
| **12g** | Reproducibility: how predictions are computed | Strong already (frozen artifact + drift guard) — say so under this heading |
| **14** | Subgroup discrimination assessment | Partly (cap tier, quarter); §5 completes it |

Also worth adopting, both cheap:

- **A Model Card per registered version** (Mitchell et al., FAT* 2019) — intended use, out-of-scope use,
  training data, evaluation data, **disaggregated metrics**, caveats. Your registry is already 80% of this;
  formalising the schema makes each version's card diffable against the last.
- **A datasheet for the corpus** (Gebru et al.) — forces the 13.4%-corpus-vs-3%-deployment prevalence gap,
  the survivorship censoring, and the curated-name quarantine to be stated as *dataset properties* rather
  than as caveats attached to results. Given how central those three facts are, they deserve their own
  document.

**PROBAST+AI** (2025) is the companion risk-of-bias tool — four domains (Participants, Predictors, Outcome,
Analysis) with signalling questions. Use as a periodic audit before a major generation ships, not every
cycle. Its Analysis domain is where your selection-bias gap (§6) will surface.

---

## 12. Tooling — versions, licences, and two warnings

| Tool | Version (Aug 2026) | Licence | Health | Use for |
|---|---|---|---|---|
| **`sliceline`** (DataDome) | 0.2.22 (Jun 2026) | **BSD-3** | ✅ Active | **Automated slice discovery — top priority adoption** |
| **`raiwidgets` / responsible-ai-toolbox** | current | **MIT** | ✅ Active (Microsoft) | Error Analysis cohort tree + heatmaps |
| **NannyML** | 0.13.x | **Apache-2.0** | ✅ Active | CBPE — performance estimation across the 12-month label gap |
| **alibi-detect** | 0.13.0 (Dec 2025) | **Apache-2.0** | ✅ Active (Seldon) | Principled multivariate drift (MMD, mixed-type tabular) |
| **Evidently** | 0.7.21 (Mar 2026) | **Apache-2.0** | ✅ Active | PSI/KS drift + CI pass/fail test suites |
| **`shap`** | 0.52.0 (May 2026) | MIT | ✅ Healthy | Post-Stage-4 explainability |
| **`interpret`** (EBM) | 0.7.8 (Mar 2026) | MIT | ✅ Active | Shape functions if EBM ships |
| **`PyALE`** / **`alibi`** ALE | 1.2.0 / current | MIT / Apache-2.0 | ⚠️ light / ✅ | ALE plots (not PDP) |
| **`dtreeviz`** | 2.3.2 (Jan 2026) | MIT | ✅ Active | Static cohort-error-tree rendering |
| **`scikit-plots`** | 0.4.x | MIT | ✅ Active | KS plot, cumulative gains (the original `scikit-plot` is dead) |
| **`great-tables`** | current | MIT | ✅ Active (Posit) | Decile table, report-card tables |
| **`dice-ml`** | current | MIT | ✅ Active | Counterfactuals, if a "what would change this" UI is wanted |
| **`missingno`** | 0.5.2 | MIT | ⚠️ Maintenance mode | Missingness matrix — relevant with 5 dark domains |
| **`correctR`** (R) / hand-rolled | — | — | — | Nadeau-Bengio corrected resampled t-test |
| **`baycomp`** | — | — | ⚠️ Research-grade | Bayesian generational comparison with ROPE |

**⚠️ Two warnings:**

1. **`deepchecks` is AGPL-v3.** It is the most complete off-the-shelf battery (its `train_test_validation`
   suite includes **train/test sample overlap, index leakage and date-leakage checks** — genuinely aligned
   with the leak class your ablations keep finding). Running it as a **dev/CI tool that never ships** is
   normally low-risk under AGPL, whose trigger is distribution/network-provision of the software itself —
   but it is a copyleft licence sitting next to a commercial product, so decide deliberately rather than by
   `pip install`. Evidently (Apache-2.0) covers the drift half cleanly; the leakage checks are the part
   worth the licence conversation.
2. **`giskard` v2 (tabular scan) is EOL.** v3 is a full rewrite for LLM red-teaming only. Do not build
   tabular validation on it.

Also note: **`yellowbrick` has had no release since Aug 2022** — usable but feature-frozen. **`PDPbox`** is
stale (Jun 2023); `sklearn.inspection` covers PDP/ICE natively and better.

---

## 13. Recommended sequence

Ordered by value ÷ effort. Items 1-4 are days, need no new data, and change what the numbers *mean*.

| # | Work | Where | Size |
|---|---|---|---|
| 1 | **Paired symbol-clustered bootstrap on Δ; promotion gate becomes `CI90(Δ) excludes 0`** | `compare` step | **S** |
| 2 | Calibration slope + intercept + Spiegelhalter z; state hierarchy level reached | `eval` step | S |
| 3 | Average precision as headline; ROC-AUC demoted | `eval` + report card | XS |
| 4 | Re-score gen-1's frozen artifact on gen-2's corpus → the first honest generational comparison | `compare` | S |
| 5 | Top-k Jaccard + rank correlation between generations → registry metric | `compare` + history | S |
| 6 | Log **every** attempt (not just promotions) to metrics history; report configs-tried count | `record` | S |
| 7 | `tests/behavioral/` — MFT fixtures, symbol-permutation INV, batch-invariance INV, DIR monotonicity sweep with a recorded exclusion list | new test dir | **M** |
| 8 | `sliceline` on every holdout; "worst discovered slice" as a registry metric | `eval` | M |
| 9 | Decile lift table + Jonckheere-Terpstra monotonicity test | `eval` | S |
| 10 | IC time series with HAC-adjusted t-stat + Information Ratio | `eval` | M |
| 11 | New charts: PR curve, separation plot, score-distribution overlay, cumulative gains, target-rate-over-time, forest plot of paired deltas, bump chart with Jaccard | report generator | M |
| 12 | TRIPOD+AI checklist pass over the report card; add corpus datasheet | docs | S |
| 13 | NannyML CBPE for the label-latency window | monitor | M |
| 14 | Selection-bias correction: Model Confidence Set over each cycle's candidates | `compare` | M |
| 15 | Error Analysis cohort tree + quarter×tier small multiples | report generator | M |
| 16 | At Stage 4 only: SHAP beeswarm/interaction, **ALE not PDP**, EBM shape functions | post-upgrade | M |

**Standing-rule additions suggested:**

- **#6** — the number of configurations evaluated in a cycle is reported with the cycle's headline.
- **#7** — no generational claim without either a paired test on shared rows or a re-scored like-for-like
  baseline; cross-corpus deltas are labelled confounded.
- **#8** — the behavioural suite is a blocking CI gate; a model that fails symbol-permutation invariance
  cannot be promoted regardless of its metrics.

---

## Sources

**Test suites + validation frameworks**
- [Deepchecks — model_evaluation suite docs](https://docs.deepchecks.com/stable/api/generated/deepchecks.tabular.suites.model_evaluation.html) · [Deepchecks JMLR paper](https://www.jmlr.org/papers/volume23/22-0281/22-0281.pdf) · [PyPI](https://pypi.org/project/deepchecks/)
- [Evidently](https://github.com/evidentlyai/evidently) · [NannyML](https://github.com/NannyML/NannyML) · [NannyML performance estimation (CBPE)](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html)
- [alibi-detect](https://github.com/SeldonIO/alibi-detect) · [Giskard OSS (v2 tabular EOL)](https://github.com/Giskard-AI/giskard-oss)
- [MLflow model evaluation + validation thresholds](https://mlflow.org/docs/latest/ml/evaluation/model-eval/)
- [Microsoft Responsible AI Toolbox — Error Analysis](https://github.com/microsoft/responsible-ai-toolbox/blob/main/docs/erroranalysis-dashboard-README.md) · [Azure ML error-analysis concept](https://learn.microsoft.com/en-us/azure/machine-learning/concept-error-analysis?view=azureml-api-2)
- [Fairlearn](https://github.com/fairlearn/fairlearn)

**Behavioural / invariance testing**
- [Ribeiro et al. — Beyond Accuracy: Behavioral Testing of NLP Models with CheckList (ACL 2020)](https://homes.cs.washington.edu/~marcotcr/acl20_checklist.pdf)
- [Kang et al. — Model Assertions for Monitoring and Improving ML Models (MLSys 2020)](https://people.eecs.berkeley.edu/~matei/papers/2020/mlsys_model_assertions.pdf)
- [Metamorphic Testing for Clinical ML Models (arXiv 2026)](https://arxiv.org/abs/2607.22984)

**Slice discovery**
- [SliceLine — SIGMOD 2021](https://dl.acm.org/doi/pdf/10.1145/3448016.3457323) · [sliceline (DataDome, BSD-3)](https://github.com/DataDome/sliceline)
- [Domino — Discovering Systematic Errors with Cross-Modal Embeddings (ICLR 2022)](https://arxiv.org/abs/2203.14960)
- [sliceguard](https://github.com/Renumics/sliceguard)

**Comparing model generations**
- [Nadeau & Bengio — Inference for the Generalization Error](http://papers.neurips.cc/paper/1661-inference-for-the-generalization-error.pdf) · [correctR](https://hendersontrent.github.io/correctR/)
- [DeLong's test — pROC roc.test](https://www.rdocumentation.org/packages/pROC/versions/1.19.0.1/topics/roc.test)
- [Hansen — A Test for Superior Predictive Ability](https://cdr.lib.unc.edu/downloads/zp38wf793)
- [Hansen, Lunde & Nason — The Model Confidence Set (Econometrica 2011)](https://www.econometricsociety.org/publications/econometrica/2011/03/01/model-confidence-set) · [Python impl](https://github.com/JLDC/model-confidence-set)
- [A modified Diebold–Mariano test with clustered dependence](https://www.sciencedirect.com/science/article/abs/pii/S0165176521003062)
- [Benavoli et al. — Time for a Change: Comparing Multiple Classifiers Through Bayesian Analysis (JMLR 2017)](http://www.jmlr.org/papers/v18/16-305.html) · [tutorial code](https://github.com/BayesianTestsML/tutorial)
- [Demšar 2006 — Statistical Comparisons of Classifiers over Multiple Data Sets (JMLR)](https://jmlr.org/papers/v7/demsar06a.html)

**Calibration**
- [Van Calster et al. — A calibration hierarchy for risk models](https://www.sciencedirect.com/science/article/abs/pii/S0895435615005818)
- [A tutorial on calibration measurements and calibration models (JAMIA)](https://academic.oup.com/jamia/article/27/4/621/5762806)
- [Spiegelhalter z-test — calzone docs](https://calzone-docs.readthedocs.io/en/latest/notebooks/spiegelhalter_z.html)
- [Niculescu-Mizil & Caruana — Predicting Good Probabilities with Supervised Learning](https://www.cs.cornell.edu/~alexn/papers/calibration.icml05.crc.rev3.pdf)
- [Evaluation of performance measures in predictive AI models (Lancet Digital Health 2025)](https://www.thelancet.com/journals/landig/article/PIIS2589-7500(25)00098-6/fulltext)

**Metrics + plots for rare events / ranking**
- [Saito & Rehmsmeier — PR plot more informative than ROC (PLOS ONE 2015)](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0118432)
- [Davis & Goadrich — Relationship between PR and ROC curves (ICML 2006)](https://ftp.cs.wisc.edu/machine-learning/shavlik-group/davis.icml06.pdf)
- [Greenhill, Ward & Sacks — The Separation Plot (AJPS 2011)](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-5907.2011.00525.x)
- [Information Coefficient as a Performance Measure of Stock Selection Models](https://arxiv.org/pdf/2010.08601)
- [scikit-learn calibration docs](https://scikit-learn.org/stable/modules/calibration.html)

**Explainability visuals**
- [Apley & Zhu — ALE plots (JRSS-B 2020)](https://www.researchgate.net/publication/342099478_Visualizing_the_effects_of_predictor_variables_in_black_box_supervised_learning_models) · [Molnar — ALE chapter](https://christophm.github.io/interpretable-ml-book/ale.html)
- [PyALE](https://github.com/DanaJomar/PyALE) · [alibi](https://github.com/SeldonIO/alibi) · [InterpretML/EBM](https://interpret.ml/docs/ebm.html)
- [SHAP beeswarm docs](https://shap.readthedocs.io/en/latest/generated/shap.plots.beeswarm.html) · [SHAP interaction values example](https://shap.readthedocs.io/en/latest/example_notebooks/tabular_examples/tree_based_models/Basic%20SHAP%20Interaction%20Value%20Example%20in%20XGBoost.html)
- [Kumar et al. — Problems with Shapley-value-based explanations](https://sorelle.friedler.net/papers/kumar2020problems.pdf)
- [DiCE counterfactuals](https://github.com/interpretml/DiCE) · [dtreeviz](https://github.com/parrt/dtreeviz) · [scikit-plots](https://github.com/scikit-plots/scikit-plots) · [great-tables](https://github.com/posit-dev/great-tables) · [missingno](https://github.com/ResidentMario/missingno)

**Reporting standards**
- [TRIPOD+AI expanded checklist (BMJ 2024)](https://www.tripod-statement.org/wp-content/uploads/2024/04/TRIPODAI-Supplement.pdf)
- [PROBAST+AI (2025)](https://pubmed.ncbi.nlm.nih.gov/40127903/)
- [Mitchell et al. — Model Cards for Model Reporting (FAT* 2019)](https://arxiv.org/abs/1810.03993)
- [Hugging Face Model Card Guidebook](https://huggingface.co/docs/hub/en/model-card-guidebook)
- [EU AI Act Annex IV — technical documentation](https://artificialintelligenceact.eu/annex/4/)
