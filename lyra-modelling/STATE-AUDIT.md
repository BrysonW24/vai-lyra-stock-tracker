# lyra-modelling - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
The deterministic oversold-recovery score itself: the one scoring law, its component weights and
bands, the cross-language (TypeScript / Python / Pine) parity guards, the daily-radar-vs-hourly-alert
timeframe split, and the raw indicator math that feeds the score. Maps to V1 (Scanner & Signal Engine)
in the gap-to-95 audit. Excludes the worker fleet plumbing, persistence and the UI rendering shell.
**Note (2026-07-29):** the modelling domain has since expanded - the founder opened a predictive-model
track alongside the deterministic score (next section).

## The predictive-model direction (new, 2026-07-29)

The founder is actively developing predictive models on the same rails as the deterministic score, per
`lyra-modelling/README.md` + `lyra-modelling/research/2026-07-29-emerging-winner-engine.md` +
`lyra-modelling/options.md` (WIP, not yet committed):

- **Model B - Emerging Winner Engine (flagship, building):** a 10-domain structural archetype classifier
  ("does this small cap resemble the companies that became outsized winners?"). First slice = a
  deterministic domain scorecard targeted at `workers/emerging_winner/` (not yet on disk).
- **Model A - Event model (designed, fast-follow):** technical-momentum probability ("will stock X hit
  +20% in 21/63/126 days?") - the `*.PNG` diagrams in this folder.
- **Decision (2026-07-29): build B first;** A is a timing tenant on the same platform - archetype says
  "future winner", event says "timing is turning now".
- **The one law extends to these:** winner-similarity / probability / percentile are engine-owned numbers
  rendered as metric-grid keys, never AI prose; the models inform, never decide, never advise.

These are pre-code (research + planning); the deterministic score below remains the only shipping model.

## Lyra as it is today
The score has one canonical author and three faithful mirrors, all pinned to a shared contract.

- **Source of truth is Python.** `workers/stock_scanner/signal_engine.py::calculate_score`
  (signal_engine.py:23-120) is the declared law; `src/lib/score-model.ts:5-6` names it explicitly and
  says the TS copy "must stay byte-for-byte faithful to it".
- **The TS scorer is a single pure function.** `computeLyraScore` (score-model.ts:60-92) is the ONE TS
  implementation. `src/lib/live-signals.ts:184-214` (`scoreSnap`) and the Pine model all delegate to or
  assert against it; the comment at score-model.ts:11-13 records that this replaced three prior copies
  (live-signals inline, pine constants, ad-hoc UI reads).
- **Weights and bands (score-model.ts:46-52, identical in signal_engine.py:36-93):** RSI cap 25 (10 for
  the 35-50 reset band, 10 rising over 1 period, 5 rising over 2); MACD cap 30 (8 histogram negative, 12
  improving-1, 5 improving-2, 5 below-signal-while-improving); price cap 15 (10 within 10% of the
  60-period low, 5 at/below SMA50*1.03); trend cap 15 (10 above SMA200 OR 5 within 5% below, plus 5 for
  SMA20 >= SMA50*0.95); volume cap 15 (5 ratio>=0.8, 5 ratio>=1.0, 5 rising vs prev candle). Final =
  `min(sum, 100)` (score-model.ts:90 / signal_engine.py:93).
- **Thresholds:** strong_setup >= 75, watchlist_setup >= 60, change threshold 8. Python reads these from
  `settings` (signal_engine.py:123-132); the TS display path hardcodes `ALERT=75 / WATCHLIST=60 /
  CHANGE=8` (live-signals.ts:25-27).
- **Golden-vector parity contract is real and bidirectional.** `contracts/score-golden-vectors.json`
  holds 5 hand-computed cases (all-null, textbook 100, flat-delta 30, below-signal-improving 45, exact
  boundary 60). Both `src/lib/__tests__/score-parity.test.ts:36-46` and `tests/test_score_parity.py:78-88`
  assert `computeLyraScore` / `calculate_score` against the same numbers, so drift in either language
  reddens that language's own test.
- **Pine export mirrors the same weights.** `src/lib/pine/lyra-strategy.ts:23-68` (`LYRA_SCORE_MODEL`)
  regenerates a TradingView v5 strategy; `pine/__tests__/lyra-strategy.test.ts` asserts the caps, bands
  and every rendered weight expression against the model.

## How it works
The Python worker scans on **hourly** bars (`config.py:76`, `DEFAULT_TIMEFRAME=1h`),
`indicators.py:21-134` computes RSI(14), MACD(12,26,9), SMA20/50/200, volume ratio and the 60-period-low
distance via the `ta` library, then `calculate_score` awards the weighted components and
`assign_signal_status` / `action_state_for` / `lifecycle_state_for` (signal_engine.py:123-162) derive the
signal state. Component scores are stamped into `raw_payload` (signal_engine.py:242-246) so the
pure-Supabase read path can render the breakdown bars without a live overlay.

The dashboard radar overlays a **daily** recomputation. `applyLiveSignals` (live-signals.ts:364-382,
called only from `src/lib/data.ts`) fetches `interval=1d` OHLCV from Yahoo (live-signals.ts:61),
`buildSnap` (:149-180) assembles the RSI/MACD/histogram/deltas/volumeRatio/distFrom60Low, `buildLiveSignal`
(:288-354) runs three snapshots (i, i-1, i-2) so the previous candle has a like-for-like score and status,
and `scoreSnap` delegates to `computeLyraScore`. This daily-vs-hourly split is disclosed to the user on
the radar (`src/app/radar/page.tsx:28,31-35`: "scored on daily bars ... an intraday alert can show a
different score") and in the changelog (version.ts:52).

## Strengths (verified)
- **One law, one number, guarded against drift.** Three former score copies collapsed to `computeLyraScore`
  (score-model.ts:11-13); live-signals delegates (live-signals.ts:186-205), pine asserts.
- **True cross-language parity, not just intra-TS.** The golden-vector contract is asserted from BOTH
  Python and TS (test_score_parity.py:78-88 + score-parity.test.ts:36-46), and the test files call out
  that the older Pine-only test "could never catch Python-side drift" (score-parity.test.ts:5-9) - this
  one can.
- **Boundary cases are pinned.** The golden set includes an exact-boundary vector (rsi 35, dist 10, ratio
  1.0, close == sma50*1.03 -> 60) that catches off-by-one `>=`/`<=` regressions
  (score-golden-vectors.json:44-53).
- **State machines are behaviourally tested.** `statusFor`/`actionFor`/`lifecycleFor` have direct
  coverage of every transition (live-signals-state.test.ts:9-58), and the isolated indicator primitives
  (`ema`/`wilderRsi`/`smaAt`/`minLowAt`/`pctRatio`) are pinned against their mathematical definitions
  (live-signals-indicators.test.ts).
- **Timeframe divergence is honestly disclosed** rather than hidden (radar/page.tsx:31-35), matching the
  "engine decides / never mislead" house rule.

## Gaps, risks, what is missing
Mapped to the gap-to-95 audit (V1 Scanner, 92/100 -> 96 if closed). All three residuals live in this
domain:

1. **Display-path composition is untested end to end** (gap-to-95 V1.1, coverage, M, +2). No test
   references `buildLiveSignal`, `buildSnap` or `scoreSnap` (verified by grep across `src/` and `tests/`).
   Only the isolated primitives and `computeLyraScore` are pinned; the glue that assembles the final
   `SignalRow` (score, scoreDelta, status, actionState, lifecycleState, derived deltas) is bare. The
   comment at live-signals.ts:303-308 records that a **real bug lived in exactly this glue** - scoreDelta
   inflated by up to 5 and the `recovered` lifecycle branch unreachable until the third (i-2) snapshot was
   added. Fix: extract a pure `computeSignalFromOhlcv(ohlcv)` and assert the whole SignalRow against a
   canned OHLCV fixture.
2. **Cross-language RAW-INDICATOR parity is unproven** (gap-to-95 V1.2, correctness, M, +1). The golden
   contract only checks the score on **pre-computed** inputs. The raw indicators are not parity-tested:
   TS `wilderRsi` (live-signals.ts:108-128) uses a classic Wilder simple-average seed (mean of the first
   `period` changes), while Python `RSIIndicator` (indicators.py:53) uses the `ta` library's ewm seed.
   These can diverge at a band boundary and flip a 10-point RSI term between the hourly alert engine and
   the daily radar. `wilderRsi` is only tested against its own math definition (live-signals-indicators.test.ts),
   never against Python output. Fix: extend the golden contract down to the raw indicators (assert TS
   `wilderRsi`/`ema`/`smaAt` last-bar within a tight tolerance of Python).
3. **Failed per-symbol overlay surfaces stored hourly values under day labels** (gap-to-95 V1.3, polish,
   S, +1). On a Yahoo fetch failure `applyLiveSignals` keeps the raw stored row (live-signals.ts:377);
   that row's `distanceFromLow` / `priceVsSma200` are 60-hour / 200-hour figures, yet they render under
   the "vs 200MA" / "60D Low" headers (SignalTable.tsx:291-292) and the "scored on daily bars" caption.
   Fix: drop the symbol's row on overlay-fetch failure, or add a "showing last stored scan" chip.

Lower-stakes observations found in-domain (not scored, no action mandated):
- The persisted `score_payload.strategy` label is `"momentum_recovery_v1"` (signal_engine.py:111) though
  the strategy is explicitly mean-reversion / oversold-recovery. A legacy identifier, not a scoring bug.
- The Pine parity test asserts only the **TS** `LYRA_SCORE_MODEL` constants and rendered expressions
  (lyra-strategy.test.ts:49-73); it cannot by itself catch Python-side drift - that guarantee rests
  entirely on the golden-vector contract.

## Where to find it
- **The law:** `workers/stock_scanner/signal_engine.py:23-120` (`calculate_score`, source of truth) +
  `:123-162` (status/action/lifecycle).
- **TS scorer:** `src/lib/score-model.ts` (whole file; weights at :46-52, logic at :60-92).
- **Raw indicators:** `workers/stock_scanner/indicators.py:21-134` (Python) +
  `src/lib/live-signals.ts:99-147` (TS ports).
- **Display composition:** `src/lib/live-signals.ts:149-382` (`buildSnap` / `buildLiveSignal` /
  `applyLiveSignals`); consumed by `src/lib/data.ts`; rendered by `src/components/SignalTable.tsx`.
- **Pine export:** `src/lib/pine/lyra-strategy.ts` + `src/lib/pine/__tests__/lyra-strategy.test.ts`.
- **Parity contract:** `contracts/score-golden-vectors.json` (5 cases) +
  `src/lib/__tests__/score-parity.test.ts` + `tests/test_score_parity.py`.
- **Other tests:** `src/lib/__tests__/live-signals-indicators.test.ts`,
  `src/lib/__tests__/live-signals-state.test.ts`.
- **Timeframe disclosure:** `src/app/radar/page.tsx:28,31-35`; `config.py:76` (`DEFAULT_TIMEFRAME=1h`);
  `src/lib/version.ts:52`.
- **Audit source:** `lyra-audits/2026-07-29-gap-to-95-audit.md` (section "1. Scanner & Signal Engine").

## Posture
Strong and wired - one deterministic law, mirrored in three languages and truly cross-language
parity-guarded on the score; thinly tested at the display-composition seam and unproven on raw-indicator
(Wilder-seed) parity, which are the two open V1 gaps to 95.
