# Model Generation Log

One dated entry per **model generation**: a full cycle of the standing loop
(`build -> retrain -> compare -> eval -> one-shot holdout -> record`, plus the promotion decision).
This is the narrative layer over the numbers; the numbers themselves live in
`lyra-evals/model-metrics-history.jsonl` (keyed by corpus sha256) and in each generation's
snapshot folder here (`gen-NNN/`). The visual head-to-head for each generation lives in
`lyra-evals/boards/`.

Purpose: look back at what changed, how often it changed, and which changes produced the
biggest effects, so future tuning starts from evidence instead of memory.

Rules:

- Entries are append-only, newest first. Never edit a past entry's numbers; add a correction line.
- Every claim links to its evidence (metrics record, report snapshot, research doc, board).
- The "biggest observed effect" field is the retro that powers future optimization decisions.
- Deltas whose CI90s overlap are recorded as **directional**, never as proven improvements.

---

## Generation 2 - 2026-08-01/02 - corpus `a297e8ad`

**What changed vs gen 1** (data only; the deployed model's weights stayed frozen):

- Theme domain lit: point-in-time SEC SIC-code hot-theme mapping (`submissions_source.py`).
- Narrative domain lit: causal market regime from SPY 200-day SMA + drawdown (`regime_source.py`).
- Fundamentals upgraded: quarterly-YoY preferred over annual, freshness-aware (`edgar_source.py`).
- Market caps recomputed (shares-as-of x split-corrected raw close) - shifted tier membership.
- Challenger retrained on the new corpus (learned theme +0.08, narrative -0.19).

**Results (holdout, one-shot, n=6,165, base 13.4%):**

| model | lift@5% | CI90 | ECE | verdict |
|---|---|---|---|---|
| champion (real-v1, frozen) | 1.936x | [1.55, 2.29] | 0.017 | confirmed higher; stays champion |
| gen-2 retrained challenger | 1.912x | [1.59, 2.32] | 0.048 | REFUSED (dev WF 1.27x; paired test below) |
| reference scorecard | 0.678x | [0.49, 0.92] | 0.248 | still refuted as a ranker |

**Paired difference test (added retroactively 2026-08-02, methodology upgrade):** the original
refusal note compared the two marginal CIs for overlap, which is not a valid test of difference.
Re-tested with the paired symbol-clustered bootstrap on identical holdout rows:
delta-lift (challenger minus champion) = -0.02, CI90 [-0.24, +0.28], does not exclude zero -
NO detectable difference. The refusal stands via the pre-committed must-beat rule (a tie keeps the
incumbent), now on valid statistics. From gen-3 the difference verdict is always
`paired_delta_ci.ci_excludes_zero`, produced automatically by `compare` and `eval`.

**Biggest observed effect:** richer inputs to a frozen model moved holdout lift 1.72x -> 1.94x
(+0.22, within CI overlap - directional). The champion consumes the new domains only through
coverage completeness (its heaviest weight, +0.39) plus quarterly fundamentals; relearned weights
LOST to frozen weights + better data. Lesson recorded: at this corpus size, data quality moves the
needle more than re-fitting.

**Watch-outs recorded:**

- Tier story flipped (gen-1 "signal lives in micro/small" -> gen-2 large-cap tier leads at 2.84x)
  under the market-cap recomputation. Unstable under an input correction = not a conclusion.
  A tier-stability check is required before any tier claim ships.
- Champion dev-split numbers are in-sample-flattered post-promotion; holdout is the only fair fight.
- Calibration improved to ECE 0.017 and every one of 7 holdout quarters beat its own chance rate
  (gen-1's weakest quarter had not).
- Snapshot note: `gen-002/champion-vs-challenger.json` was regenerated 2026-08-02 with the
  corrected in-sample-flattery note and the paired-delta block (numbers unchanged - the run is
  deterministic). `gen-002/scores-holdout.jsonl` archives per-row frozen-model scores so gen-3 can
  run a PAIRED cross-generation test on identical windows; gen-1 never archived scores, which is
  why champion 1.72x (gen-1) vs 1.94x (gen-2) remains a marginal comparison only - the "the jump
  came from data" claim is supported (same frozen artifact, same windows, richer features) but its
  size is untested pairwise, and the gen-1 corpus rows were not archived to fix that after the fact.
- Selection-bias ledger opened (`lyra-evals/model-attempt-log.jsonl`): every retrain / compare /
  holdout scoring / promotion decision is now logged, not just promotions, so the trial count
  behind any confirmed number is auditable. Gen-1 and gen-2 predate the ledger; their attempt
  counts are reconstructed only in the research docs.

**Grades:** Accuracy B- · Calibration A- · Process A · Estimator D+ · Data C- · Honesty A
(from C+ / B+ / A- / D+ / D / A at gen 1).

**Evidence:** `gen-002/` (holdout + dev + compare report snapshots) ·
`lyra-evals/model-metrics-history.jsonl` record 2 ·
board `lyra-evals/boards/model-eval-board-v2-vs-v1.html` ·
`lyra-modelling/research/2026-08-01-real-history-backtest-and-real-v1-champion.md` (gen-2 addendum).

---

## Generation 1 - 2026-08-01 - corpus `ef1b5c52`

**What changed:** everything - the first real-history evaluation this project ever ran.
Built the point-in-time corpus (27,420 rows, 991 US symbols, 2016-2025, first-touch +100%/12mo
labels, purged+embargoed calendar-day walk-forward, one-shot holdout 2024+, symbol-clustered
bootstrap CIs, curated-hindsight quarantine).

**Results (holdout, one-shot):**

| model | lift@5% | CI90 | verdict |
|---|---|---|---|
| real-v1 challenger (trained on real outcomes) | 1.718x | [1.38, 2.05] | PROMOTED to champion |
| synthetic champion | 0.702x | [0.47, 0.92] | refuted, retired |
| reference scorecard | 0.678x | [0.49, 0.89] | refuted as a ranker (kept as feature layer) |

**Biggest observed effect:** switching the training signal from synthetic scorecard assumptions to
real matured outcomes - the only change that turned anti-predictive into predictive. Second-order:
the adversarial leakage descent (2.77x -> 1.47x -> 1.35x -> 1.31x dev) - every "improvement" bigger
than ~2x from this feature set was a leak, which became a standing rule.

**Watch-outs recorded:** survivor-biased universe (precision is an optimistic bound); five domains
honestly dark at weight 0.00; the two heaviest hand-designed bets (technical, liquidity) flipped
negative on real outcomes.

**Grades:** Accuracy C+ · Calibration B+ · Process A- · Estimator D+ · Data D · Honesty A.

**Evidence:** `gen-001/digest.json` (per-generation report snapshots begin at gen 2; gen 1's
dev/holdout report files were overwritten by the gen-2 run before this archive existed - the
digest, the metrics-history records 0-1, the research doc and the v1 board preserve the numbers) ·
board `lyra-evals/boards/model-eval-board-v1.html` ·
`lyra-modelling/research/2026-08-01-real-history-backtest-and-real-v1-champion.md`.
