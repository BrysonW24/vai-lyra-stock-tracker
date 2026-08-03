# Build Backlog - the modelling path forward

```
created: 2026-08-03 (after generation 3)
owner:   the standing loop (/model-generation-eval)
rule:    tickets are ordered by EVIDENCE, not appetite. Re-order only when new evidence lands.
```

## The diagnosis this backlog is built on

Generation 3 refuted the thesis we had run on for three generations.

| What we believed | What gen-3 measured |
|---|---|
| Data is the binding constraint | Three generations of data enrichment moved the deployed model by a statistically undetectable amount (paired: -0.18, CI90 [-0.57, +0.20]) |
| The estimator is fine, keep it simple | On IDENTICAL data the linear refit got WORSE (1.23x, failed both floors) while depth-2 trees hit 2.13x holdout / 1.356x walk-forward |
| We are collecting the right things | We collected 201,494 insider filings (1.4 GB) and feed the model exactly TWO numbers from them |
| The corpus is big enough to decide things | 6,165 holdout rows / ~830 winners cannot separate a +0.33 margin - the reason the best model ever built was refused |

**Standing conclusion:** the binding constraints, in order, are now (1) statistical power,
(2) feature representation, (3) estimator class, (4) survivorship. Not raw data volume.

**Honest scale check against professional practice.** Better than most: point-in-time
discipline, one-shot holdouts, paired difference tests, symbol-clustered CIs, pre-registration,
the attempt ledger, refusing promotion on a tie. Amateur-scale: 19 raw fields (professionals use
50-500), 991 names (investable US universe ~8,000), no delisted names, no cross-sectional
ranking, no sector neutralisation, no transaction costs.

**Expectation-setter:** the challenger's 2.13x came from one holdout era; its purged
walk-forward across folds was 1.356x. The walk-forward is the honest estimate. Do not anchor
on 2.13x, and expect the widened universe to LOWER lift while TIGHTENING intervals - that is
the trade we want, because a tight interval is what lets anything get promoted.

---

## Sprint 1 - the power + representation sprint

### T1 - Bulk insider ingestion (unblocks everything) · SIZE: M · STATUS: DONE 2026-08-03

Per-document Form 4 fetching does not scale past ~1,000 names (20 hours, two SEC throttle
waves, a hard 2 req/s tail pace). The SEC publishes **quarterly bulk Insider Transactions Data
Sets** - pre-parsed Form 3/4/5 tables since 2006, ~80 zip files.

- Build `workers/emerging_winner/insider_bulk_source.py`: download + cache quarterly zips,
  parse to a per-issuer-per-date transaction table, same immutable-cache + transient-vs-empty
  semantics as the other sources.
- Keep the existing raw-XML parser for the LIVE path (train/serve parity for today's scans);
  bulk feeds HISTORY only. Pin that both paths produce the same feature shape.
- Acceptance: insider features resolvable for >= 5,000 CIKs without a per-document fetch;
  as-of discipline pinned (`filed <= T`); spot-agreement with the existing per-document cache
  on >= 50 sampled company-quarters.
- **RESULT (2026-08-03): PASSED.** 10,109 issuers compiled from 49 quarters (2014q1-2026q1;
  2026q2 not yet published by the SEC - that lag is why the live path keeps the XML parser).
  Agreement measured on 400 company-quarters where BOTH sources genuinely cover the window:
  **396 agree, 4 disagree (99%)**. Storage is compact columnar (~95 bytes/transaction vs 278
  for objects) - the whole market, 12 years, in ~250 MB. 8 pins green.
- Watch-out from the acceptance run, worth its own ticket (T1c).

### T1c - Resolve the 4 bulk-vs-per-document disagreements · SIZE: S · NEW 2026-08-03

Four of 400 disagreed, and one is diagnostic rather than noise:

| symbol | bulk net USD | per-document net USD | reading |
|---|---|---|---|
| BYD | -6,958,562 | +6,958,562 | **same magnitude, opposite SIGN** - a sign-convention bug in one parser |
| BEN | +63 | -9,999,937 | one source sees a ~$10M disposal the other does not |
| URBN | -11,635,635 | -17,442,968 | same direction, per-doc larger |
| KFY | -1,460,000 | -2,910,422 | same direction, per-doc ~2x |

BYD is the one to chase first: identical magnitude with a flipped sign means one path is
mis-reading the acquired/disposed code (`TRANS_ACQUIRED_DISP_CD` in bulk, the A/D element in the
XML) for some transaction shape. A sign error on insider net-buy would invert the feature for
affected names - worse than missing it. Decide which parser is right by reading the underlying
filing directly, then pin the answer with a fixture.

### T1b - Fix submissions-index truncation on the LIVE path · SIZE: S · NEW 2026-08-03

Found while validating T1: `submissions_source.compact_submissions` reads only
`filings.recent` from the SEC submissions JSON and ignores `filings.files` (the older paginated
pages). High-volume filers therefore carry indexes that start recently - META 2024-05-17, JPM
2025-09-02 - and any query before that start silently returns a REAL 0.0 instead of unavailable.
History is now served by bulk (T1) so the corpus is fixed, but the LIVE scan still uses this
path. Either page the `files` array or accept a documented recency horizon and return None
(unavailable) rather than 0.0 outside it. **A wrong feature is worse than a missing one** - this
is exactly the failure that returning "unavailable" was designed to prevent.

- Acceptance: for a filer with a paginated index, a pre-horizon query returns unavailable (not
  0.0), pinned by test.

### T2 - Widen the universe 991 -> ~8,000 names · SIZE: M · BLOCKED BY: T1

The reason gen-3's challenger could not be promoted. More rows is the only fix.

- Raise the corpus sample to the full SEC-listed set that survives the price/liquidity filters.
- Expect: lift DOWN, intervals TIGHTER, cohort cells finally populated (the tier x threshold
  grid currently greys out most cells for thinness).
- Acceptance: >= 100,000 corpus rows, >= 20,000 holdout rows, and the gen-3 paired verdict
  RE-RUN at the new power (the +0.33 either separates or is honestly killed).

### T3 - Unbottleneck the features 19 -> 60+ · SIZE: L · BLOCKED BY: T2

Not before T2: 60 features on 20k rows manufactures a fake 3x. This is the ticket that turns
collected data into usable evidence.

- **Insider (currently 2 fields from 201k filings):** buy CLUSTERS (distinct insiders buying in
  a window - the effect the literature actually documents), officer vs director vs 10% owner,
  purchase size relative to holdings, time since last open-market buy, buy/sell ratio, recency
  decay.
- **Price/volume (currently ~10):** momentum at 1/3/6/12 months, realised vol at multiple
  windows, drawdown depth + recovery, distance from 52w high/low, turnover trend, volume shocks.
- **Fundamentals (currently 4):** acceleration terms (is growth accelerating), level vs trend,
  margin direction over 4 quarters, dilution rate of change.
- **Government (currently 2):** award growth, first-award recency, agency concentration.
- **Cross-sectional + sector-relative versions** of every continuous feature (rank within date,
  rank within SIC group) - a 2020 name must not be compared against a 2018 name.
- The 10 domain scores STAY for the UI and explanations. They stop being the model's only input.
- Acceptance: model vector >= 60 features; every feature as-of pinned; the drift-fixture and
  contribution-reconciliation pins still pass; feature list documented in MODEL-NUANCES.

### T4 - Estimator class, properly · SIZE: M · BLOCKED BY: T3

Depth-2 trees on 11 features was a seam test, not a model. On 100k rows x 60 features run a
real GBDT (depth, learning rate, subsampling, early stopping on a purged inner split), against
the linear baseline and the volatility null, through the unchanged standing loop.

- Acceptance: the family fight is decided on the wider corpus with the paired must-beat rule;
  any promotion carries a discharged leakage decomposition (T5).

### T5 - Discharge the leakage decomposition the 2.13x triggered · SIZE: S · BLOCKS: any >2x promotion

Standing rule: lift above ~2x from this feature set REQUIRES a decomposition. Gen-3 fired it and
only partially discharged it (three known leak classes structurally impossible + as-of pins, but
no ablation waterfall). Publish the waterfall the way gen-1's was published
(2.77 -> 1.47 -> 1.35 -> 1.31 -> 1.72): ablate each new domain and the interaction terms one at
a time, re-run dev walk-forward at each step. If 2.13x survives ablation of the new domains,
that is itself the finding.

---

## Sprint 2 - the honesty ceiling

### T6 - Kill survivorship (delisted-inclusive corpus) · SIZE: XL · FOUNDER DECISION

Every precision number is an optimistic bound until this lands. Free sources do NOT serve
delisted histories (probed 2026-08-02: SIVB and FRC return nothing; recycled tickers like BBBY
are an identity trap). Two honest paths: a paid corpus source (Sharadar-class), or a
CIK-anchored EDGAR + OTC assembly. **Needs a spend/scope decision.**

### T7 - Live calibration ledger · SIZE: S to arm, 12 months to mature · FOUNDER DECISION

Arming nightly real scans (`EW_REAL_UNIVERSE=1`) starts the clock on live-prevalence
calibration - the longest-lead item on the path to a Calibration A and the only thing that can
retire "backtest-only" from the grade. Every day unarmed is a day added to that clock.

---

## Sprint 3 - the other models (pre-registered, not started)

### T8 - Ruin-lite screen · SIZE: M

In a consensus theme, draining the junk beats ranking the winners, and ruin is the more
learnable side. Label: -80% first-touch within 12 months on the existing corpus
(survivor-censored, stated on every number). Features now fully available: dilution, shelf
registrations (S-3/S-1/424B, dated, already in the cached submissions indexes), **insider
SELLING** (now cached), volatility, liquidity, runway proxies. Own artifact, own floors, own
one-shot holdout, vol-as-null paired test. Spec: `PREDICTION-TARGETS-PREREG.md` Target 3.

### T9 - Theme-from-filings (the AI universe) · SIZE: M

SIC codes cannot see AI-native small caps - they file under generic software codes and the
honest map refuses to inflate them. Build dated theme membership from EDGAR full text
(10-K/10-Q/8-K term intensity + FIRST-MENTION DATE, `filed <= T`). First-mention date is itself
an earliness signal. Feeds Targets 1-2.

### T10 - Mega-cap sponsorship watchlist · SIZE: S

The ~20 investment-arm filers (NVIDIA, Microsoft, Amazon, Alphabet, Meta et al.) via
13F/13D/13G/8-K. Highest-value slice of the sponsorship domain at a fraction of full-13F cost.
Test H1-H4 in `PREDICTION-PRIORITIES.md`: the claim is post-disclosure DRIFT versus the tier
null, never the uncapturable disclosure-day pop.

---

## What we are deliberately NOT doing

- **Fancier models before wider data.** Gen-3 proved this fails: the seam test scored 2.13x on
  one era and 1.356x across folds. A bigger model on 11 features and 991 names is theatre.
- **Chasing the 2.13x.** It is one era. The walk-forward number is the honest one.
- **Any tier or theme claim** until that slice beats its OWN volatility null, paired.
- **Promoting on a point estimate.** The paired must-beat rule stands; ties keep the incumbent.
- **More hyperparameter sweeps** on the current corpus. The config is frozen; sweeps resume
  only on the widened corpus, pre-committed.
