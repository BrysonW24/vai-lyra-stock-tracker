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

**Weak-calibration measurement (added 2026-08-02, from the archived per-row scores - no model
re-selection involved):** the champion on the gen-2 holdout has calibration-in-the-large -0.05
(level essentially perfect), Spiegelhalter z -0.90 / p 0.37 (moderate calibration not rejected),
but recalibration **slope 0.755, CI90 [0.57, 0.98] by symbol bootstrap - the interval excludes 1**:
mild overconfidence in the spread that ECE could not see. Prevalence-transfer stress test: after
odds-rescaling to a 3% deployment base (50 downsampled draws), median ECE 0.006 and 0/50
Spiegelhalter rejections - the restatement transform transfers at the moderate level. Consequences:
Calibration stays A- with sharpened requirements for A - (1) slope CI containing 1, or
slope-corrected serving, at gen-3; (2) live-prevalence validation from the aging ledger. The slope
shrink (logit scaling by ~0.75) is a candidate gen-3 serving change; it must ride the standing loop
like any other change, never be hot-patched.

**Estimator bake-off (added 2026-08-02, dev split only - the holdout was not touched):** the
depth-2 boosted-trees family ran the identical purged walk-forward the logistic retrain ran.
Result: lift 1.344x / ROC 0.585 / PR-AUC 0.116 / worst cohort 0.055 vs the linear retrain's
1.27x / 0.548 / 0.106 / 0.000 - the nonlinear family wins the family fight on dev (unpaired;
per-row WF score archiving is a gen-3 protocol addition) but fails the 1.5x absolute floor and
does not threaten the frozen champion. Estimator regraded D+ -> C- on this evidence; the seat
still requires winning gen-3's fresh one-shot holdout. The attempt self-logged to the ledger.

**Gen-3 data preamble (2026-08-03): government domain cache complete.** USAspending bridge fill
finished for all 991 corpus symbols: 207 matched to UEI-bearing federal recipients (20.9%, inside
the feasibility probe's predicted 15-30% band), 784 honest no-matches, 0 failures. Raw award
transactions cached immutably per recipient; gen-3's corpus build reads them via cached_only with
action_date <= T discipline. v1 totals remain a documented floor (subsidiary booking).

**Threshold sweep - protocol pre-committed 2026-08-03 BEFORE any result was seen:** barriers
+10/20/30/50/100/200/300 percent, CLOSE-based plain first-touch within 252 forward trading bars
(ruin and conjuncts ignored - identical treatment across thresholds so cells are comparable;
rows without 252 forward bars excluded identically). Per (tier x threshold) cell on the gen-2
corpus: n positives, within-tier base rate, champion lift and vol-null lift at the top-5%
within-tier cut, SEDI for both (rare-event-stable comparison across thresholds), paired
champion-minus-vol delta (300 symbol-clustered boots) only where n_pos >= 30 - thinner cells
report insufficient-evidence, never a number. Dev split = power context; the HOLDOUT grid is the
verdict (single pre-registered look, ledger-logged) against the standing predictions recorded in
lyra-modelling/THRESHOLD-SWEEP-EXPERIMENT.md and task #18: skill peaks ~+30-50% in micro/small;
+10% collapses to market direction; +200/300% too thin to claim. Results appended below when
the sweep lands.

**Threshold sweep RESULTS (2026-08-03, single pre-registered holdout look, 27,007 usable rows,
grid archived at gen-002/threshold-sweep-grid.json):**

- **Headline discovery: the champion's edge lives in the QUALITY CONJUNCTS, not the touch.**
  Under the sweep's plain first-touch label the champion beats the within-tier jumpiness sort
  NOWHERE in the tier x threshold grid (micro leans +0.06..+0.08 at +10-30%, insignificant;
  everywhere else neutral to significantly negative; vol wins outright at +50/+100% in every
  tier, e.g. micro +100%: vol lift 1.55 vs champion 1.25). Yesterday's within-tier positive
  leans at +100% used the CORPUS label (first-touch AND still-listed AND liquidity-grew) - so
  what the model actually knows is which risers STAY REAL, not which prices touch a barrier.
  Raw barrier-touching is volatility physics; the conjunct label is where skill can exist.
- Pre-registered predictions scored: "+10% collapses to market direction" CONFIRMED (base rates
  81-83%, SEDI ~0 for both models); "+200/300% too thin" CONFIRMED (n_pos 4-26 per tier-cell);
  "vol-neutralised sweet spot at +30-50%" REFUTED - there is no threshold where champion
  significantly clears the vol null under plain touch.
- Base-rate reality for the slider: plain-touch bases are huge (micro: 81% touch +10%, 31%
  touch +100% within a year) - a slider showing P(touch +X%) is mostly showing volatility, and
  the UI must say so. Honest product split: "chance it touches +X%" (one conditional model,
  vol-dominated, fine to show) vs "chance it is a real emerging winner" (the conjunct label,
  the only place the model's skill claim attaches).
- Mid/large: champion significantly LOSES to vol at multiple thresholds (mid +100%: delta
  -2.09, CI excludes zero) - reinforcing the standing no-claim rule outside micro/small.
- Gen-3 implication: the flagship label (conjunct +100%) SURVIVES as the right target; the
  sweep argues for adding the conjunct treatment to any future threshold arm rather than
  re-aiming at a lower plain-touch barrier.

**The volatility null (2026-08-02) - the finding that regraded Accuracy B- -> C+:** a barrier
label is mostly a volatility measurement (reflection principle: a driftless wild stock touches
+100% far more often than a calm one, no information involved), so random selection was the wrong
chance bar. Measured, parameter-free (63-day trailing sigma, pre-committed window, one logged
holdout look): pooled holdout 1.41x CI90[1.09, 1.73] (dev-era 2.64x - vol's edge is regime-
fragile where the champion's held). Champion vs vol PAIRED on identical rows: +0.48 CI90[+0.05,
+0.92] - significant skill beyond jumpiness, thin floor. WITHIN-TIER paired verdicts: micro +0.31
[-0.38, +1.06], small +0.16 [-0.50, +0.75] (lean positive, underpowered), mid -1.29 [-2.90,
+0.21], large -2.96 [-5.92, -0.46] SIGNIFICANT LOSS - the gen-2 "large-tier 2.84x" was the null
in disguise (vol alone: 6.15x within large). Institutionalised: volatility_null is a standing
reference model in every eval with per-tier slices + within-tier paired blocks; STANDING RULE -
the product claims no tier until the model beats that tier's own jumpiness-sort, paired.
Gen-3 pre-registered arm: add trailing 63d sigma as an explicit feature to the retrains; if
technical/liquidity negative weights collapse, they were vol proxies all along (they survive =
gen-1's reading strengthened, now with a control). Cross-ref: the threshold-sweep design and
vol-null arithmetic live in lyra-modelling/THRESHOLD-SWEEP-EXPERIMENT.md; USAspending name-bridge
feasibility (government domain) CONFIRMED same day - see
lyra-modelling/research/2026-08-02-usaspending-name-bridge-feasibility.md (15/15 contractor
recall, dated awards by recipient_id, false-negative subsidiary risk documented).

**Boosted hyperparameter sweep - protocol pre-committed 2026-08-02 BEFORE any result was seen
(garden-of-forking-paths guard):** four configs on the dev walk-forward only, every attempt
ledger-logged: B={rounds 240, lr 0.05}, C={min_leaf 50}, D={rounds 200, n_thresholds 32},
E={rounds 300, lr 0.03, min_leaf 40}. Selection rule: highest dev WF lift, ROC-AUC tiebreak.
The winner (vs default A: 1.344x) is FROZEN as the gen-3 boosted config; no further sweeps once
the gen-3 corpus exists.

Sweep results (all dev WF, n_oos 17,495, ledger-logged): A default 1.344x / ROC 0.585 / worst
0.055 · B 1.319x / 0.586 / 0.057 · C 1.344x / 0.585 / 0.067 · D **1.393x / 0.588 / 0.026** ·
E 1.344x / 0.584 / 0.034. **Winner by the pre-committed rule: D = {rounds 200, n_thresholds 32}**
(highest lift, also highest ROC). Recorded watch-out: D has the weakest worst-cohort of the five -
if gen-3's per-cohort floor bites, that is where. Still below the 1.5x absolute floor; the seat
remains unearned.

**Grades (regraded 2026-08-02):** Accuracy B- · Calibration A- · Process A · Estimator C- ·
Data C- · Honesty A (from C+ / B+ / A- / D+ / D / A at gen 1; Estimator moved D+ -> C- on the
bake-off evidence above).

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
