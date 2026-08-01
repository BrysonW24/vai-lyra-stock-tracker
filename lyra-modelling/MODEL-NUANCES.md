# Model Nuances - the fine print that makes the numbers real

Every rule below exists because skipping it produced (or would have produced) a wrong number that
LOOKED right. This is the readme for the small, specific disciplines the Emerging Winner models
are generated under. If a future change violates one of these, the burden of proof is on the
change - most of them are pinned by tests, and the pins name this class of failure.

Companion docs: [`GENERATIONS.md`](./GENERATIONS.md) (per-generation story + diagrams) ·
[`NORTH-STAR.md`](./NORTH-STAR.md) (destination + earn-gates) ·
[`../lyra-evals/generations/GENERATION-LOG.md`](../lyra-evals/generations/GENERATION-LOG.md)
(the numeric audit trail).

---

## 1. Time is the enemy (point-in-time discipline)

- **Every feature is computed as-of the entry date T.** The feature clock is the entry bar's own
  date - never "today", never the corpus build date. One wrong clock silently teaches the model
  the future.
- **EDGAR facts obey `filed <= T`.** A company's Q3 revenue exists in our features only after the
  date the filing physically reached the SEC - not the quarter it describes. Freshness windows
  (annual 330-400d flows, quarterly 75-105d) with explicit dedupe rules keep restatements from
  time-travelling.
- **Purge + embargo are measured in CALENDAR days (430 + 15).** Our labels look 12 months forward,
  so any training row whose outcome window overlaps a test row must be dropped. The original
  trading-day spans under-purged by ~12% of rows - a real leak, found adversarially, now pinned.
- **52/53-week fiscal drift is handled by date-gap clustering,** not naive year arithmetic -
  companies with 53-week fiscal years otherwise misalign their own history.
- **The market regime feature is causal:** SPY vs its 200-day SMA plus drawdown, computable on the
  entry date with zero hindsight. Fun fact the model learned: risk-on quarters were WORSE for
  finding 12-month doublers in-sample (narrative weight -0.19).

## 2. Prices lie quietly

- **Yahoo's "raw" Close is still split-adjusted** even with auto_adjust=False. True historical
  raw close = Close x the product of all LATER split ratios. Found because POWL's market cap came
  out 3x wrong; now market cap = EDGAR shares-as-of x reconstructed raw close, pinned.
- **Stooq raw closes are refused** (raw_close=None): their series anchor to the current split
  state, which leaks future splits into past prices.
- **A transient fetch failure is None; a genuinely empty history is [].** The two must never be
  confused: a DNS blip once poisoned ~1,251 cache entries as "no history". Errors are never
  cached; empty is cached only when the source really said empty; retries back off and abort on
  an error streak.
- **Bot walls are respected, never scripted around.** When Stooq raised one, we switched sources.

## 3. Labels that mean what they say

- **A "winner" = first touch of +100% within 252 trading days** (with -80% ruin checked first),
  AND still listed, AND liquidity grew - the conjuncts stop "doubled while dying" names from
  teaching the model.
- **Label maturation shares ONE implementation** between the historical corpus and the live
  outcome job - the nightly ledger matures through the exact code that built training history.
- **The corpus is survivor-biased and says so everywhere:** the universe is the CURRENT SEC
  listing, so the ruin class is censored and every precision number is an optimistic bound. The
  free delisted-data probe was decisive: yfinance returns NOTHING for SIVB or FRC, and recycled
  tickers (BBBY) are an identity trap - killing this bias needs a paid source or a CIK-anchored
  EDGAR+OTC assembly. Identity is CIK-anchored, never ticker-anchored.

## 4. Selection bias has to be engineered against

- **Curated hindsight names never train.** The hand-picked "emergence" list exists BECAUSE those
  names won - their rows are flagged, excluded from all training, and reported only as a labelled
  disclosure slice. The random-sample slice is ALWAYS the headline.
- **Any lift above ~2x from this feature set triggers a mandatory leakage decomposition** before
  the number is reported anywhere. Origin story: the first backtest printed 2.77x, and the
  adversarial waterfall dismantled it to 1.31x (stale-corpus theme leak, curated names, purge
  bug) - the smaller number was the true one.
- **The holdout is scored ONCE per corpus generation,** after every decision froze. Nobody
  iterates against it. A fresh generation earns a fresh holdout; an old one is never revisited.
- **Once a real-data champion is promoted, its dev numbers are in-sample-flattered** (it trained
  on those rows) - dev champion-vs-challenger views carry that warning and the holdout is the
  only fair fight.
- **Every attempt is ledgered** (`lyra-evals/model-attempt-log.jsonl`): retrains, comparisons,
  holdout scorings, promotions AND refusals - so the trial count behind any confirmed number is
  auditable, and one clean confirmation can't hide forty tries.
- **Hyperparameter sweeps are pre-committed:** configs and the selection rule are written into
  the generation log BEFORE any result is seen, the winner is frozen for the next generation, and
  no sweeps run after the next corpus exists.

## 5. Statistics that do not flatter

- **Confidence intervals are symbol-clustered block bootstraps.** A symbol's adjacent quarterly
  windows share most of their forward path; row-level n wildly overstates the evidence. Resample
  whole symbols or the CI is fiction.
- **Two models on the same rows are compared with a PAIRED bootstrap of the difference** - gate on
  CI90(delta) excluding zero. Overlap of two marginal CIs is NOT a test of difference and will
  eventually block a genuinely better challenger silently (pinned with a constructed case where
  the marginals overlap but the paired test detects). On a tie, the pre-committed must-beat rule
  keeps the incumbent.
- **PR-AUC leads, ROC-AUC follows.** At a 13.4% base rate ROC-AUC is systematically flattering;
  the headline discrimination stat is average precision against the base-rate floor.
- **ECE alone cannot certify calibration.** It checks binned means (moderate calibration) and is
  blind to spread errors. Weak calibration is measured too: recalibration slope + intercept +
  Spiegelhalter's z. Current finding: slope 0.755 CI90[0.57, 0.98] - the champion's extreme
  probabilities are mildly too extreme even though ECE is 0.017.
- **Every precision is restated at deployment prevalence** (~3% real-universe base vs 13.4%
  corpus base) via odds rescaling - and that transform was stress-tested (50 downsampled draws,
  median ECE 0.006, zero rejections), not assumed.
- **A cohort zero can be pure chance.** Per-quarter cuts carry their null expectation (k x that
  quarter's own base rate); a zero at k=15 is only meaningful next to its null.
- **A result that reverses when an input is corrected was never a result.** The cap-tier story
  flipped between generations when market caps were recomputed; it ships flagged as an open
  stability question, not a finding.

## 6. Dark domains are honest zeros

- **Unavailable is never a weak trait.** A domain with no data scores `unavailable`; completeness
  is computed over available domains only; a thin read can never produce a "strong candidate".
- **The model refuses to pretend:** domains whose pipelines are dark carry learned weights of
  exactly 0.00 - and the coverage-completeness feature (weight +0.39, the champion's heaviest
  positive) is how "we can actually see this company" earns credit honestly.
- **Theme membership comes from SEC SIC codes** - a deliberately NARROW map (semis, aero/space/
  defence, power, energy, compute). No software-becomes-AI inflation; unmapped stays unmapped.
  The curated theme map is BANNED from training by construction (hindsight leak).
- **Insider sponsorship counts only open-market P/S transaction codes** from Form 4 XML - option
  grants and administrative noise excluded. Corpus windows are all-or-nothing (a partially cached
  window is None, never a fake partial number); a known-empty index window is a REAL 0.0; live
  truncation is labelled. The signal is naturally lumpy - insiders trade in post-earnings windows,
  so bursts and silences are informative, and the parser is IDENTICAL between the 205k-document
  historical backfill and tonight's live scan.

## 7. Serving equals training

- **Drift fixtures pin the frozen artifact to the serving path:** every artifact ships with
  random + boundary fixtures the deployed inference code must reproduce (checked to 1e-6, the
  contribution reconciliation to 1e-9).
- **Per-feature contributions reconcile exactly with the served probability** - for the logistic
  and for the boosted trees (path steps split among path features).
- **Behavioral pins test the model, not just the pipeline:** identity invariance (a ticker can
  never move a score), batch invariance (no cross-row coupling can sneak into serving), and
  direction sweeps that assert sign-consistency with the learned weights - with technical and
  liquidity explicitly excluded from "positive expected" because their NEGATIVE signs are
  validated findings from real outcomes, not bugs.
- **The estimator is a seam, not a fork:** logistic and boosted depth-2 trees ride the identical
  lifecycle (train, purged walk-forward, floors, frozen artifact, fixtures, serve). Depth 2 is a
  choice with a reason: depth-1 stumps are mathematically additive and cannot represent the
  interactions (fundamentals x liquidity) the winner hypothesis cares about - pinned by an XOR
  target that provably defeats the linear model.
- **Probability calibration is artifact-carried and monotone:** an optional logit-linear block
  (validated at load, slope > 0 enforced) can shrink the spread without ever reordering ranks -
  and it must EARN its way in through the standing loop, never be hot-patched.

## 8. Operational honesty

- **The SEC's published fair-use ceiling (10 req/s) is a hard pace limit** - currently run at the
  ceiling with a sleep floor that makes exceeding it impossible by construction. No parallel
  scrapers, no IP rotation, ever.
- **Caches are immutable and resumable;** a 205k-document backfill can be killed and restarted at
  any point and loses nothing.
- **Surfacing is founder-gated on LIVE calibration** - never on backtest numbers. The engine
  informs; it never decides. Research resemblance scores, never advice, never price targets.
