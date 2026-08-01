# Real-history backtest + the real-v1 champion

_2026-08-01 · the first genuine "does it predict success?" eval, run on old data with matured
outcomes · corpus sha256 `ef1b5c52471d28a1...` (full hash in `corpus-meta.json`)_

## What happened, in one paragraph

We built a point-in-time historical corpus from free sources (yfinance daily history with
split-reconstruction, SEC EDGAR facts filtered on `filed <=` the entry date), labelled it with the
engine's own matured 12-month first-touch barrier, and evaluated all three Emerging Winner scoring
models on it. The deterministic reference scorecard and the bootstrap-synthetic champion were both
REFUTED - their top picks contained FEWER real winners than random selection, with 90% confidence
intervals excluding chance. A challenger trained on the real 2016-2023 outcomes through the unchanged
`train.py` lifecycle showed genuine, calibrated skill, and confirmed it on a one-shot untouched
holdout (2024Q1-2025Q2): **lift 1.72x, CI90 [1.38, 2.05]**. It was promoted to champion as
`emerging-winner-classifier-real-v1` with the full justification recorded in the artifact. Everything
stays SHADOW-LIVE: surfacing is not earned and remains monitor + founder gated.

## The corpus (what the models were tested on)

| Property | Value |
|---|---|
| Symbols priced | 1,140 fetched; 991 produced rows (current SEC listing + 14 curated names) |
| Rows | 27,420 quarterly point-in-time rows, score dates 2016Q1 .. 2025Q2 |
| Label | first-touch +100% / -80%, 252 trading days, option-4 conjuncts |
| Base rate (random slice) | 9.9% (27,158 rows, 2,686 winners) |
| Dev / holdout split | dev < 2024-01-01 (20,993 rows) · holdout >= 2024-01-01 (6,165 rows, scored ONCE) |
| Features | the live domain scorecard's own inputs, as-of the entry bar date |
| Prices | yfinance daily, dividend+split adjusted for indicators/labels, split-reconstructed RAW close for market cap |
| Fundamentals | EDGAR companyfacts, every derivation filtered on `filed <= entry date` (restatements invisible) |
| Integrity | sha256 stamped in meta + verified at load; theme-injection and curated-flag invariants asserted at load |

**Bias disclosures (all of them):**

1. **Survivorship**: the universe is the CURRENT SEC listing - delisted names are absent, the ruin
   class is censored, precision is an optimistic bound. The delisted-inclusive corpus remains the
   roadmap's data gate.
2. **Curation-by-outcome**: the 14 curated emergence names were hand-picked with hindsight. Their 262
   rows are flagged, EXCLUDED from all training, and reported only as a disclosure slice (their base
   rate is 42% vs 9.9% random - proof of how much hindsight selection flatters).
3. **Label conjuncts**: `still_listed` excluded 0 would-be winners (inert on a survivor corpus - we do
   not present option-4 as survival discipline here); `liquidity_grew` excluded 457. Option-1 vs
   option-4 metrics are side-by-side in the reports and tell the same story.
4. **Prevalence**: the corpus base rate (~10%) is a survivor-inflated mixture; the real deployment
   universe base is ~2-4%. The odds-rescaled restatement of holdout precision at a 3% base is ~5.6%
   top-k precision - the number that survives contact with the real universe.

## Results (random-sample slice = the headline; symbol-clustered 90% CIs)

### Fair comparison on identical dev OOS windows (purged walk-forward, calendar-day spans)

| Model | lift@5% | CI90 | ROC-AUC | PR-AUC | ECE |
|---|---|---|---|---|---|
| Bootstrap-synthetic champion (old) | **0.78x** | [0.62, 0.97] | 0.472 | 0.086 | 0.053 |
| Real-v1 challenger (walk-forward OOS) | **1.31x** | [1.09, 1.56] | 0.579 | 0.114 | 0.026 |

### One-shot holdout confirmation (2024Q1-2025Q2, untouched by every decision)

| Model | lift@5% | CI90 | ROC-AUC | P@5% vs base | ECE | worst cohort |
|---|---|---|---|---|---|---|
| Reference scorecard | 0.68x | [0.49, 0.89] | 0.482 | 9.1% vs 13.4% | 0.173 | 0.0 |
| Bootstrap-synthetic champion | 0.70x | [0.47, 0.92] | 0.466 | 9.4% vs 13.4% | 0.095 | 0.0 |
| **Real-v1 (promoted)** | **1.72x** | **[1.38, 2.05]** | 0.585 | **23.1% vs 13.4%** | 0.042 | 0.111 |

- Lift is robust across operating points, not a k=5% artifact: 1.88x @ top-2%, 1.72x @ 5%, 1.56x @ 10%.
- The real-v1 CI floor (1.38) sits above both incumbents' CI ceilings (~0.92): the separation is not noise.
- Per-cohort blocks under k=3 are suppressed; every cohort row carries its expected-hits-under-null.
- Effective sample honesty: 27k rows collapse to ~991 symbols and ~2,686 winner rows across
  overlapping windows - the CIs are clustered by symbol for exactly this reason.

### What the real data taught the model (standardized logistic weights)

| Domain | Synthetic hypothesis | Real-v1 learned | Reading |
|---|---|---|---|
| technical | +0.44 | **-0.28** | the RSI-reset / early-turn pattern ANTI-predicts 12-month doublers |
| liquidity | +0.28 | **-0.18** | the comfortable-liquidity band anti-predicts; thin volatile names double more (lottery effect, trimmed by the liquidity label conjunct) |
| capital | +0.41 | -0.09 | low dilution: roughly flat on this horizon |
| accumulation | +0.40 | +0.03 | volume state: weak |
| business_quality | +0.43 | **+0.12** | real revenue growth / margin trend: genuine positive |
| completeness | -0.02 | **+0.39** | names with real filed fundamentals beat data-dark names |
| theme / government / adoption / sponsorship / narrative | +0.34..0.66 | 0.00 | unwired domains - constant-absent in the corpus, honestly dead weights |

The refutation of the incumbents is now mechanically explained: they bet hardest on `technical`
(present on 100% of rows) in the WRONG direction.

## How the number was earned (the leakage story, told against ourselves)

The first run of this backtest printed **lift 2.77x**. An adversarial review took it apart before it
was reported, and the decomposition is the most instructive artefact of the session:

| Step | Lift | What was removed |
|---|---|---|
| First run | 2.77x | - |
| Strip stale theme labels (stale-cache corpus violated its own `theme_injection:false`) | 1.47x | symbol-identity leak: today's curated theme labels stamped onto historical rows of 40%-base-rate names |
| Quarantine curated hindsight names from training + metrics | 1.35x | curation-by-outcome: 14 hand-picked serial winners were 45 of 53 pooled top-k hits |
| Fix purge units (trading-day horizon vs calendar ordinals under-purged ~12% of kept rows) | ~1.31x | genuine train/test outcome sharing across fold boundaries |
| Final honest dev walk-forward | **1.31x** | - |
| One-shot holdout | **1.72x** | (2024-2025 was a favourable regime for the learned signal; the CI is the claim, not the point) |

Standing rule adopted: **any lift materially above ~2x from this feature set triggers a mandatory
leakage decomposition (feature ablation + curated/random slice + grouped-by-symbol split) before the
number is reported anywhere.** The plausible band for ~5 effective technical+fundamental domain
scores at a 12-month horizon is ~1.2-1.8x; treat anything above it as an alarm, not a victory.

Also fixed on the way in (each with a regression pin in `tests/`): the EDGAR concept-union that
mixed dei cover-date share counts into fiscal-year weighted averages (19 of 101 audited companies
sign-flipped their dilution read), 52/53-week fiscal-calendar handling, the Stooq split-adjusted
"raw" close (future-split leak into market cap), per-symbol data ends (stale caches read as
delistings), and the entry-date/feature-clock alignment.

## Promotion decision (recorded in the artifact itself)

The dev floor (`lift >= 1.5`) was missed at 1.31x. The floor exists so a bad retrain cannot silently
replace a good champion - but here the incumbent was REFUTED on the same data (CI fully below 1.0),
so refusing promotion would have kept the demonstrably worse model in production. The promotion was
made with an explicit recorded force-reason (see `promotion` block in
`src/lib/generated/emerging-winner-model.json`), the drift guard re-verified (max error 1.7e-08
across 17 fixtures), and the shadow gate untouched: **surfacing is still not earned** - worst
quarterly cohort precision is thin, and the live-calibration gate (`monitor.model_health`) has zero
matured ledger pairs until the outcome-maturation job ships and real predictions age 12 months.

## Reproduce / re-run

```bash
npm run worker:emerging-winner-backtest -- build --sample 1400 --prefer yfinance
npm run worker:emerging-winner-backtest -- retrain     # dev split, curated excluded, purged walk-forward
npm run worker:emerging-winner-backtest -- compare     # fair champion-vs-challenger on identical dev OOS
npm run worker:emerging-winner-backtest -- eval        # all frozen models, all slices, CIs
npm run worker:emerging-winner-backtest -- holdout     # ONE-SHOT - only after all decisions are frozen
npm run worker:emerging-winner-backtest -- record      # append to lyra-evals/model-metrics-history.jsonl
```

Grading, the sophistication ladder, and the standing improvement loop live in
[`lyra-evals/MODEL-REPORT-CARD.md`](../../lyra-evals/MODEL-REPORT-CARD.md).

---

## Addendum - generation 2, same day (corpus `a297e8ad...`)

The improvement loop's first turn, hours after gen-1. Corpus regenerated with two newly-built
domains: THEME from each issuer's SEC SIC code (deterministic, outcome-independent - the honest
replacement for the banned curated labels; 80 hot-theme members, 2,316 rows) and NARRATIVE from a
causal benchmark market regime (SPY trend + drawdown; all 27,420 rows). Because the corpus
generation changed, a fresh one-shot holdout was legitimate under the standing rules.

**Results:**

| Model | Gen-1 holdout | Gen-2 holdout |
|---|---|---|
| Deployed champion (real-v1) | 1.72x CI[1.38, 2.05], worst cohort 0.11, ECE 0.042 | **1.94x CI[1.55, 2.29], worst cohort 0.20, ECE 0.017** |
| Freshly retrained challenger | - | 1.91x CI[1.59, 2.32] holdout, but 1.27x dev walk-forward - FAILED floors |
| Reference scorecard | 0.68x | 0.68x (still refuted as a ranker) |

**Decisions and lessons:**

1. **No promotion.** The gen-2 challenger did not beat the incumbent on the holdout (CIs deeply
   overlapping) and failed its dev floors. The champion trained on gen-1 data stays deployed - and
   improved anyway, because the richer INPUTS (hot-SIC membership raising completeness, regime
   lighting narrative) reached it at scoring time. The grade thesis proven empirically: accuracy
   moves with data, not tuning.
2. **Protocol correction recorded:** once a real-data champion is deployed, dev-split
   champion-vs-challenger comparisons are in-sample-flattered for the incumbent. From gen-2 onward
   the one-shot holdout is the only fair fight; the comparison report says so in its own note.
3. **The regime feature adds no within-cohort ranking power** (identical value for every name on a
   date) - its value is calibration across time, which showed up in the champion's ECE halving.
4. Shipped alongside gen-2: the outcome-maturation job (migration 057) closing the live loop, the
   monthly re-eval cadence workflow, quarterly EDGAR revenue growth (live-semantics parity), live
   Form 4 insider flow with the historical fill running, and the in-app Evidence surface rendering
   the generated evidence pack. Regrade: accuracy B-, calibration A-, process A, data C-.
