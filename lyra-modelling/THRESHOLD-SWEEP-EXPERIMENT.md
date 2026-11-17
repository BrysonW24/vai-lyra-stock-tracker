# The threshold sweep — where does the model actually have skill?

> Research pass 4, 2026-08-01. Experiment design for the proposed UI slider
> (+10% / +20% / +30% / +50% / +100% / +200% / +300% within 12 months).
> Companions: [`MODEL-BUILD-TRAIN-HOST.md`](MODEL-BUILD-TRAIN-HOST.md) ·
> [`MODEL-SELECTION-AND-OSS-STACK.md`](MODEL-SELECTION-AND-OSS-STACK.md) ·
> [`../lyra-evals/EVAL-SUITE-SPEC.md`](../lyra-evals/EVAL-SUITE-SPEC.md)
>
> **The idea is good and the experiment is cheap** — `first_touch_barrier` is already parameterised, so
> the sweep is a re-label plus a re-run of the standing loop. It is exactly the kind of question the
> corpus was built to answer.
>
> **But there is a trap in it that would produce a beautiful, publishable, completely false result** —
> and the same trap may already be affecting the current +100% number. That comes first, because it
> changes what the experiment has to look like, and because one of its consequences is a baseline you
> should run this week regardless of whether the slider ever ships.

---

## 1. The trap: barrier-touching is mostly a volatility measurement

This is a mathematical property of the label, not a modelling opinion.

Model log-price as a diffusion. "Did the stock touch +X% at any point within 12 months" is the
**first-passage / running-maximum** problem, and by the reflection principle it has a closed form. For the
driftless case, with barrier `a = ln(1+X)` and annualised volatility σ:

```
P(touch +X% within 1 year)  =  2 · Φ( −a / σ )
```

The touch probability depends on the barrier **only through the ratio `a / (σ√T)`**, and it is **strictly
increasing in σ**. Volatility is not a nuisance term here — it is the dominant term.

What that means numerically for your exact label, +100% in 12 months, zero drift, zero skill:

| Annualised vol σ | P(touch +100% in 12mo) |
|---|---|
| 0.40 | **8.3%** |
| 0.60 | **24.8%** |
| 0.80 | **38.6%** |
| 1.20 | **56.3%** |

**Volatility alone moves the probability of doubling from 8% to 56% — a 6.8× spread — with no drift, no
information, and no skill of any kind.**

### 1.1 The consequence you need to act on immediately

Your corpus base rate is 13.4%. A model that did nothing but **sort on trailing realised volatility** and
take the top 5% would, on this arithmetic, be selecting names with touch probabilities in the tens of
percent. The implied lift is in the range of **3–4×**.

**Your champion's holdout lift is 1.94×.**

Real markets are not driftless GBM, vol is imperfectly persistent, and *trailing* σ is a noisy estimate of
*forward* σ — so the achievable lift from a real volatility sort is materially lower than the theoretical
figure. But the prior is alarming enough that this is no longer optional:

> **Run a trailing-realised-volatility-only model through the exact standing loop — same corpus, same
> purged walk-forward, same one-shot holdout, same clustered CIs — and report its lift next to the
> champion's.**

This is one feature, price data you already have, and an afternoon. It is the most important number in
this document. Three possible outcomes, all valuable:

- **Vol-only lift ≫ 1.94×** → the champion is being beaten by a single mechanical feature, and the current
  headline is largely a volatility measurement. Painful, but far better found now than after the slider
  ships.
- **Vol-only ≈ 1.94×** → the champion has no demonstrated edge over a null that contains zero information.
  Same conclusion, softer wording.
- **Vol-only ≪ 1.94×** → the structural hypothesis survives its hardest test to date, and the report card
  gets its strongest single piece of evidence. **This is the outcome that would let you raise the accuracy
  grade honestly.**

Right now the report card benchmarks against a **random** pick. Random is the wrong null. The right null is
*the cheapest mechanical model that could produce the same number*, and for a barrier label that is
volatility.

### 1.2 A specific, testable hypothesis about your gen-1 finding

From the report card:

> *"The two heaviest hand-designed bets — technical structure and comfortable liquidity — flip negative on
> real 12-month doublers."*

That was read as the hand-designed hypothesis being wrong. There is a second explanation that fits the same
data, and it follows directly from §1:

**"Comfortable liquidity" is inversely related to volatility.** Illiquid, thinly-traded micro-caps are
more volatile, and per the first-passage result they touch a +100% barrier far more often — with or without
any structural merit. A negative learned weight on liquidity is *exactly what a model would learn if it
were discovering σ through a proxy.* The same argument applies to parts of the technical domain.

So the learned coefficient chart — currently presented as "what real data taught the model" — may partly be
showing **"the model found the volatility channel."**

**The test is clean and cheap:** add trailing realised volatility as an explicit feature and refit.

- If the `liquidity` and `technical` weights **collapse toward zero** once σ is in the model, they were
  proxying volatility. That is a major, honest finding, and it belongs in the report card.
- If they **hold their magnitude** with σ present, they carry information beyond volatility, and the
  original interpretation is strengthened — now with a control, which is much stronger evidence than the
  uncontrolled version.

Either way you learn something real. This should run alongside §1.1.

### 1.3 Why this gets *worse* as the slider moves right

At large X the barrier is far out in the tail, so `a/(σ√T)` is large and the touch probability is dominated
almost entirely by σ. Drift and firm-specific signal matter proportionally less the further you push.

**So a naive absolute-% sweep will very likely produce a clean, monotone-rising skill curve — and that
curve will be mostly the volatility confound, growing.** It will look like the model gets *better* at
predicting bigger moves. It won't be true.

---

## 2. What the evidence predicts you'll find

Writing this down *before* the run, so the experiment is a test rather than a fishing trip — and so it can
falsify me.

**The literature's prior is that genuine skill peaks in the middle of the return distribution and decays
toward both tails:**

- The quantile-ML cross-sectional work finds explicitly that **"only the central quantiles are
  systematically priced, with the profitability of long-short portfolios declining as one moves towards the
  tails."**
- **Gu, Kelly & Xiu (RFS 2020)** — and this cuts against small-cap intuition — report out-of-sample R² of
  **0.52–0.70% for the largest 1,000 stocks vs ~0.40% for the full universe.** Their stated reason: "individual
  stock returns behave erratically for some of the smallest and least liquid stocks." Smaller and noisier is
  *harder* at the single-stock level, even though it's mechanically more likely to touch any barrier.
- **The MAX / lottery effect** (Bali, Cakici & Whitelaw, JFE 2011): the cohort most likely to hit a very
  large barrier *is* the high-MAX, high-idio-vol lottery cohort — which earns **−1.03%/month raw,
  −1.18%/month four-factor alpha** on a value-weighted top-minus-bottom sort. The population you'd fish in
  at +300% is, on average, the overpriced one, and within it everything looks alike on structural
  characteristics. What actually separates the winners there is binary event risk — buyouts, approvals,
  squeezes — which is close to unmodellable from fundamentals.

**Therefore the predictions to record now:**

1. The **raw absolute-% curve rises with X** and looks great. Artifact.
2. The **volatility-neutralised curve peaks at a moderate threshold** and decays toward both ends.
3. **The peak is probably below +100%** — plausibly the +30% to +50% region. Which would mean the current
   flagship label sits *past* the sweet spot.
4. At **+10%**, skill collapses toward zero because the label is dominated by "was it a bull year" plus
   beta — a market-direction question, not a stock-selection one.
5. At **+200%/+300%**, positives get so sparse that apparent skill is mostly sampling noise (§4.2).

**The gap between curve 1 and curve 2 is the volatility confound, quantified.** Publishing both curves
together is a stronger honesty artifact than either alone, and it is the natural successor to the
leakage-decomposition waterfall.

---

## 3. Fix the label before you sweep it: volatility-scaled barriers

This is the standard financial-ML answer and it exists precisely because of §1. López de Prado's
triple-barrier method sets barriers at **k × the name's own trailing volatility**, not at a fixed
percentage. The AFML labelling docs state the objection to fixed thresholds directly: observations are
labelled against a threshold *"regardless of their respective volatilities,"* so *"the expected returns of
every observation are treated equally regardless of the associated risk."*

**Run the sweep on both axes:**

| Axis | Sweep | Role |
|---|---|---|
| **Absolute** | +10 / +20 / +30 / +50 / +100 / +200 / +300% | What the UI slider says. Product-facing. Confounded. |
| **Vol-scaled** | k = 0.5 / 1 / 2 / 3 / 4 / 5 × trailing σ√T | The scientifically interpretable axis. Holds ex-ante touch probability roughly constant across the cross-section. |

Report both. The absolute axis is what the user manipulates; the vol-scaled axis is what tells you whether
there's anything there. And a third, cheap arm worth adding:

| Arm | Label |
|---|---|
| **Relative** | top-decile forward return within the scoring cohort (spec Decision B option 2) |

Academic cross-sectional work almost always uses rank/relative or excess-return labels rather than absolute
thresholds, for exactly the reason in §1 — a relative label removes market-direction and much of the
volatility confound by construction. Running it as a comparison arm costs one more re-label and tells you
how much of your signal survives cohort-relative framing.

---

## 4. The metric problem — lift cannot be compared across thresholds

### 4.1 Lift has a mechanical ceiling of 1 / base_rate

At a 50% base rate the maximum possible lift is **2.0×**. At 0.5% it is **200×**. Comparing raw lift across
your seven thresholds compares seven numbers with seven different ceilings — a 10× at +300% may represent
*less* captured skill than a 1.8× at +10%.

Minimum fix, if you keep lift: report **fraction of achievable lift captured**

```
normalised_lift = (observed_lift − 1) / (max_lift − 1),  where max_lift = min(1, base·N/k) / base
```

which puts every threshold on the same [0, 1] axis.

### 4.2 The warning that applies directly to +200% and +300%

Forecast verification (meteorology) has worked on rare-event skill scores for decades — rain, tornadoes,
hurricanes are exactly your base-rate-sweep problem, and they solved it better than ML has.

**Ferro & Stephenson (2010), "Equitability revisited: why the Equitable Threat Score is not equitable"**
showed that a **random forecaster's expected ETS is positive and depends on sample size and base rate**: at
a 2% base rate with n = 1,000, a forecaster with *zero skill* scores ≈ **0.20**, and the score only decays
below 0.01 once n > 25,000. At a 50% base rate, n ≈ 30 suffices.

**Read that against your corpus.** 27,420 rows, 6,165 in holdout. At a +300% threshold with a sub-1% base
rate, the holdout may contain a few dozen positives. Skill scores in that regime are substantially
manufactured by small-sample geometry. Any peak at the right-hand end of the slider must be assumed to be
an artifact until a permutation null says otherwise (§5).

### 4.3 The metrics to actually use

| Metric | Why | Role |
|---|---|---|
| **SEDI** (Symmetric Extremal Dependence Index) — Ferro & Stephenson 2011 | Purpose-built to stay **non-degenerate and asymptotically base-rate-invariant as the event rate → 0**. This is the one metric in the literature engineered for exactly your problem. `SEDI = [log F − log H + log(1−H) − log(1−F)] / [log F + log H + log(1−H) + log(1−F)]`, H = hit rate, F = false-alarm rate | **Headline the sweep on this** |
| **Resolution / Uncertainty** (Murphy decomposition of the Brier score: `BS = Reliability − Resolution + Uncertainty`) | `Uncertainty = p(1−p)` is pure base rate — the exact term that mechanically distorts everything else. Murphy makes it a *separable* term instead of a hidden confound, and **Resolution is precisely "how much information the score carries, net of calibration"** | Primary supporting — this is the cleanest formalisation of "genuine skill" |
| **Peirce Skill Score = Youden's J** (`TPR − FPR`) | A difference of two rates each computed *within* one class, so **exactly base-rate-free by construction**. 150-year pedigree | Simple sanity check |
| **H-measure** (Hand 2009) | Fixes AUC's proven **incoherence** — AUC implicitly weights misclassification cost using a distribution that differs *classifier by classifier*, so AUC values aren't measuring the same thing across models. H-measure uses a fixed cost distribution; its prevalence-conditional variant is explicitly designed for cross-prevalence comparison | ML-native companion |
| **Normalised lift** (§4.1) | Keeps continuity with your existing reporting | Bridge metric |

**Do not use across thresholds:** raw lift (§4.1); **Cohen's kappa** — the documented "kappa paradox" means
its chance-correction term is itself a function of base rate, so it will systematically penalise the rare
end even at equal discrimination; **MCC** as the tail-inclusive headline — the literature is genuinely
split (Chicco & Jurman 2020 for; Zhu 2020 shows it degrades under *severe* imbalance), so use it mid-sweep
only; **raw ROC-AUC** — prevalence-invariant in theory, flattering in practice under imbalance.

---

## 5. Multiple testing — seven nested labels

The labels are **nested by construction**: {hit +300%} ⊂ {hit +200%} ⊂ … ⊂ {hit +10%}. Picking the best of
seven inflates apparent skill, and this is the same selection-bias gap flagged in the eval-suite spec §6 —
now made concrete and unavoidable.

- **Bonferroni / Holm assume independence and will over-correct**, punishing you for tests that are almost
  the same test.
- **Westfall–Young maxT permutation** is the correct tool: permute labels to build the *joint* null
  distribution of the maximum skill statistic across all seven correlated thresholds. Proven asymptotically
  optimal under dependence.
- **Benjamini–Yekutieli** if you prefer FDR framing — it is the variant valid under *arbitrary* dependence.
- Port the **Deflated Sharpe** logic: deflate the reported peak by the expected maximum over the effective
  number of correlated trials.

**But the better answer is not to crown a winner at all.** Report the **whole skill-vs-threshold curve with
a permutation null band**. A slider is genuinely the right artifact for this — it forces the whole curve
into view instead of anchoring on a cherry-picked point — *provided the UI renders the uncertainty band and
the positive count at every position*, not just the point estimate.

---

## 6. Architecture: fit one distribution, not seven classifiers

Seven independent classifiers is the obvious implementation and the wrong one.

**Problems with seven models:** they can produce **logically impossible predictions** (P(+200%) > P(+100%)
for some name — guaranteed to happen and embarrassing in a UI); each re-estimates the same underlying
signal with its own noise; and at +300% there may not be enough positives to fit a stable model at all.

**Fit the conditional distribution once**, then read any threshold off it:

- Monotone by construction — the nesting is respected automatically.
- Statistically efficient — pools information across the whole training set instead of splitting it seven ways.
- **The slider becomes free**: `P(hit X) = 1 − CDF(X)` at any user-chosen X, continuous, not just your
  seven discretisation points. No retraining per position.
- The multiplicity problem shrinks — you fit once and *evaluate* at seven points, rather than searching
  over seven fitted estimators.

Candidates: **quantile regression forests** (Meinshausen 2006 — non-parametric, no tail assumption),
**NGBoost** (parametric conditional distribution), distributional GBMs (CatBoostLSS-style). Also worth
considering given the nesting: a **continuation-ratio ordinal model**, or **discrete-time hazard modelling
of time-to-first-touch**, which is what the label literally is.

### 6.1 The subtlety that will bite you

**"Hits +X% within 12 months" is a running-maximum event, not a terminal-return event.**

If you fit the distribution of the **12-month terminal return** and read off `P(return > X)`, you will
**systematically underestimate** touch probabilities — many paths touch +30% intra-year and finish below
it. The two are different objects, and the gap widens as X grows.

**Model the distribution of the running maximum** (the max forward return over the window), which is
exactly what first-touch measures. Then the threshold read-off is correct by construction.

Whichever route: **validate the tail quantiles directly** (pinball / quantile loss at the 90th, 95th, 99th,
99.5th percentiles) rather than trusting a parametric family to extrapolate. Tail misspecification is the
main failure mode of the distributional approach, and it fails silently while overall likelihood looks fine.

---

## 7. The statistical sweet spot is not the product sweet spot

Precision is **payoff-blind**. It counts hits, never magnitudes. A 5% chance of +300% is worth far more
than a 40% chance of +10%, and precision ranks them the other way round.

So the slider's "best position" should be chosen on **economics**, not classification skill:

- **Return distribution of the top-k basket vs a random basket**, per slider position — plotted as overlaid
  violins or box plots, not collapsed to a mean. With heavy right skew, a mean hides everything that
  matters.
- **Expected value / expected log-return** of the selected basket, versus the random baseline.
- **Kelly-optimal fraction** implied by (win probability, conditional payoff distribution) at each position.
  A threshold with high precision but tiny edge has Kelly ≈ 0 — statistically skilful, economically
  worthless. A threshold with modest precision but explosive payoff can be the opposite.

**Expect the two curves to peak in different places, and show both.** "The model is most *skilful* at +30%
but most *useful* at +100%" is a genuinely interesting, honest finding — and it is exactly the kind of
nuance the report card's existing tone handles well.

Doctrine note: none of this changes the research-only framing. EV of a basket is an engine-owned
diagnostic for choosing a default slider position and for the evidence surface — it is not a
recommendation, a position size, or a return forecast shown to a user.

---

## 8. The 2010 question — what history is honestly available

Short answer: **fundamentals-based history starts around 2011–2012, not 2010.**

The SEC's XBRL mandate was phased in by filer size (Release 33-9002):

| Filer class | Mandatory from fiscal periods ending on/after |
|---|---|
| Large accelerated filers, float > $5B (US GAAP) | **15 June 2009** |
| All other large accelerated filers | **15 June 2010** |
| **All remaining filers — incl. smaller reporting companies** | **15 June 2011** |

The **Financial Statement Data Sets** run from **2009 Q1**, but small-filer coverage inside 2009–mid-2011 is
sparse and large-cap-skewed. A small-cap fundamentals corpus claiming full coverage back to 2010 would be
**voluntarily-early-filer-biased** — a survivorship-flavoured selection effect layered on the one you
already have.

**Practical guidance:**

- **~2012 → present** is honest for a fundamentals-bearing corpus (a year of buffer past the phase-in).
- **Pre-2011** is price/technical/regime only — which is still useful, because the volatility-neutralised
  arm and the relative-label arm of this sweep need *only* prices. Running the sweep on a long
  price-only corpus back to ~2005 would give far more positives at +200%/+300% and directly attack the
  §4.2 power problem.
- Extending back adds 2011–2015: a genuinely different regime (ZIRP, pre-AI-capex), which **helps**
  regime-robustness testing and **hurts** stationarity. Both effects are informative; the per-quarter
  chart already surfaces them.
- Sanity anchors for base rates: **Bessembinder** — only **4.3%** of US stocks (1,092 of 25,967) accounted
  for all net wealth creation above T-bills 1926–2016; **57.4%** underperformed T-bills over their life;
  delisted names had a **median lifetime return of −92%**; decade-long positive-return rate was **42.4% for
  small caps vs 81.3% for large caps.** If your +200%/+300% base rates come out far above what that skew
  implies, look for survivorship before celebrating.

---

## 9. What the slider should actually show

Not a single number. Every position should carry:

| Element | Why |
|---|---|
| **SEDI (or Resolution/Uncertainty) with a permutation null band** | The skill claim, with its uncertainty — §4.3, §5 |
| **Number of positives in the holdout at this threshold** | The §4.2 warning made visible. At +300% this may be a few dozen, and the user should see that |
| **Base rate at this threshold** | Makes the "lift ceiling" effect legible instead of hidden |
| **Vol-neutralised skill alongside absolute skill** | The confound, quantified, on the face of the product — §3 |
| **Top-k basket return distribution vs random** | The economic answer, which may disagree with the statistical one — §7 |
| **A greyed-out / warned zone** where the null band contains zero | Positions where the model has no demonstrated skill should *say so*, not render a number |

That last row is the one that makes this a Lyra feature rather than a generic screener. A slider that
honestly greys out its own extremes is a stronger trust signal than one that shows a confident number
everywhere — and it is the same instinct as the shadow-live gate.

---

## 10. The protocol

Pre-register predictions (§2) before running. Then:

| # | Step | Notes |
|---|---|---|
| 0 | **Volatility-only baseline through the full standing loop** | §1.1. Do this first, independent of the sweep. Highest-value single run available right now |
| 0b | **Refit the champion with trailing σ as an explicit feature** | §1.2. Tests whether `liquidity`/`technical` were vol proxies |
| 1 | Re-label the corpus at all 7 absolute thresholds | `first_touch_barrier` is already parameterised. Record base rate and positive count at each |
| 2 | Re-label at 6 vol-scaled thresholds (k × trailing σ√T) | The interpretable axis — §3 |
| 3 | Add the relative-label arm (top-decile-in-cohort) | §3, spec Decision B option 2 |
| 4 | Run the standing loop unchanged on every arm | Purged WF on dev; **holdout stays untouched until the end** |
| 5 | Compute SEDI, Resolution/Uncertainty, Peirce J, H-measure, normalised lift at every position | §4.3 |
| 6 | **Westfall–Young permutation null** across the sweep | §5. Gives the band, not just the point |
| 7 | Top-k basket return distribution + EV + Kelly fraction per position | §7 |
| 8 | Score the holdout **once**, at the end, at every threshold as a single frozen decision | Standing rule 3. Sweeping *is* iteration — treat the whole sweep as one experiment, or cut a new holdout |
| 9 | Only then: consider the distributional refit (§6) as the production architecture | The sweep tells you whether the slider is worth building at all |

**Suggested standing rule #9:** *no barrier-label result is reported without its volatility-only baseline
alongside.* Random is not the right null for a barrier-touch label — volatility is.

---

## 11. What this is really worth

Three outcomes, in descending order of how much they'd change the roadmap:

1. **The vol-only baseline beats or matches the champion.** The current 1.94× is substantially a volatility
   measurement, and the structural thesis is unproven. Hard, but it is exactly the finding your process was
   built to surface, and finding it before the slider ships is the whole point of having the process.
2. **The champion clears the vol baseline, and the neutralised curve peaks below +100%.** The engine has
   real structural signal *and* you've been measuring it at the wrong threshold. The slider becomes a
   genuine product feature, and the flagship label should move.
3. **The champion clears the baseline and +100% is near the peak.** The current design is vindicated
   against its hardest null, and the report card gains its strongest evidence to date.

All three are worth having. Only the first is unpleasant, and it is the one most likely to be true given
the arithmetic in §1 — which is the best possible reason to run it first.

---

## Sources

**First-passage / barrier mechanics**
- [MIT 18.642 — first hitting times, Brownian motion](https://ocw.mit.edu/courses/18-642-topics-in-mathematics-with-applications-in-finance-fall-2024/mit18_642_f24_lec14_7.pdf)
- [Reflection principle and the maximum of Brownian motion](https://almostsuremath.com/2023/04/18/the-maximum-of-brownian-motion-and-the-reflection-principle/)
- [Triple-barrier labelling — mlfinpy docs (volatility-scaled barriers)](https://mlfinpy.readthedocs.io/en/latest/Labelling.html)

**Where predictability lives in the return distribution**
- [Quantile Machine Learning and the Cross-Section of Stock Returns (SSRN 4491887)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4491887) · [arXiv](https://arxiv.org/html/2408.07497v2)
- [Chen, Dolado & Gonzalo — Quantile Factor Models (Econometrica 2021)](https://www.econometricsociety.org/publications/econometrica/2021/03/01/quantile-factor-models)
- [Gu, Kelly & Xiu — Empirical Asset Pricing via Machine Learning (RFS 2020)](https://academic.oup.com/rfs/article/33/5/2223/5758276) · [PDF](https://dachxiu.chicagobooth.edu/download/ML.pdf)
- [Chen, Pelger & Zhu — Deep Learning in Asset Pricing](https://arxiv.org/abs/1904.00745)
- [Bali, Cakici & Whitelaw — Maxing Out: Stocks as Lotteries (NBER w14804)](https://www.nber.org/system/files/working_papers/w14804/w14804.pdf)
- [Ang, Hodrick, Xing & Zhang — The Cross-Section of Volatility and Expected Returns](https://www.nber.org/system/files/working_papers/w10852/w10852.pdf)
- [Low-volatility anomaly](https://en.wikipedia.org/wiki/Low-volatility_anomaly)

**Metrics comparable across base rates**
- [Ferro & Stephenson 2011 — Extremal Dependence Indices (SEDI), *Weather and Forecasting*](https://journals.ametsoc.org/view/journals/wefo/26/5/waf-d-10-05030_1.xml)
- [Ferro & Stephenson 2010 — Equitability revisited: why the ETS is not equitable (PDF)](http://www.met.reading.ac.uk/~swrhgnrj/publications/ets_is_not_equitable.pdf)
- [MET verification appendix — SEDI / EDI / Peirce / Heidke formulas](https://metplus.readthedocs.io/projects/met/en/latest/Users_Guide/appendixC.html)
- [Hand 2009 — Measuring Classifier Performance: A Coherent Alternative to AUC](https://link.springer.com/article/10.1007/s10994-009-5119-5) · [notes on the H-measure](https://arxiv.org/pdf/2106.11888)
- [Stephenson et al. — Two Extra Components in the Brier Score Decomposition (PDF)](https://empslocal.ex.ac.uk/people/staff/dbs202/publications/2008/stephenson-brier.pdf)
- [Youden's J statistic](https://en.wikipedia.org/wiki/Youden%27s_J_statistic)
- [Chicco & Jurman 2020 — advantages of MCC](https://link.springer.com/article/10.1186/s12864-019-6413-7) · [Zhu 2020 — MCC under severe imbalance](https://www.sciencedirect.com/science/article/abs/pii/S016786552030115X)
- [The paradox of Cohen's kappa](https://www.researchgate.net/publication/320899673_High_Agreement_and_High_Prevalence_The_Paradox_of_Cohen's_Kappa)

**Multiple testing across correlated thresholds**
- [Westfall–Young permutation procedure — asymptotic optimality under dependence](https://arxiv.org/abs/1106.2068)
- [Benjamini & Yekutieli 2001 — FDR under dependency](https://projecteuclid.org/journals/annals-of-statistics/volume-29/issue-4/The-control-of-the-false-discovery-rate-in-multiple-testing/10.1214/aos/1013699998.full)
- [Bailey & López de Prado — The Deflated Sharpe Ratio](https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf)
- [Spurious Predictability in Financial Machine Learning (effective number of tests)](https://arxiv.org/html/2604.15531)

**Distributional / nested-label architecture**
- [Meinshausen 2006 — Quantile Regression Forests (JMLR)](https://www.jmlr.org/papers/volume7/meinshausen06a/meinshausen06a.pdf)
- [Duan et al. 2020 — NGBoost (ICML)](https://proceedings.mlr.press/v119/duan20a/duan20a.pdf)
- [CatBoostLSS — distributional boosting](https://arxiv.org/pdf/2001.02121)
- [Continuation-ratio ordinal models](https://www.lexjansen.com/nesug/nesug00/ps/ps7015.pdf) · [Harrell — ordinal regression resources](https://www.fharrell.com/post/rpo/)
- [Discrete-time proportional hazards](https://en.wikipedia.org/wiki/Discrete-time_proportional_hazards)

**Decision-theoretic framing**
- [Kelly & Ziemba — Using the Kelly Criterion for Investing (PDF)](https://webhomes.maths.ed.ac.uk/mckinnon/blackouts/StochOptFinanceAndEnergySpringer/Chap1_KellyZiemba.pdf)
- [Kelly criterion](https://en.wikipedia.org/wiki/Kelly_criterion)

**Data availability**
- [SEC XBRL phase-in — Release 33-9002 (Cooley summary)](https://www.cooley.com/news/insight/2009/sec-posts-mandatory-xbrl-release) · [Husch Blackwell](https://www.huschblackwell.com/newsandinsights/mandatory-interactive-data-reporting-xbrl-arrives-02-23-2009)
- [SEC Financial Statement Data Sets](https://www.sec.gov/data-research/sec-markets-data/financial-statement-data-sets) · [documentation](https://www.sec.gov/files/aqfs.pdf)
- [Bessembinder — Do Stocks Outperform Treasury Bills?](https://www.sciencedirect.com/science/article/abs/pii/S0304405X18301521)
- [Crittenden & Wilcox — The Capitalism Distribution](https://mebfaber.com/2008/12/02/the-capitalism-distribution-fat-tails-in-action/)
