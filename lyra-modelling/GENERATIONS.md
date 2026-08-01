# Model Generations - the visual version history

One self-contained section per generation: what it was, how it worked (ASCII diagram), what
changed, what it taught us. Each section is written to be COPIED OUT WHOLE into an infographic
tool - it carries its own numbers and needs no other context.

Numbers trace to [`../lyra-evals/model-metrics-history.jsonl`](../lyra-evals/model-metrics-history.jsonl)
(keyed by corpus hash) and [`../lyra-evals/generations/GENERATION-LOG.md`](../lyra-evals/generations/GENERATION-LOG.md).
The small disciplines behind every number live in [`MODEL-NUANCES.md`](./MODEL-NUANCES.md).
Maintained by `/model-generation-eval` - a new section lands here every time a generation closes.

| Generation | Date | Corpus | Champion holdout lift | One-line story |
|---|---|---|---|---|
| 1 | 2026-08-01 | `ef1b5c52` | 1.72x (promoted) | Real outcomes refute the hand-built models; real training wins |
| 2 | 2026-08-02 | `a297e8ad` | 1.94x (confirmed) | Same frozen model, richer data; retrained challenger refused |
| 3 | in flight | pending | pending | Insider flow lights up; two estimator families fight fair |

---

## Generation 1 - "Does anything here actually predict?" (2026-08-01, corpus ef1b5c52)

**The question:** the app shipped with a hand-designed 10-domain scorecard and a champion trained
on SYNTHETIC data generated from that scorecard's own assumptions. Nobody had ever tested either
against real history. Gen-1 built the test: 27,420 point-in-time windows across 991 US symbols,
2016-2025, labelled by a hard rule - did the stock double within 12 months (first touch), while
staying listed with growing liquidity?

**The verdict (holdout 2024-2025, scored exactly once):**

| Model | Lift vs chance | CI90 | Fate |
|---|---|---|---|
| Reference scorecard (hand-weighted) | 0.68x | [0.49, 0.89] | REFUTED as a ranker (kept as feature layer) |
| Synthetic champion (trained-v1) | 0.70x | [0.47, 0.92] | REFUTED, retired |
| real-v1 (retrained on real outcomes) | 1.72x | [1.38, 2.05] | PROMOTED to champion |

Both incumbents scored BELOW 1.0x - worse than picking at random. The model retrained on real
2016-2023 outcomes showed genuine skill, confirmed once on untouched 2024-2025 data.

**How it worked:**

```
  SEC EDGAR                    Yahoo prices
  (fundamentals,               (split-corrected,
   filed <= T only)             point-in-time)
       |                            |
       +------------+---------------+
                    v
        FEATURES AS-OF ENTRY DATE T          <- no future information, ever
                    |
                    v
     +------------------------------------+
     |        10 DOMAIN SCORES            |
     |                                    |
     |  LIVE (5):        DARK (5):        |
     |   technical        theme      0.00 |
     |   accumulation     government 0.00 |
     |   liquidity        adoption   0.00 |
     |   business qual.   sponsorship0.00 |
     |   capital          narrative  0.00 |   <- dark = honest zero,
     +------------------+-----------------+      never a guess
                        v
          [+ coverage completeness]           <- "how much can we see?"
                        |
                        v
              STANDARDISED LOGISTIC           <- 11 weights, stdlib,
              (trained on REAL outcomes)         deliberately simple
                        |
                        v
             P(doubles in 12 months)
                        |
                        v
          SHADOW LEDGER (informs, never
          decides; surfacing founder-gated)

  EVAL LOOP: purged walk-forward (430d + 15d calendar) -> floors ->
             ONE-SHOT holdout -> promote/refuse -> record
```

**What real data taught the model (the weight flips):**

```
                 synthetic hypothesis     learned from real outcomes
  technical            +0.44        ->        -0.28   (FLIPPED)
  liquidity            +0.28        ->        -0.18   (FLIPPED)
  business quality     +0.43        ->        +0.12
  completeness         -0.02        ->        +0.39   (biggest positive)
  theme/govt/adoption/
  sponsorship/narrative +0.3..0.7   ->         0.00   (pipelines dark)
```

The two heaviest hand-designed bets - clean technical structure and comfortable liquidity - are
NEGATIVE signals for 12-month doublers in real history. Winners look uncomfortable on the way up.

**The number was earned, not found:** the first run printed 2.77x. Adversarial review dismantled
it (theme-label leak -> 1.47x, curated hindsight names -> 1.35x, calendar-purge bug -> 1.31x dev)
before anything was reported. Standing rule born here: lift above ~2x from this feature set
triggers a mandatory leakage decomposition.

**Grades:** Accuracy C+ · Calibration B+ · Process A- · Estimator D+ · Data D · Honesty A

---

## Generation 2 - "Better data or better fitting?" (2026-08-02, corpus a297e8ad)

**The question:** gen-1 left five domains dark. Gen-2 lit two of them honestly (theme via SEC SIC
industry codes, market narrative via a causal SPY-regime signal), upgraded fundamentals from
annual to quarterly, and recomputed market caps - SAME windows, SAME labels. Then it asked: does
the frozen champion improve on richer inputs, and can a RETRAINED model beat it?

**The verdict (fresh one-shot holdout, same 6,165 rows):**

| Model | Lift | CI90 | ECE | Fate |
|---|---|---|---|---|
| Champion (real-v1, weights FROZEN since gen-1) | 1.94x | [1.55, 2.29] | 0.017 | confirmed, stays champion |
| Gen-2 retrained challenger (learned the new domains) | 1.91x | [1.59, 2.32] | 0.048 | REFUSED |
| Reference scorecard | 0.68x | [0.49, 0.92] | 0.248 | still refuted |

Paired difference test on identical rows: delta-lift -0.02, CI90 [-0.24, +0.28] - no detectable
difference, and the pre-committed must-beat rule keeps the incumbent. **Better data beat better
fitting:** the frozen model improved 1.72x -> 1.94x purely through richer inputs, while
re-learning the weights on the same rich corpus added nothing.

**How it worked:**

```
  SEC EDGAR            Yahoo prices         SEC SIC codes      SPY regime
  (now QUARTERLY       (caps recomputed:    (point-in-time     (200-day SMA
   YoY preferred)       true raw close)      theme member?)     + drawdown,
       |                    |                    |               causal)
       +---------+----------+---------+----------+------+--------+
                                      v
                    FEATURES AS-OF ENTRY DATE T
                                      |
                                      v
              +----------------------------------------+
              |          10 DOMAIN SCORES              |
              |                                        |
              |  LIVE (7):            DARK (3):        |
              |   technical            government 0.00 |
              |   accumulation         adoption   0.00 |
              |   liquidity            sponsorship0.00 |
              |   business quality                     |
              |   capital              (Form 4 backfill|
              |   theme        NEW      running for    |
              |   narrative    NEW      sponsorship)   |
              +-------------------+--------------------+
                                  v
                    [+ coverage completeness]   <- MORE domains visible
                                  |                = higher completeness
                 +----------------+----------------+     = the frozen
                 v                                 v      champion's
      FROZEN CHAMPION                   RETRAINED CHALLENGER   heaviest
      (gen-1 weights,                   (theme +0.08,          positive
       untouched)                        narrative -0.19)      weight
                 |                                 |
                 v                                 v
            1.94x holdout      PAIRED TEST    1.91x holdout
                 |          (delta CI must     dev WF only 1.27x
                 |           exclude zero)          |
                 +--------> KEEP CHAMPION <---------+
                            (must-beat rule:
                             a tie keeps the
                             incumbent)
```

**Watch-outs recorded, not buried:** the cap-tier story FLIPPED under the market-cap
recomputation (gen-1 said micro/small caps carry the signal; gen-2 says large tier leads) -
flagged as an open stability question, no tier claims allowed. Champion dev numbers are
in-sample-flattered post-promotion; the holdout is the only fair fight.

**Post-close evidence sprint (same day):** paired-difference gates replaced CI-overlap
eyeballing everywhere; weak calibration was measured (recalibration slope 0.755 CI90[0.57, 0.98]
- the spread is mildly overconfident, invisible to ECE; the fix seam shipped inert); the first
estimator bake-off ran (depth-2 boosted trees beat the linear retrain on dev, 1.39x tuned vs
1.27x, config frozen for gen-3); every attempt now logs to a trial ledger, refusals included.

**Grades:** Accuracy B- · Calibration A- · Process A · Estimator C- · Data C- · Honesty A
(Estimator moved D+ -> C- on the bake-off evidence)

---

## Generation 3 - "Does insider conviction predict?" (IN FLIGHT - design locked, results pending)

**The question:** the sponsorship domain (are insiders putting their own money in?) has been an
honest zero through two generations. A 205,189-document backfill of SEC Form 4 filings (991
companies, June 2015 to present, parsed by the SAME code the live scanner uses) lights it up.
Gen-3 asks two pre-registered questions: does insider flow improve prediction, and can the
nonlinear estimator finally earn the seat?

**Locked before results (the anti-cherry-picking contract):**

- Boosted config FROZEN from the pre-committed gen-2 sweep: {rounds 200, n_thresholds 32}
  (dev 1.39x; weakest worst-quarter of the sweep - named in advance as the thing to watch).
- Promotion gate: paired delta CI90 excluding zero on the FRESH one-shot holdout + absolute
  floors + must-beat. No CI-overlap eyeballing. No further hyperparameter sweeps.
- The slope-corrected calibration artifact (logit-linear, monotone, artifact-carried) is
  evaluated as a candidate THROUGH the loop, not hot-patched.
- Per-row scores archived (started gen-2) enable the first PAIRED cross-generation test.

**How it will work:**

```
   EDGAR + prices + SIC + regime          NEW: 205,189 Form 4 filings
   (everything gen-2 had)                 (insider open-market buys/sells,
        |                                  P/S codes only, all-or-nothing
        |                                  windows, same parser as live)
        +-------------------+------------------+
                            v
              FEATURES AS-OF ENTRY DATE T
                            |
                            v
            +-------------------------------+
            |       10 DOMAIN SCORES        |
            |                               |
            |  LIVE (8):        DARK (2):   |
            |   ...gen-2 seven   government |    <- bridge designed
            |   sponsorship NEW  adoption   |       (CIK <-> USAspending);
            +---------------+---------------+       adoption paywalled
                            v
              [+ coverage completeness]
                            |
          +-----------------+------------------+
          v                 v                  v
   FROZEN CHAMPION   LOGISTIC RETRAIN   BOOSTED DEPTH-2
   (the 1.94x        (learns the        (frozen config,
    incumbent)        insider signal)    interactions:
          |                 |            insider x liquidity...)
          |                 |                  |
          +--------+--------+---------+--------+
                   v                  v
            PAIRED DELTA GATES   ABSOLUTE FLOORS
            (CI90 excludes 0,    (lift >= 1.5x,
             identical rows)      AUC >= 0.55)
                   |                  |
                   +--------+---------+
                            v
              FRESH ONE-SHOT GEN-3 HOLDOUT
              (scored once, after every
               decision above froze)
                            |
                            v
              promote / refuse -> record ->
              regrade -> v3-vs-v2 board
```

**Honest possibility space:** if insider flow predicts doublers on this corpus, lift and the
Accuracy grade rise and the receipts can finally say "insiders net-bought in the window". If it
does not, the weight stays near zero and that non-result is published with the same prominence -
either way the answer is bought, not guessed. The boosted family only takes the seat by beating
the champion with CI separation on rows neither has ever seen.

**Still dark after gen-3:** government (EDGAR-CIK <-> USAspending bridge designed, queued),
adoption (sources paywalled), and the survivorship boundary (needs a paid delisted corpus or a
CIK-anchored EDGAR+OTC build - a spend/scope decision).

**Grades:** pending - they move only when the holdout speaks.

---

*Template for future generations: The question / The verdict (table) / How it worked (diagram) /
What it taught us / Grades. Keep diagrams plain ASCII so they survive every copy-paste.*
