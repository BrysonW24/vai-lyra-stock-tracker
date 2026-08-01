# Model selection + open-source stack — what to trust, what to build on

> Research pass 2, 2026-07-31. Companion to [`MODEL-BUILD-TRAIN-HOST.md`](MODEL-BUILD-TRAIN-HOST.md).
> Question asked: *which model choices are most likely to predict correctly, which can I trust, and where
> are the open-source versions I can build off and tune?*
>
> Three web-research passes: (1) the empirical evidence on what actually predicts cross-sectional equity
> returns, (2) the open-source estimator/calibration/explainability stack with licences and maintenance
> health, (3) the open-source data-pipeline layer. Plus a check of
> `Vivacity.ai/vd-open-source-repos/open-source-repo-registry.json` per house rules — **it contains nothing
> in this domain** (only analytics tools: plausible / posthog / umami / GA-MCP). Recommend adding the
> repos below as registry rows once picked.

---

## 0. Two things in the previous doc that this research changes

Stated up front because they're reversals, not refinements.

1. **The champion should probably not be a GBDT.** I recommended LightGBM + TreeSHAP. The stronger 2026
   answer for *your* constraints is an **Explainable Boosting Machine (EBM, InterpretML)** — a glass-box
   additive model whose explanation *is* the model rather than a post-hoc approximation of it. §4.
2. **The label should migrate from Decision B option 1 to option 4.** The spec left this open ("if
   pump-and-dump noise proves severe"). The evidence says it will, and says so before you've collected a
   single row. §3.1.

Everything else in the previous doc stands, and the §3 code-gap list is unaffected.

---

## 1. What accuracy is actually achievable — the trust question, answered with numbers

This is the section that matters most, because "which model predicts best" is close to meaningless without
knowing what "best" looks like in this domain. The honest numbers are **much smaller than intuition
suggests**, and knowing them is the difference between recognising a real edge and shipping a bug.

**The canonical benchmark — Gu, Kelly & Xiu, "Empirical Asset Pricing via Machine Learning" (RFS 2020).**
This is *the* paper everyone cites as the ML-beats-linear success story. Its actual monthly out-of-sample
R² at the individual-stock level:

| Model | Monthly OOS R² |
|---|---|
| OLS, all variables | **−3.46%** (worse than predicting zero) |
| Elastic Net | 0.11% |
| OLS-3 (size/BM/momentum) | 0.16% |
| GLM | 0.19% |
| PCR / PLS | 0.26% / 0.27% |
| Random Forest | 0.33% |
| **Gradient boosted trees** | **0.34%** |
| **Neural net (3 layer)** | **0.40%** ← the best number in the paper |

**0.40%.** With CRSP/Compustat-grade data, decades of history, and no transaction costs. That is the
ceiling reported by the most-cited paper in the field. Two further calibration points:

- **Robeco (2025), small-cap ML in production**: 51–52% stock-level directional accuracy against a 50%
  coin-flip baseline. That is what a real, honestly-reported, institutionally-resourced small-cap edge
  looks like — barely above a coin flip at the stock level, while still being useful in aggregate.
- Gu/Kelly/Xiu's portfolio-level Sharpe looks far better (1.35 value-weighted, 2.45 equal-weighted) — but
  see §1.2 on why the equal-weighted number is the one to distrust, and it's the one closest to Lyra's
  universe.

**Which model families won:** trees and shallow neural nets modestly beat linear, and the gap is small in
absolute terms (0.34 vs 0.19). The dominant predictors were **price trend** (momentum, industry momentum,
short-term reversal), then **liquidity** (market value, dollar volume, spread), then **volatility/beta**.
Fundamentals-heavy value features were *not* the top drivers. That is worth sitting with, given Lyra's
scorecard is 70% fundamental/structural by weight.

### 1.1 Your honest target, and it happens to match your existing gate

Given a 2–4% base rate, a credible strong result is **precision@20-per-quarter in the 6–10% range — roughly
2–3× lift** — sustained across multiple non-overlapping years and regimes.

**`monitor.py::_verdict` currently gates on `lift >= 2.0 AND ece <= 0.1`. That threshold is exactly right
and is now evidence-backed.** You picked it by taste; the literature agrees. Don't raise it.

Note the corollary: the bootstrap run reports **4.85× lift**. On synthetic data that's fine (it's recovering
a known DGP). If you ever see 4.85× on *real* data, §2 says treat it as a bug until proven otherwise.

### 1.2 The microcap trap — this is your exact universe

**Hou, Xue & Zhang, "Replicating Anomalies" (RFS 2020)** replicated 447 published anomalies: **286 (64%)
fail to replicate** at 5% significance using NYSE breakpoints and value-weighted returns; **380 (85%) fail**
at Harvey-Liu-Zhu's multiple-testing-adjusted t > 3.0 bar. Their diagnosis is the important part:

> Microcaps are ~3% of total market cap but ~60% of the *number* of listed stocks. Equal-weighted
> portfolios therefore mechanically overweight them, inflating reported anomaly returns
> (1.32%/mo equal-weighted vs 0.93%/mo value-weighted).

**The statistical artifact that makes published anomalies look strong is concentrated in precisely the
universe Lyra targets.** This isn't a reason not to build — it's a reason your validation has to be harsher
than a large-cap builder's, not softer.

Counterweight, because this is a live dispute rather than a settled fact: **Jensen, Kelly & Pedersen (JF
2023)** re-ran the question under an empirical-Bayes multiple-testing framework across 153 factors and 93
countries and got an **84.9% replication rate** (vs Hou-Xue-Zhang's ~36%), explicitly arguing the
size/liquidity criticisms are "largely groundless" and reporting **71.4% replication even for nano-cap-only
factors**. The disagreement is about statistical framework, not about whether microcap effects exist. Treat
the true replication rate as a range, and treat any single anomaly you lift from a paper as needing your own
out-of-sample confirmation.

Two more decay factors to price in before you trust any signal:

- **McLean & Pontiff (JF 2016)**: anomaly returns fall **~26%** purely out-of-sample after the original
  study window (garden-variety overfitting that was never real), and a further **~58%** post-publication
  (investors trading it away). A signal from a paper published 3+ years ago should be discounted heavily
  before you believe it live.
- **Novy-Marx & Velikov (RFS 2016)**: after realistic bid-ask and price-impact costs, most anomaly alpha
  collapses — **worst precisely in the small/illiquid names where gross alpha looked biggest**.

---

## 2. Numbers that should make you suspicious of your own pipeline

Pin these somewhere the nightly can assert against them. Each is a "stop and look for the leak" trigger:

| Signal | Threshold | Why |
|---|---|---|
| Precision@20 per quarter | **> ~25–30%** on a true 2–4% base rate | 6–10×+ lift on a 12-month extreme-tail target is not plausible without leakage |
| Individual-stock OOS R² | **> ~1%** | Best published academic number is 0.40% |
| Backtest Sharpe, equal-weighted microcap long-short | **> ~2** without costs | The exact signature Hou-Xue-Zhang identify as an equal-weighting artifact |
| Validation → test degradation | **≈ zero** | Real small-cap signals are regime-dependent. Suspicious stability = the split isn't truly time-separated |
| Stability across 2021 / 2022 / 2023-24 regimes | **too stable** | Same as above — those were radically different regimes |
| Single feature importance | **> 30–40%** | Not automatically wrong, but check it isn't encoding forward information (e.g. a momentum window overlapping the label window) |

That last one has a live precedent worth knowing: a 2026 preprint on microcap insider-purchase prediction
found "distance from 52-week high" carrying **36% of feature importance** — plausible, but exactly the shape
of a feature that can leak if the window overlaps the label. Lyra's domain 1 (technical structure) contains
several features of this type.

---

## 3. Three design implications this evidence forces

### 3.1 Migrate the label to Decision B option 4 — now, not later

The spec says migrate from option 1 (`+100% in 12mo`) to option 4 (`+100% AND still listed AND liquidity
grew`) "if survivorship / pump-and-dump noise proves severe in the data." The evidence says it will be,
and names the mechanism:

**Bali, Cakici & Whitelaw, "Maxing Out: Stocks as Lotteries" (JFE 2011)** — stocks with high recent
maximum daily returns (the MAX factor, a proxy for lottery/skewness demand) **subsequently underperform**.
Investors systematically overpay for convex payoff profiles. This is well replicated. Applied to Lyra: a
naive `+100% first-touch` label will happily reward pump-and-dumps and dead-cat spikes — the exact
population the MAX literature says is *negatively* priced going forward. Option 4's survival + liquidity
conjuncts filter precisely that population out.

`label_from_barrier` is a one-line seam, as the spec promised. Use it. Doing this **before** the dataset
exists costs nothing; doing it after means relabelling and retraining.

### 3.2 The MAX effect actually validates Lyra's whole design — say so

The corollary of MAX is genuinely encouraging for you: if the market already misprices *visible*
lottery-like characteristics in the wrong direction for chasers, then the tractable edge lives in names
that **don't yet look like lottery tickets** — identifiable via fundamentals, capital structure, sponsorship
and catalysts *before* the market re-rates them.

That is a one-sentence restatement of the emerging-winner thesis, arrived at independently from the
academic literature. It is also an argument for **down-weighting** domain 1 (technical structure) and
domain 2 (accumulation) relative to the structural domains in the archetype model — the opposite of what
Gu/Kelly/Xiu found for *mean* return prediction, because you are predicting a different thing. Worth an
explicit note in `DOMAIN_WEIGHTS`' provenance: technical is currently weighted 12.0 (joint-second), and the
evidence suggests it should be a *timing* input (Model A's job), not an archetype input.

### 3.3 Your best-evidenced domain is domain 6, and it works as a filter

Of the ten domains, exactly one maps to an anomaly that survives Hou-Xue-Zhang-grade scrutiny *and*
international replication:

**Net share issuance / dilution** (Pontiff & Woodgate, JF 2008) — firms that issue equity subsequently
underperform; firms that repurchase outperform. Among the most robust cross-sectional predictors known.
That is **domain 6 (capital / survivability)**, and it is a **negative** predictor — meaning its highest-value
use is as a *risk gate* (Gate 1, `risk_gates.py`), not as a scoring input.

Evidence grade for the rest, honestly:

| Domain | Signal | Evidence grade |
|---|---|---|
| 6 Capital / survivability | Net share issuance, dilution, shelf registrations | **Strong** — replicated, international, survives value-weighting |
| 5 Business quality | R&D intensity | **Moderate** — Chan/Lakonishok/Sougiannis (JF 2001), weaker outside US, risk-vs-mispricing still debated |
| 9 Sponsorship | Insider (Form 4) buying | **Moderate, fast-decaying** — real abnormal returns after open-market cluster buys, but alpha decays in days-to-weeks due to filing lag |
| 9 Sponsorship | 13F institutional changes | **Weak-moderate** — 45-day filing lag guts freshness; weakest exactly where coverage is sparse, i.e. microcaps |
| 3 Liquidity | Short interest | **Moderate but crowded** — noisier and harder to source in microcaps |
| 1, 2 Technical / accumulation | Momentum, volume | **Strong for mean returns** (top GKX predictors) — but see §3.2, likely the wrong tool for the archetype question |
| 7 Government / policy | Contract awards | **Under-evidenced** — event studies exist in specific sectors; no broad replicated cross-sectional factor. Plausible catalyst, not an established anomaly |
| 4, 8, 10 Theme / adoption / narrative | — | **No cross-sectional asset-pricing evidence.** These are Lyra's genuine bet — which is fine, but should be labelled as a hypothesis under test, not as established signal |

`DOMAIN_WEIGHTS` currently gives `theme` the single highest weight (16.0) — the domain with the least
external evidence. That's a defensible bet on differentiation, but it should be a *stated* bet with the
evidence grade written next to it, so a future reader doesn't mistake it for a researched prior.

---

## 4. The model choice — and the case for EBM over GBDT

### 4.1 The surprise contender

**Explainable Boosting Machine (EBM)**, from Microsoft's `interpret` / InterpretML — MIT licensed, v0.7.8
(Mar 2026), 6.9k stars, actively maintained. It's a **glass-box generalised additive model with pairwise
interactions (GA2M)**, boosted feature-by-feature.

InterpretML's own benchmarks put EBM AUROC at parity with or above XGBoost on standard tabular tasks
(Adult Income .928 vs .927; Heart Disease .898 vs .851). Those aren't rare-event finance datasets, so treat
them as "in the same class," not "better." What makes EBM the right *shape* for Lyra is four things that
have nothing to do with a leaderboard:

1. **The explanation is the model, not an approximation of it.** An EBM is literally a set of per-feature
   shape functions (score contribution as a function of the domain score) plus a small set of pairwise
   interaction surfaces. There is no post-hoc approximation step, so there is no SHAP-under-correlated-features
   problem — which the previous doc flagged as a real risk given your ten domains are correlated by
   construction. Your "why it resembles past winners" panel becomes an exact readout rather than an estimate.
2. **It fits your doctrine better than anything else.** "Engine owns every number" and `guardProse`'s
   rejection of any figure not in the engine facts are much easier to honour when the model's contribution
   to a card is a table lookup you can print, audit, and diff in a PR.
3. **It is trivially portable — easier than a GBDT.** An EBM freezes to bin edges + per-bin scores. A
   stdlib Python scorer and a TypeScript mirror are each ~30 lines of lookup, with no tree recursion and
   **no split-boundary branch-flip class of parity bug** (the failure mode §5.4 of the previous doc warned
   about for tree ensembles). Your frozen-JSON + drift-fixture contract gets *simpler*, not harder.
4. **Shape functions are auditable and editable by you.** If the model learns that dilution is *good*, you
   can see it as a monotone violation on one chart and constrain it — rather than inferring it from a SHAP
   summary plot.

The genuine caveat: EBM is additive plus *pairwise* interactions. Lyra's hypothesis includes interaction
effects ("theme only matters *with* a government contract"), which GA2M covers, but higher-order
interactions it cannot represent. With ten features, a 2-4% base rate and a few years of history, you
almost certainly cannot estimate higher-order interactions reliably anyway — so this is a constraint that
matches the data, not a limitation you'll feel.

### 4.2 The bake-off, and how to decide it

Don't pick from a table. Run three and decide on your own metric:

| Entrant | Role | Library |
|---|---|---|
| **EBM** | Champion candidate — glass-box, doctrine-fit, trivial export | `interpret` 0.7.8, MIT |
| **LightGBM + TreeSHAP (interventional)** | Challenger — the deck's plan, best raw tabular baseline | `lightgbm` 4.7.0, MIT · `shap` 0.52.0, MIT |
| **AutoGluon `best_quality`** | Ceiling-setter, not a candidate — tells you the best achievable score on this dataset so you know whether hand-tuning has headroom | `autogluon` 1.5.0, Apache-2.0 |

**Decide on: median and worst-quarter precision@20, then adaptive ECE.** Not AUC. If EBM is within noise of
LightGBM — which the tabular literature suggests is likely at ten features — **ship EBM**, because the
doctrine fit and the export simplicity are worth more than a fractional metric difference you cannot
distinguish from luck at this sample size.

Keep LightGBM registered as the challenger for the archetype (Model 3) and ranker (Model 4) slots, where
categorical structure is real and glass-box explanation matters less.

### 4.3 On tabular foundation models

Worth one pilot, not worth betting on, and the licensing needs care — see §6. TabPFN's in-context learning
(no training loop) is genuinely well-suited to tiny-N rare-event data where GBDTs struggle to find stable
splits. Use **TabPFN v2 / 2.6** (commercial-use-permitted tier) or **TabICL** (BSD-3, clean) as an ensemble
member or sanity second opinion. Do not make one the arbiter — the 2026 uncertainty benchmarking still
shows tabular foundation models more overconfident than GBDT under noise, and calibration is your product.

### 4.4 On the ordinal head

Previous doc recommended a rank-consistent ordinal decomposition. Refinement after checking what actually
exists: **`OGBoost` is real, on PyPI, MIT, actively released (v0.8.3, 27 Jul 2026) — and has 0 GitHub stars
and 4 commits.** A single-author research package. Usable, but you would be its QA team. `coral-pytorch`
(last release 2022), `mord` and `spacecutter` are all dormant. The only well-maintained option is
statsmodels' `OrderedModel`, which is classical MLE with no missing-value handling.

**Revised recommendation:** don't take a dependency. Implement the 3-cumulative-threshold decomposition
directly (`P(stage>0)`, `P(stage>1)`, `P(stage>2)` as three EBMs or three LightGBMs, differences give the
class probabilities). It's ~40 lines, keeps the export format under your control, and avoids a
zero-adoption dependency in a load-bearing position.

---

## 5. The pinned open-source stack

Everything below verified live this session: version, licence, maintenance status.

### Model + inference

| Library | Version | Licence | Stars | Health | Role |
|---|---|---|---|---|---|
| **interpret (EBM)** | 0.7.8 (Mar 2026) | MIT | 6.9k | ✅ Active | **Champion candidate** |
| **LightGBM** | 4.7.0 (Jul 2026) | MIT | 18.6k | ✅ Active — note repo moved `microsoft/` → `lightgbm-org/`, now community-governed | Challenger |
| CatBoost | 1.2.10 (Feb 2026) | Apache-2.0 | ~9k | ✅ Active | Archetype/ranker slot (native categoricals) |
| XGBoost | 3.3.0 (Jun 2026) | Apache-2.0 | 28.5k | ✅ Active — **PyPI wheel now needs Python 3.12+** | Fallback |
| **shap** | 0.52.0 (May 2026) | MIT | 25.6k | ✅ Healthy again (the 2021-23 maintainer gap is over) | Explain the GBDT challenger |
| **AutoGluon** | 1.5.0 (Dec 2025) | Apache-2.0 | 10.5k | ✅ Active | Ceiling-setter only |
| TabICL | 2.1.1 (Apr 2026) | BSD-3 | 891 | ✅ Active | Optional FM second opinion |
| TabM / RealMLP (`pytabkit`) | — / 1.7.3 | Apache-2.0 | 1.0k / — | ✅ Active | Clean deep-tabular baselines |

### Calibration + uncertainty

| Library | Version | Licence | Health | Role |
|---|---|---|---|---|
| **venn-abers** (ip200) | 1.5.3 (May 2026) | MIT | ✅ Active, 203★, 17 releases | **Primary calibrator** — valid probability *intervals*, not a heuristic fit |
| **netcal** | 1.4.0 (Apr 2026) | Apache-2.0 | ✅ Active | ECE/MCE diagnostics (use for the adaptive-ECE fix) |
| **crepes** | 0.9.1 (Jun 2026) | BSD-3 | ✅ Active, 579★ | **Primary conformal** — Mondrian/class-conditional is first-class, purpose-built for a rare positive |
| MAPIE | 1.4.1 (Jun 2026) | BSD-3 | ✅ Active, 1.6k★ | Alternative/broader conformal |
| sklearn `CalibratedClassifierCV` | current | BSD-3 | ✅ | Baseline only — isotonic overfits badly at 2-4% positives |

### Training infrastructure

| Library | Version | Licence | Health | Role |
|---|---|---|---|---|
| **Optuna** | 4.9.0 (Jun 2026) | MIT | ✅ Active, 14.3k★ | Tuning — accepts a custom purged-CV splitter, which is exactly what you need |
| **mlfinpy** | — | — (maintained fork of archived mlfinlab) | ✅ | Purged/embargoed CV, average-uniqueness weights, sequential bootstrap — port rather than rewrite |
| `pypbo` | — | — | ⚠️ Low activity | CSCV / probability of backtest overfitting |
| imbalanced-learn | current | MIT | ✅ Active | **EDA only — do not resample** |

### Do not adopt (dead, archived, or superseded)

`betacal` (dead since 2021) · `nonconformist` (docs "severely deprecated") · `fortuna` (AWS, **archived
Apr 2025**) · `auto-sklearn` (no release since Feb 2023) · `PiML` (**discontinued** — maintainers moved to
commercial MoDeVa, Mar 2025) · `coral-pytorch` / `mord` / `spacecutter` (dormant) · `pandas-datareader`
(last release Jun 2024, upstream sources broken) · `hyperopt` (minimally maintained).

---

## 6. Licence landmines — read this before you `pip install`

Five real ones. Two of them are things you'd otherwise reach for by default.

1. **⚠️ TabPFN is not one licence — it's version-dependent and tightening.**
   TabPFN **v2 / 2.6** → Prior Labs License, *"open source, commercial use with attribution"* ✅.
   TabPFN **3** → TABPFN-3 License v1.0, **non-commercial by default** — the docs explicitly say any
   activity "influencing business decisions, vendor evaluation, or production deployment" needs a paid
   licence. TabPFN **3-Plus** → API/enterprise only ❌.
   **A default `pip install tabpfn` today gets you the version you cannot ship.** Pin deliberately.
2. **⚠️ OpenBB is AGPL-3.0** (changed from a permissive licence in May 2024). AGPL's network clause means
   hosting a modified version as a network-accessible service triggers source-disclosure obligations.
   Lyra is a hosted product. This is the single most likely landmine to step on, because "just use OpenBB"
   is the obvious move for financial data aggregation. Either avoid, or clear it with counsel, or buy
   their commercial licence.
3. **⚠️ yfinance — the code licence is fine, the *data* terms are not.** The library is Apache-2.0, but it
   wraps an endpoint Yahoo states is for personal use, and yfinance's own docs describe it as "for research
   and educational purposes," not affiliated with or vetted by Yahoo. **This is a live exposure for Lyra
   today, not a hypothetical**: `src/lib/live-signals.ts:61` fetches `interval=1d` OHLCV from Yahoo on the
   product's display path, and Lyra is heading to TestFlight/App Store. Worth a deliberate decision —
   either accept and document the risk, or move the production price path onto a licensed source
   (Sharadar/Polygon/EODHD commercial tier) and keep Yahoo for development only.
4. **⚠️ LGPL-3.0: `torchcp`, `TPOT`.** Permissive-ish but copyleft-flavoured. Both have clean-licensed
   equivalents (`crepes`/`MAPIE`, `AutoGluon`/`FLAML`) — just use those and skip the legal question.
5. **⚠️ AGPL-3.0: `sec-edgar-toolkit`.** Small and stale anyway; `edgartools` (MIT) is strictly better.

---

## 7. The data pipeline — what open source already solves, and what it doesn't

This was the biggest unknown in the plan. Good news on two of three legs.

### ✅ Solved by open source — adopt, don't build

- **`edgartools`** (dgunning) — v5.31.1 (May 2026), **MIT**, ~2.1k★, actively released. The only
  maintained library that competently handles all three of your SEC needs in one place: XBRL company
  facts, **Form 4 insider transactions parsed into structured rows**, and **13F holdings parsed from the
  XML info tables**. Form 4/13F XML parsing is where every other library is weak — `sec-edgar-downloader`,
  `secedgar` and `datamule` get you the *filing*, not the rows. **This is the months-saver.** Caveat:
  single-maintainer project — pin versions and be prepared to vendor a fork.
- **`secfsdstools`** (HansjoergW) — v2.4.3, **Apache-2.0**. Downloads the SEC Financial Statement Data Set
  quarterly ZIPs, indexes them in SQLite, exposes parquet/pandas.
- **The finding that matters most here:** **as-first-reported fundamentals are free.** The SEC Financial
  Statement Data Sets are inherently as-filed — each row is keyed by accession number (`adsh`) with its
  `filed` date, and **a restatement appears as a separate, later accession, not an overwrite**. So
  point-in-time reconstruction is achievable at zero data cost: for any as-of date T, filter to
  `filed <= T` and take the latest `adsh` per company/period. No library does that filtering for you — but
  it's a DuckDB `ASOF JOIN` over data you can download for free. **This meaningfully de-risks the
  "as-restated vs as-first-reported" gotcha from the previous doc, for the SEC half of the features.**
- **DuckDB `ASOF JOIN`** — MIT, mature, actively optimised. Do not adopt a feature store (Feast/Tecton/
  Chronon); this primitive plus parquet is the correct scale.
- **`pandera`** — the lightweight right answer for asserting schema and point-in-time invariants on each
  nightly load ("`filed` is never after today", "`period` end precedes `filed`"). Great Expectations is
  too heavy for a nightly single-pipeline ingest; `soda-core` is a reasonable YAML-flavoured alternative
  if you'd rather assert in SQL against DuckDB.
- **USAspending** — official API, free, no auth key, generous limits, plus a bulk Award Data Archive for
  the historical backfill. Backend source is CC0. No official Python SDK; unofficial `dlt`-based wrappers
  exist as convenience only.

**SEC ingestion mechanics** (get these right or you get throttled): hard cap **10 requests/second** across
sec.gov and data.sec.gov; a **compliant `User-Agent` identifying you is mandatory** (`"Company Name
admin@domain.com"`); send `Accept-Encoding: gzip, deflate`. For a universe of thousands of small caps, pull
the nightly **`companyfacts.zip`** and **`submissions.zip`** bulk files rather than looping per-CIK
endpoints, and use the live APIs only for incremental gap-filling.

### ❌ Not solved — budget for these

1. **UEI/DUNS → CIK/ticker crosswalk.** USAspending keys recipients by **UEI** (SAM.gov's post-2022
   replacement for DUNS). SEC EDGAR has **no UEI field at all**. There is no open-source crosswalk. You
   must hand-build it via normalised entity-name matching between SAM.gov registrant legal names and EDGAR
   company names — handling suffix stripping and, harder, the fact that many award recipients are
   *subsidiaries* that don't map 1:1 to a listed parent. **This is tractable only because your universe is
   small-cap-scoped** (a few thousand names, hand-verifiable). Budget real time; don't keep searching for a
   shortcut, others have looked.
2. **Delisted-inclusive price history.** No adequate free or open-source source exists. `yfinance` drops
   delisted tickers entirely. Free "survivorship-bias-free" CSVs circulating on Kaggle/forums are stale and
   of unverifiable provenance. **This is the item you pay for** — Sharadar (Nasdaq Data Link) remains the
   cheapest credible tier. Interim mitigation if you want to start before subscribing: begin capturing your
   own point-in-time snapshots *from today*, so you stop compounding the bias forward even though you can't
   recover history for free.
3. **Historical ticker→CIK mapping.** SEC publishes `company_tickers.json` (current mapping only). There is
   **no official file of historical ticker changes**. Reconstruct from 8-K name/ticker-change filings, or
   take it from Sharadar's ticker table. Relevant to §1.2 of the previous doc's "don't join on ticker" rule.

---

## 8. A free feature bank you should not ignore

**Chen & Zimmermann, Open Source Cross-Sectional Asset Pricing** (openassetpricing.com) — **212 replicated
predictor signals** (209 firm-level plus price/size/short-term-reversal), with Python (`pip install
openassetpricing`) and R packages and full construction code on GitHub. Verify the repo's LICENSE file
before commercial use; it's CRSP/Compustat-derived so it ships the *signal-construction code and factor
returns*, not the underlying raw data.

Two distinct uses for Lyra, both valuable:

1. **A baseline you must beat.** If your ten-domain model can't outperform a handful of well-known
   replicated signals, that's the most important thing you could learn, and it's cheap to find out.
2. **A feature bank.** Rather than hand-rolling every sub-signal, borrow construction code for the ones
   with published evidence — particularly net share issuance (§3.3, your strongest-evidenced domain).

Companion: **JKP global factor data** (jkpfactors.com, `bkelly-lab/jkp-data`) — the dataset behind the
"replication crisis" rebuttal, useful precisely because the two groups disagree, so cross-checking a signal
across both is a genuine robustness test.

Also worth knowing but lower priority: **Qlib** (Microsoft, MIT, actively maintained) as quant ML
infrastructure — but it supplies no alpha, and you already have a working worker/ledger architecture, so
adopting it would be a rewrite for no gain. `alphalens-reloaded` is useful for factor IC/quantile analysis
once you have a signal.

---

## 9. What I'd do next

1. **Migrate the label to Decision B option 4** (`+100% AND still listed AND liquidity grew`) — one line in
   `label_from_barrier`, evidence-driven, free today and expensive later. §3.1.
2. **Annotate `DOMAIN_WEIGHTS` with evidence grades** from §3.3, so the `theme`-weighted-16.0 bet is legible
   as a bet. Consider moving technical/accumulation toward the timing model (Model A) rather than the
   archetype model.
3. **Pin the suspicion thresholds from §2 into `monitor.py`** as loud assertions. A model that reports 8×
   lift should redden the nightly, not delight anyone. Keep `_verdict`'s existing `lift >= 2.0` gate —
   it's evidence-backed.
4. **Run the §4.2 bake-off** on the bootstrap dataset now, before real data exists. It's cheap, it
   exercises the whole lifecycle against three estimators, and it tells you whether the EBM export path is
   as simple as it looks. Decide on precision@k + ECE, not AUC.
5. **Adopt `edgartools` + `secfsdstools` + DuckDB ASOF** and write the as-of filter — this is Phase 1 and
   open source just removed most of its risk. Add them (plus `interpret`, `venn-abers`, `crepes`, `optuna`)
   as rows in `open-source-repo-registry.json`, which currently has nothing in this domain.
6. **Decide the yfinance question** (§6.3) deliberately, since it's a live production dependency on a
   store-bound app, not a future concern.
7. **Start capturing point-in-time snapshots today** even before the Sharadar subscription — you can't
   recover history for free, but you can stop compounding the bias forward.

---

## Sources

**Evidence — what actually predicts**
- [Gu, Kelly & Xiu — Empirical Asset Pricing via Machine Learning (NBER w25398)](https://www.nber.org/system/files/working_papers/w25398/w25398.pdf) · [RFS version](https://academic.oup.com/rfs/article/33/5/2223/5758276)
- [Hou, Xue & Zhang — Replicating Anomalies (NBER w23394)](https://www.nber.org/system/files/working_papers/w23394/w23394.pdf)
- [Jensen, Kelly & Pedersen — Is There a Replication Crisis in Finance? (NBER w28432)](https://www.nber.org/system/files/working_papers/w28432/w28432.pdf)
- [McLean & Pontiff — Does Academic Research Destroy Stock Return Predictability?](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2156623)
- [Novy-Marx & Velikov — A Taxonomy of Anomalies and Their Trading Costs (RFS)](https://academic.oup.com/rfs/article-abstract/29/1/104/1844518)
- [Bali, Cakici & Whitelaw — Maxing Out: Stocks as Lotteries (JFE 2011)](https://pages.stern.nyu.edu/~rwhitela/papers/max%20jfe.pdf)
- [Harvey, Liu & Zhu — …and the Cross-Section of Expected Returns (summary)](https://foxholm.com/q/research/harvey-liu-zhu-cross-section/)
- [Pontiff & Woodgate — Share Issuance and Cross-Sectional Returns](https://www.semanticscholar.org/paper/Share-Issuance-and-Cross%E2%80%90sectional-Returns-Pontiff-Woodgate/a49487518f8adde358fc15f79aefc2329b2cc02e) · [international evidence](https://www.sciencedirect.com/science/article/abs/pii/S0304405X09001007)
- [Chan, Lakonishok & Sougiannis — Stock Market Valuation of R&D (NBER w7223)](https://www.nber.org/system/files/working_papers/w7223/w7223.pdf)
- [Dyakov et al. — Institutional Ownership and Future Stock Returns](https://onlinelibrary.wiley.com/doi/full/10.1111/irfi.12203)
- [Robeco — Using AI for selecting small-cap stocks (2025)](https://www.robeco.com/en-int/insights/2025/09/using-artificial-intelligence-for-selecting-small-cap-stocks)
- [Insider Purchase Signals in Microcap Equities (arXiv 2602.06198, preprint)](https://arxiv.org/html/2602.06198v1)
- [Dealing with Delistings — AlphaArchitect](https://alphaarchitect.com/dealing-with-delistings-a-critical-aspect-for-stock-selection-research/)

**Open-source estimator stack**
- [InterpretML / interpret (EBM)](https://github.com/interpretml/interpret)
- [LightGBM](https://github.com/lightgbm-org/LightGBM) · [XGBoost](https://github.com/dmlc/xgboost) · [CatBoost](https://github.com/catboost/catboost)
- [shap](https://github.com/shap/shap) · [AutoGluon](https://github.com/autogluon/autogluon) · [FLAML](https://github.com/microsoft/FLAML)
- [venn-abers (ip200)](https://github.com/ip200/venn-abers) · [netcal](https://github.com/EFS-OpenSource/calibration-framework)
- [crepes](https://github.com/henrikbostrom/crepes) · [MAPIE](https://github.com/scikit-learn-contrib/MAPIE) · [puncc](https://github.com/deel-ai/puncc)
- [Optuna](https://github.com/optuna/optuna) · [imbalanced-learn](https://github.com/scikit-learn-contrib/imbalanced-learn)
- [OGBoost](https://github.com/asmahani/ogboost) · [coral-pytorch](https://github.com/Raschka-research-group/coral-pytorch) · [mord](https://github.com/fabianp/mord)
- [TabPFN](https://github.com/PriorLabs/tabpfn) · [Prior Labs models + licensing](https://docs.priorlabs.ai/models) · [TabICL](https://github.com/soda-inria/tabicl) · [TabM](https://github.com/yandex-research/tabm) · [pytabkit / RealMLP](https://github.com/dholzmueller/pytabkit)
- Archived/dead: [fortuna](https://github.com/awslabs/fortuna) · [auto-sklearn](https://github.com/automl/auto-sklearn) · [PiML](https://github.com/SelfExplainML/PiML-Toolbox) · [nonconformist](https://github.com/donlnz/nonconformist) · [pandas-datareader](https://github.com/pydata/pandas-datareader/releases)
- Copyleft: [TorchCP LICENSE](https://raw.githubusercontent.com/ml-stat-Sustech/TorchCP/master/LICENSE) · [TPOT](https://github.com/EpistasisLab/tpot) · [sec-edgar-toolkit](https://github.com/stefanoamorelli/sec-edgar-toolkit)

**Open-source data pipeline**
- [edgartools](https://github.com/dgunning/edgartools) · [Form 4 guide](https://edgartools.readthedocs.io/en/stable/guides/track-form4/) · [13F parsing](https://www.edgartools.io/making-sec-13f-holdings-parsing-8x-faster/)
- [secfsdstools](https://github.com/HansjoergW/sec-fincancial-statement-data-set) · [docs](https://hansjoergw.github.io/sec-fincancial-statement-data-set/)
- [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) · [SEC Webmaster FAQ — rate limits + User-Agent](https://www.sec.gov/about/webmaster-frequently-asked-questions)
- [usaspending-api (CC0)](https://github.com/fedspendingtransparency/usaspending-api) · [dlt USAspending source](https://dlthub.com/context/source/usa-spending)
- [DuckDB ASOF JOIN](https://duckdb.org/docs/current/guides/sql_features/asof_join) · [Planning AsOf Joins (2025)](https://duckdb.org/2025/02/19/asof-plans) · [Polars join_asof](https://docs.pola.rs/py-polars/html/reference/dataframe/api/polars.DataFrame.join_asof.html)
- [pandera](https://pandera.readthedocs.io/) · [Feast (not recommended at this scale)](https://github.com/feast-dev/feast)
- [OpenBB licence change to AGPL](https://openbb.co/blog/license-change-openbb-platform-goes-agpl/) · [OpenBB licensing FAQ](https://docs.openbb.co/platform/faqs/license)
- [yfinance docs](https://ranaroussi.github.io/yfinance/) · [Sharadar](https://www.sharadar.com/)

**Feature banks**
- [Open Source Asset Pricing — data](https://www.openassetpricing.com/data/) · [GitHub (CrossSection)](https://github.com/OpenSourceAP/CrossSection)
- [JKP Global Factor Data](https://jkpfactors.com/) · [GitHub](https://github.com/bkelly-lab/jkp-data)
- [Microsoft Qlib](https://github.com/microsoft/qlib) · [alphalens-reloaded](https://github.com/stefan-jansen/alphalens-reloaded)
