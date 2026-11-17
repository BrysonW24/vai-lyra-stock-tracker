# Model Registry - the versions space + the north star

> The single ledger of every predictive-model version Lyra has shipped, what changed, and its one
> honest number - so "we improved the model" is **provable**, not asserted.
>
> - **Source of truth:** [`model-registry.json`](model-registry.json) (machine-readable).
> - **Kept honest by:** `npm run check:model-registry` (CI-gated). Every number here must tie to a real
>   artifact, a recorded metrics row, or a code version string, or the build goes red.
> - **Sits alongside:** [`MODEL-REPORT-CARD.md`](MODEL-REPORT-CARD.md) (letter grades + roadmap),
>   [`model-metrics-history.jsonl`](model-metrics-history.jsonl) (the raw backtest numbers, corpus-hashed).
>
> **This registry is the version scoreboard + honesty gate, not the destination.** The destination -
> the full target-state stack (L0 data spine → L5 narration), the 10 earn-gates, and the precise
> "arrived" definition - is [`../lyra-modelling/NORTH-STAR.md`](../lyra-modelling/NORTH-STAR.md). This
> file tracks *where we are* against *that* target and refuses to let any number drift from the
> artifact that produced it.

---

## ⭐ The North Star

**Out-of-sample lift@k (top 5%), on the one-shot holdout, random slice.**

> Of our very top picks, how many more actually became winners than a random pick would give you -
> measured on data the model never trained on, on the honest random sample (not the curated hindsight
> names). **1.0x = no edge (random). 2.0x = our top picks are twice as winner-dense as chance.**

| | Value | As of |
|---|---|---|
| **Current** | **1.72x** (CI90 [1.38, 2.05]) — holdout top-5% picks were 23.1% doublers vs 13.4% random | 2026-08-01, corpus `ef1b5c52...`, champion `real-v1` |
| **Interim waypoint** | **≥ 2.0x** (CI lower bound ≥ 1.5x) | - |
| **Arrived** (canonical, [`NORTH-STAR.md`](../lyra-modelling/NORTH-STAR.md)) | **≥ 3.0x (CI90 floor ≥ 2.0x)** on a *delisted-inclusive* holdout, **≥90% of quarters beat null**, **ECE ≤ 0.03** at deployment prevalence, live calibration sustained 2 quarters | - |

The 3.0x bar is defined on the delisted-inclusive corpus on purpose: it makes the number *real*, not
the optimistic bound today's survivor-biased 1.72x is. **Why this metric and not another:** it is base-rate-normalised (so it stays comparable as winner
density drifts between corpora), it has confidence intervals, it is scored on the **one-shot holdout**
so it cannot be tuned upward by iterating, and it is aligned with the product truth - **surfacing is
only earned when the top of the queue is reliably winner-dense out of sample.** ROC-AUC, PR-AUC, Brier
etc. all still get recorded every cycle; they are diagnostics. This is the one we steer by.

> ⚠️ **Honesty caveat that travels with the number:** 1.72x is an *optimistic bound*. The corpus is
> survivor-biased (current SEC listing only, delisted names censored), so real-world lift is lower. At a
> realistic ~3% deployment base rate the same edge restates to ~5.6% top-k precision - a real
> research-queue edge, **not a tradeable signal.** The target's "survivorship removed" clause exists
> precisely to convert the north star from an optimistic bound into a real number.

### Guardrails (the north star doesn't count if these regress)

| Guardrail | Rule | Current | Status | Gates |
|---|---|---|---|---|
| **Worst-cohort lift** | No regime worse than random: worst quarterly-cohort lift@k ≥ 1.0 | **0.83x** | 🔴 **FAILING** | **surfacing** |
| **Calibration (ECE)** | Probabilities mean what they say: adaptive ECE ≤ 0.05 | 0.042 | 🟢 PASSING | calibration |
| **Anti-gaming** | Any lift > 2.0x triggers a mandatory leakage decomposition before it's recorded | - | rule | integrity |

**The worst-cohort guardrail is the whole story.** Pooled lift is a genuine 1.72x, but the *worst
quarter* is still **below random** (0.83x), and on the dev split the worst cohort (2019Q2) is 0.0x -
entire regimes produce almost nothing. **This is why surfacing is not earned.** Closing this gap - not
raising the pooled headline - is the mission. When a change lifts the pooled number but leaves a regime
below random, it has not improved the thing that matters.

### What counts as an "improvement" (the standing rule)

A new version is an **improvement**, not merely a **change**, only if **all four** hold:

1. the north star **rises**, and
2. **no guardrail regresses**, and
3. it's measured on a **fresh one-shot holdout** (never one already iterated against), and
4. it **separates from the incumbent by confidence interval**, not point estimate.

Anything short of all four is recorded as "a change." The registry keeps both honest.

---

## The version timeline

Newest first. Full numbers + provenance per row in [`model-registry.json`](model-registry.json).

| Version | Date | Layer | North star (holdout lift) | Status | One-line verdict |
|---|---|---|---|---|---|
| **`real-v1`** | 2026-07-31 | M2 classifier — **deployed champion** | **1.72x** [1.38, 2.05] | 🟡 CHAMPION (surfacing-gated) | First model to learn REAL out-of-time signal. Genuine but modest edge; worst regime still below random. |
| `bootstrap-synthetic-v1` | 2026-07-31 | M2 classifier | 0.70x [0.47, 0.92] | ⚫ RETIRED (refuted) | Learned the hand-designed hypothesis faithfully — the hypothesis was wrong. Proved the lifecycle end to end. |
| `reference-v1` | 2026-07-29 | M1 composite / fallback | 0.68x [0.49, 0.89] | 🔴 REFUTED as ranker (kept as feature layer) | Top picks contain *fewer* winners than random. Its legibility is what let the backtest refute it cleanly. |

**The champion was force-promoted, and that was correct.** `real-v1` failed the training floor gate
(`floor.passed: false, forced: true`) because it "regressed" against the bootstrap champion's stored
lift of 2.774 - but that 2.774 was a **synthetic self-evaluation**, refuted on the real holdout at
0.70x. Promoting a real-data model that clears 1.72x on real data over a synthetic artifact that fails
at 0.70x on real data is right; the floor was comparing against a fiction. The registry records the
reason so `forced=true` reads as a deliberate act, not a silent override - and the gate **fails the
build** if a forced promotion ever lacks a recorded reason.

### Feature + engine changes (no isolated metric - honest about it)

Not every modelling change is a retrain with its own number. These expanded the substrate the *next*
champion learns from; they carry **no independent north-star delta** and the registry says so:

- **2026-08-01 (app 0.105-0.107):** real SEC EDGAR fundamentals (CIK-authoritative), multi-market
  universe (US + ASX + FX + Stooq), `p_2x_12m` outcome, coverage-honesty render fixes. → more real
  domains lit up, more markets = the raw material for the next north-star move (report card Stage 2).
- **2026-08-01 (ranker semantics):** removed the silent 0.5 default for unsupplied attention/relevance;
  the ranker now renormalises over known signals instead of fabricating 25% of the priority weight.

---

## Where the next north-star move comes from

Per [`MODEL-REPORT-CARD.md`](MODEL-REPORT-CARD.md), the estimator is Level 2 and the eval discipline is
already Level 4 - so **the next move is data, not a fancier model:**

1. **Deep-domain features** (Form 4 insider next, CIK-safe; then 13F, USAspending, a dated theme source)
   - lights up the 5 constant-absent domains.
2. **Kill survivorship** (delisted-inclusive point-in-time corpus) - turns 1.72x from an optimistic
   bound into a real number, and unlocks the ruin class for the risk gates.
3. **Only then**, the GBDT estimator upgrade - behind the same artifact contract, gated on beating
   `real-v1` on a fresh holdout with CI separation.

Enabling the **nightly real-universe scan** is step zero of #2: it's what accumulates the live ledger
that eventually replaces the survivor-biased corpus with genuine point-in-time rows.

---

## How to record a new version (the ritual)

1. Run the eval loop: `npm run worker:emerging-winner-backtest -- build|retrain|compare|holdout`
   (holdout is scored **once** - never iterate on it).
2. Append the cycle to `model-metrics-history.jsonl`: `... -- record` (stamps the corpus hash).
3. Add a row to `versions[]` in [`model-registry.json`](model-registry.json), and if the champion
   changed, update `deployed_champion` + `north_star.current` (`value`, `corpus_sha256`, `source_path`,
   `model_version`) and re-grade [`MODEL-REPORT-CARD.md`](MODEL-REPORT-CARD.md).
4. `npm run check:model-registry` must pass - it proves your new numbers tie to the recorded row, the
   frozen artifact, and the code version strings. If it's red, the registry drifted from reality.
