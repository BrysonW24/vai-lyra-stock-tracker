# Model-analysis harness - audit

_2026-08-01 · Lyra v0.101.0 · read-only assessment + one additive behaviour eval_

## The question

> Does the model-analysis harness scan the actual whole landscape? Is the data captured, analysed and
> produced properly? Where are the issues and gaps - and is the analysis checked via evals on the
> models' behaviour?

## Verdict in one paragraph

The **analysis machinery is real, honest and thoroughly tested**; the **landscape it runs on is not
real yet**. Two model families exist: the Oversold-Recovery scanner (Live) and the Emerging Winner
Engine (six models, shadow-live). The Emerging Winner pipeline (M1 domain scorecard -> M2 classifier
-> M3 analogue -> M4 ranker -> M5 risk gates -> M6 timing), the training machinery (walk-forward with
purge/embargo, rare-positive validation, floor gates, drift guard) and the immutable point-in-time
ledger are all genuinely built, pure, and pinned by **431 green Python tests** (420 existing + 11
added here). The single headline gap is **coverage**: neither model scans the whole market. The
Emerging Winner worker scores a **hardcoded 3-candidate illustrative set**, and the scanner scans a
**hardcoded ~63-ticker shortlist** - the real point-in-time small-cap universe (SEC EDGAR, delisted
names, Form 4/13F, USAspending) is Phase 1 and unbuilt. This is the data gate, and the code says so
honestly everywhere.

## Update - real-universe scan landed (same day)

The landscape-coverage gap below (gaps #1-#2) is now **addressed in code**. The Emerging Winner worker
scans the **real, dynamic SEC-listed universe** instead of a hardcoded illustrative set:
- `workers/emerging_winner/universe_source.py` fetches the SEC `company_tickers.json` live (~10,400
  US-listed companies, small-caps included), cached ~24h, so new registrants are picked up
  automatically; emergence-first ordering puts the curated small-cap names the engine targets ahead of
  the rest of the listing.
- `workers/emerging_winner/feature_source.py` assembles **real market features** (the scanner's own
  indicator maths) per name, coverage-honest: it leaves the deep domains ABSENT so they read
  `unavailable`, never a guessed value.
- `main.load_candidates` uses it under `EW_REAL_UNIVERSE=1` (bounded by `EW_UNIVERSE_LIMIT`), with an
  honest fallback to the labelled illustrative set when offline.
- **Proven:** a live scan of 16 real small-caps (LUNR, RGTI, SERV, BKSY, APLD, POWL, RDW, FLNC, LEU,
  UUUU, NB, CAMT, ONDS, HSAI) completed end to end in ~9s; every name returned **low resemblance,
  4/10 domains covered, risk = review** - coverage honesty holding on real data (no deep domains ->
  no fabricated conviction). Pinned by `tests/test_emerging_winner_real_universe.py` (CI-safe stub).

**What this does and does not close:** the **universe/landscape** gap is closed - the engine now scans
the real market, small-caps included, dynamically. The **depth** gap remains: with only market-derived
domains, winner-resemblance output is uniformly low-confidence until the deep domains (SEC filings,
insider flow, contracts) and a **delisted-inclusive point-in-time history** (the survivorship-safe
training corpus) are sourced. That is a paid-data buy, not engineering. Enabling the real scan in
production (`EW_REAL_UNIVERSE=1` on the worker) is a founder/ops decision - the capability is shipped and
proven; arming it stays gated.

## 1. Landscape coverage - the core gap (original assessment, now addressed - see Update above)

| Model | What it scans today | Real market data? | Evidence |
|---|---|---|---|
| Oversold Recovery (Live) | A hardcoded **~63-ticker** curated list (49 large-cap tech + 14 small-cap "emergence" names: POWL, APLD, LUNR, RDW, BKSY, FLNC, LEU, UUUU, NB, CAMT, ONDS, HSAI, SERV, RGTI) | **Yes** - real hourly OHLCV via yfinance for those 63 | `workers/stock_scanner/universe.py` |
| Emerging Winner (6 models, shadow-live) | A hardcoded **3-candidate** illustrative set (QBIT / HYPE / TCNO) with hand-authored features | **No** - illustrative features, not live market data | `workers/emerging_winner/main.py:34-68` |

So "scans the actual whole landscape" is **NO** for both, in different degrees:
- The scanner sees real data but only for 63 hand-picked names - any high-upside name outside the list is never scored.
- The Emerging Winner engine never touches real market data at all; it proves the pipeline end to end over an illustrative universe and logs it to the ledger, **clearly labelled illustrative** (`main.py:8-13`, `RUN_NOTE`, `ENGINE_VERSION` = `...-shadow-live`).

The honest gate is the same one the `/models` roadmap already states: **Phase 1 - the point-in-time
dataset** (small-cap universe incl. delisted names + first-touch labels). `load_candidates()`
(`main.py:65`) is the single swap point: replace the illustrative set with the real feature assembler
and the entire downstream pipeline, contract and ledger are unchanged.

## 2. Data captured / analysed / produced - properly?

**Captured.** Scanner: real, provider-abstracted OHLCV with completeness guards
(`test_market_data_completeness.py`, `drop_incomplete_last_candle`). Emerging Winner: illustrative
feature dicts today; the real capture path (SEC/USAspending/Form 4/13F) is unbuilt.

**Analysed.** Strong. The Emerging Winner pipeline (`engine.py`) is pure and deterministic; the
classifier runs a **trained champion** logistic when the frozen artifact
`src/lib/generated/emerging-winner-model.json` is present (it is), with a transparent reference-logistic
fallback (`classifier.py`). Coverage honesty is real: a domain with no data reads `unavailable` and is
never counted as a weak trait (`test_scorecard.py::test_unavailable_is_not_a_weak_trait`). The trainer
(`train.py`) is legitimate ML engineering - walk-forward with **purge + embargo** (Lopez de Prado AFML
Ch. 7), rare-positive validation (precision@k, lift, calibration, AUC/Brier), and a **pre-publish floor
gate** (min AUC 0.55, min lift 1.5) so a bad retrain fails loudly. The label excludes delisted/illiquid
"winners" - survivorship honesty baked into the labeler (`dataset.py`, `test_dataset.py`).

**Produced.** Correct. Output is an immutable, append-only ledger (migration 056) designed as a
point-in-time feature + outcome store so future training has **no look-ahead** by construction. The
worker is fail-loud: an enabled run that persisted zero predictions returns non-zero
(`main.py:96`, `test_worker_honesty.py`). A **drift guard** re-runs the champion's fixtures through the
deployed inference path in CI so training-time and serving-time models can never silently diverge
(`monitor.py::verify_drift_guard`).

**Caveat that matters:** because the Emerging Winner classifier is trained on the **reproducible
bootstrap** dataset (a data-generating process that encodes the winner hypothesis), not on real matured
outcomes, it is honestly a *trained model on synthetic data* - `reference-v1`. It proves the learning +
calibration + walk-forward machinery generalises out-of-sample; it has **not learned from real
winners**. Live calibration (`monitor.py::model_health`) is therefore unmeasured - there are no real
matured outcomes in the ledger to calibrate against yet.

## 3. Checked via evals on model behaviour?

**Yes, comprehensively.** 420 existing worker tests pass, and the model behaviour specifically is
pinned, not just the plumbing:
- Classifier: strong > weak, **monotonic**, contributions sorted/bounded, thin coverage -> low
  confidence + capped, **uses the trained champion when present**, reference fallback when absent.
- Risk gates: **blocks the pump**, missing data -> INSUFFICIENT (never a silent pass), healthy name
  passes liquidity.
- Domains: 10 domains, all scores bounded, **unavailable != weak**, completeness counts only available.
- Pipeline: strong surfaced + ranked, **pump blocked + excluded**, **deterministic**, serialises all
  sections, rank_universe orders surfaced-first.
- Timing (M6): shadow-only, **never moves priority or ranking**.
- Training: walk-forward learns, precision@k beats random, artifact export, drift fixtures.

**Added by this audit** (`tests/test_emerging_winner_behaviour.py`, 11 tests, all green): a property /
fuzz **behaviour contract** that complements the example-based suite - it runs the engine over 200
randomised feature dicts plus degenerate inputs and asserts, for *every* input: output fields within
honest bounds (no NaN/inf, probability in range, similarity 0-100, distribution within its documented
clamps and ladder-ordered), determinism (byte-identical serialisation), the mandatory risk half is
never empty, `blocked <=> not surfaced`, an all-missing read is low-completeness and fabricates no
strong domain, a strong candidate out-resembles a weak one, and - the landscape-coverage boundary guard
- the shipped universe stays **honestly labelled illustrative** (fails loudly if someone wires a
real-looking universe without the honest label or relabels the engine as trained-on-real-winners).

What the evals do **not** assert (and cannot, honestly, today): real-world predictive accuracy. That
needs the Phase-1 dataset and 12 months of matured outcomes. The evals prove the pipeline is
**correct and honest**, not that it **predicts real winners**.

## Gaps, ranked

1. **[coverage, blocking] The Emerging Winner engine does not scan real market data.** It scores a
   hardcoded 3-candidate illustrative set. Fix = Phase 1 (point-in-time small-cap feature assembler);
   single swap at `main.load_candidates`.
2. **[coverage, high] The scanner universe is a hardcoded ~63-ticker shortlist.** Real data, but not
   the whole small/micro-cap landscape - names outside the list are never scored. Fix = a real universe
   loader (screener/exchange listing) feeding `universe.py`.
3. **[learning, medium] The classifier champion is trained on bootstrap (synthetic) data, not real
   winners.** Honest and labelled, but it has learned nothing from real outcomes. Fix = accumulate
   ledger predictions + mature outcomes (12-month horizon), then retrain on `assemble_training_rows`.
4. **[measurement, medium] Live calibration is unmeasured.** `model_health` has no real outcomes to
   score against, so the shadow-live promotion gate cannot fire yet. Follows from #1 and #3.
5. **[coverage, low] Data-source ingestion for the Emerging Winner domains** (SEC filings, Form 4/13F,
   USAspending) is unbuilt; government-awards ingestion exists on the scanner side only.

## What is genuinely strong (do not rebuild)

The pipeline purity + determinism, coverage-honest domains, the trained-vs-reference champion loader
with a CI drift guard, the walk-forward/purge/embargo trainer with a floor gate, the no-look-ahead
point-in-time ledger with a survivorship-honest labeler, and the fail-loud persistence. The machinery
is production-grade; it is waiting on data, not on engineering.

## Bottom line

The harness is **honest and correct, not yet real**. Every gap traces to one root: the Phase-1
point-in-time dataset. The analysis is produced properly for what it runs on, the behaviour is checked
by 431 green evals, and the code refuses to pretend the illustrative universe is the market. Turning
"resembles a reference archetype" into "resembles these real tickers, here are their filings" is the
data gate - the same gate the `/models` roadmap and the Model Lab surface already state plainly.
