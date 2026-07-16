# /signal-quality - keep the signal engine honest and measured

You are Claude Code running in the Lyra repo. Run the edge loop: measure how signals
actually resolved, tune only what the outcome data supports, keep every scoring mirror in
lockstep, and ship with the score documentation updated. This chain owns the scanner
(`workers/stock_scanner/`), the scoring/signal libs, the recovery model, paper trading,
and the Pine export. Doctrine: **the deterministic engine decides; a threshold or weight
never moves without outcome evidence.**

## What already exists (build WITH it)

- **Scoring truth** - `workers/stock_scanner/signal_engine.py` + `derived_features.py` +
  `indicators.py`; config knobs in `config.py` (`ALERT_SCORE_THRESHOLD`,
  `WATCHLIST_SCORE_THRESHOLD`, `SIGNAL_CHANGE_THRESHOLD`).
- **Outcome labeling** - `workers/stock_scanner/outcome_job.py` (`npm run worker:outcomes`)
  fills `signal_outcomes` with 1d/5d/20d/60d forward returns from the SAME stored candles
  that scored the signal, and sends `signal_followup` coaching alerts.
- **Repaint guard** - `market_data.py` `drop_incomplete_last_candle` drops the in-progress
  bar before scoring. Never weaken it.
- **Recovery model** - `workers/stock_scanner/ml/recovery_model.py`
  (`npm run train:recovery`) -> `src/lib/generated/recovery-model.json` ->
  `src/lib/ml/recovery-probability.ts`. The model annotates; it never overrides the score.
- **Pine mirror** - `src/lib/pine/lyra-strategy.ts` is a drift-guarded mirror of the Python
  score (tests pin parity). Backtest harness: `workers/stock_scanner/backtest_engine.py`.
- **Paper trading** - `workers/stock_scanner/paper_trading.py` + `src/lib/trading/`
  (paper-bot spine, risk engine, intents).

## Stage 1 - Measure before touching anything

1. Pull resolved outcomes (last 30-90 days): hit rate, median forward return, and sample
   size **per score band and per signal type** (`strong_setup` vs `watchlist_setup`).
2. Compare against the cohort baselines the follow-up coach uses (`outcome_job.py`).
3. Write down the verdict: which bands have edge, which are noise, where samples are thin.

**Gate:** every claim about signal quality has a sample size next to it. No sample, no claim.

## Stage 2 - Tune only what the data supports

1. Threshold/weight changes go in `config.py` / `signal_engine.py` with a test pinning the
   new behavior (`tests/test_signal_engine.py`, `tests/test_derived_features.py`).
2. Retrain the recovery model if features or labels changed: `npm run train:recovery`,
   then check the eval output - do not ship a model whose out-of-sample AUC regressed.
3. Backtest the change (`backtest_engine.py`) before believing it.

**Gate:** `npm run worker:test` green; any moved threshold is justified by Stage 1 numbers
in the session report.

## Stage 3 - Keep the mirrors in lockstep

Score logic changed? Update ALL of: `src/lib/pine/lyra-strategy.ts` (+ its parity tests),
`src/lib/score-breakdown.ts` (frontend explanation of components), and
`docs/walkthroughs/05-understand-the-score.md`. A mirror that lags is a lie in the UI.

## Stage 4 - Verify + ship

1. `npm run worker:test && npm run test && npm run type-check && npm run build`.
2. Version bump via `RELEASES` in `src/lib/version.ts`, `npm run release`, commit, push,
   `npm run announce`.

**Done means:** outcome numbers measured and reported, changes evidence-backed and tested,
all three mirrors + the score walkthrough updated, shipped under a version. Explainability:
the release highlights state WHAT moved and the outcome evidence WHY - a user reading
/whats-new should understand the change without reading code.
