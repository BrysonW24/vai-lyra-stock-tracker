# Understand the score - how Lyra decides a name is turning

Lyra's core output is a single number from 0 to 100 for every ticker it scans. This walkthrough explains exactly how that number is built - every rule, every point value, straight from the code - and, just as importantly, what the number does and does not mean.

Two things to hold in your head the whole way through:

1. **The score is deterministic.** No AI, no randomness, no opinion. The same candle data always produces the same score. The AI layer (when you enable it) only explains the score in plain English - it never changes a number.
2. **Lyra is research tooling, not financial advice.** A high score is a flag that says "this beaten-down name is showing early signs of a turn - worth a look." It is not a buy signal, a prediction, or a recommendation.

Back to the index: [README.md](README.md)

## Where the score lives

The score is computed in four places that are kept in lockstep:

| Place | File | Role |
|-------|------|------|
| Python scanner (source of truth) | `workers/stock_scanner/signal_engine.py` - `calculate_score()` | Runs hourly via GitHub Actions, writes scores to Supabase |
| Frontend score model | `src/lib/pine/lyra-strategy.ts` - `LYRA_SCORE_MODEL` | Mirrors every weight and band; generates the Pine export |
| Frontend breakdown renderer | `src/lib/score-breakdown.ts` - `SCORE_COMPONENTS` | Draws the per-component bars on the ticker page and signal drawer |
| Server-side live overlay | `src/lib/live-signals.ts` - `scoreSnap()` | Recomputes the same score server-side from Yahoo daily OHLCV so the dashboard panels agree with the live chart; applied by `data.ts` via `applyLiveSignals()` |

The indicators the score reads (RSI, MACD, SMAs, volume ratio) are computed in `workers/stock_scanner/indicators.py`. Each side pins itself to the documented constants with its own suite: the 10-test vitest suite (`src/lib/pine/__tests__/lyra-strategy.test.ts`) holds the Pine export in lockstep with `LYRA_SCORE_MODEL` and pins the model to the constants in the tables below, while `npm run worker:test` (`tests/test_signal_engine.py`) pins the Python engine's component totals. A weight change in the Python engine is caught by the Python suite; updating `LYRA_SCORE_MODEL` to match is a manual step - the frontend suite only fails if the TS model and the Pine output disagree with each other or with the pinned constants. The live overlay in `src/lib/live-signals.ts` is not covered by the parity suite at all, so it must be updated by hand whenever a weight changes.

## Jargon primer

If you already know technical analysis, skip ahead. Everything below runs on hourly candles by default (`DEFAULT_TIMEFRAME=1h`), so "period" means "one hour" unless you change that.

| Term | What it means in Lyra |
|------|----------------------|
| Candle / period | One bar of open-high-low-close-volume (OHLCV) data. Default: 1 hour. |
| RSI(14) | Relative Strength Index over 14 periods. Scale 0-100. Low values = the stock has been sold hard; high values = bought hard. Around 30 is conventionally "oversold". |
| MACD (12, 26, 9) | Moving Average Convergence Divergence: the gap between a fast (12) and slow (26) exponential moving average, plus a 9-period signal line smoothing it. |
| MACD histogram | MACD line minus signal line. Negative = downward momentum still in charge. A negative histogram that is shrinking = selling pressure easing. |
| SMA20 / SMA50 / SMA200 | Simple moving averages of the close over 20, 50, and 200 periods. Rough short / medium / long trend lines. |
| Volume ratio | This candle's volume divided by the 20-period average volume. 1.0 = normal participation. |
| 60-period low | The lowest low of the last 60 candles. "Near the low" means the dip is recent and price has not already run away. |
| Delta 1 / delta 2 | Current value minus the value 1 or 2 candles ago. Positive delta = the indicator is rising. |

## The philosophy: dip recovery, not breakout

Lyra hunts one specific pattern: **a beaten-down name showing the first mechanical signs of turning up**. Every block below rewards some version of "the damage was done, and the pressure is now easing":

- RSI has reset low but is climbing back through the 35-50 band.
- The MACD histogram is still negative (the downtrend is real) but improving (it is losing force).
- Price is still pinned near its recent low (you are early, not chasing).
- The longer trend is not broken (this is a dip in an intact name, not a collapse).
- Volume confirms real participation in the turn.

This is a mean-reversion pattern. It is the opposite of a breakout strategy. A stock making new all-time highs with RSI at 75 will score terribly here - by design.

## The five blocks, rule by rule

These point values are lifted directly from `calculate_score()` in `workers/stock_scanner/signal_engine.py`. Every rule is independent: each one that is true adds its points. If an indicator is not yet computable (for example, SMA200 needs 200 candles of history), the engine treats it as `None` and the rule simply awards nothing - it never guesses.

### Block 1: RSI - max 25 points

Rewards an RSI that has reset into the recovery band and is rising.

| Rule | Points |
|------|--------|
| RSI(14) is between 35 and 50 inclusive (the "reset band") | +10 |
| RSI is higher than 1 candle ago (`rsi_delta_1 > 0`) | +10 |
| RSI is higher than 2 candles ago (`rsi_delta_2 > 0`) | +5 |

Why 35-50 and not below 30? Below 35 the knife may still be falling. Lyra wants the reset to have *already happened* and the recovery to have started - RSI climbing back through the band, not sitting at the bottom of it.

### Block 2: MACD - max 30 points

The heaviest block. Rewards downward momentum that is real but visibly easing.

| Rule | Points |
|------|--------|
| MACD histogram is negative | +8 |
| Histogram is higher than 1 candle ago (`macd_histogram_delta_1 > 0`) | +12 |
| Histogram is higher than 2 candles ago (`macd_histogram_delta_2 > 0`) | +5 |
| MACD line is still below the signal line AND the histogram is improving | +5 |

Note the shape this rewards: histogram below zero but rising. That is the classic "momentum trough" - the selling has not reversed yet (no bullish cross), but it is decelerating. The +5 bonus explicitly rewards being *before* the cross, because after the cross you are later to the move.

### Block 3: Price location - max 15 points

Rewards being early - price still near the damage, not already recovered.

| Rule | Points |
|------|--------|
| Close is within 10% of the 60-period low (`distance_from_60_period_low <= 10`) | +10 |
| Close is at or below SMA50 x 1.03 (near or under the medium trend line) | +5 |

### Block 4: Trend - max 15 points

Rewards dips inside a structurally intact name. The two SMA200 rules are mutually exclusive (it is an if / elif in the code), so this block maxes at 10 + 5 = 15.

| Rule | Points |
|------|--------|
| Close is at or above SMA200 | +10 |
| ...otherwise, close is within 5% below SMA200 (`close >= sma_200 * 0.95`) | +5 |
| SMA20 is within 5% of SMA50 (`sma_20 >= sma_50 * 0.95`) | +5 |

A stock trading 30% under its SMA200 gets zero trend points - Lyra treats that as a broken name, not a dip.

### Block 5: Volume - max 15 points

Rewards real participation. The two ratio rules stack: a ratio of 1.2 earns both.

| Rule | Points |
|------|--------|
| Volume ratio >= 0.8 (at least 80% of the 20-period average) | +5 |
| Volume ratio >= 1.0 (at or above average) | +5 |
| Volume is higher than the previous candle's volume | +5 |

### The total

```
final_score = min(rsi + macd + price_location + trend + volume, 100)
```

The block maxes are 25 + 30 + 15 + 15 + 15 = 100 exactly, so the `min(..., 100)` cap is a defensive guard rather than something a normal score hits.

## From score to status

`assign_signal_status()` in the same file turns the number into a label. The thresholds are environment-configurable (see `.env.example`) with these defaults:

| Status | Rule (with defaults) | Action state shown in the app |
|--------|----------------------|-------------------------------|
| `strong_setup` | score >= 75 (`ALERT_SCORE_THRESHOLD`) | `buy_review` |
| `watchlist_setup` | score >= 60 (`WATCHLIST_SCORE_THRESHOLD`) | `watch` |
| `invalidated` | was a strong setup last scan, now below 60 | `invalidated` |
| `weakening` | score fell more than 8 points (`SIGNAL_CHANGE_THRESHOLD`) vs last scan | `do_not_add` |
| `no_signal` | everything else | `hold` |

Note that even the strongest label is `buy_review` - "a human should review this" - never "buy". That is deliberate.

## A fully worked example

Hypothetical ticker ACME, 1-hour candles, close at $42.10. (Every number here is invented to illustrate the math - this is not a real stock or a real signal.)

**RSI block:**
- RSI(14) = 41.2 -> inside 35-50: **+10**
- RSI one candle ago was 39.4, so delta 1 = +1.8 -> rising: **+10**
- RSI two candles ago was 41.6, so delta 2 = -0.4 -> not rising over 2: **+0**
- RSI block: **20 / 25**

**MACD block:**
- Histogram = -0.12 -> negative: **+8**
- Histogram delta 1 = +0.04 -> improving: **+12**
- Histogram delta 2 = +0.07 -> improving over 2: **+5**
- MACD line -0.35 < signal line -0.23, and delta 1 is positive -> below-signal-while-improving bonus: **+5**
- MACD block: **30 / 30**

**Price location block:**
- 60-period low = $39.80. Distance = (42.10 - 39.80) / 39.80 = 5.8% -> within 10%: **+10**
- SMA50 = $43.00. Threshold = 43.00 x 1.03 = $44.29. Close 42.10 <= 44.29: **+5**
- Price block: **15 / 15**

**Trend block:**
- SMA200 = $44.00. Close 42.10 is below it -> no +10. But 44.00 x 0.95 = $41.80, and 42.10 >= 41.80 -> within 5% below: **+5**
- SMA20 = $41.50, SMA50 = $43.00. Threshold = 43.00 x 0.95 = $40.85. 41.50 >= 40.85: **+5**
- Trend block: **10 / 15**

**Volume block:**
- Volume ratio = 0.9 -> at least 0.8: **+5**; not at least 1.0: **+0**
- This candle's volume 1.4M > previous candle's 1.1M: **+5**
- Volume block: **10 / 15**

**Total: 20 + 30 + 15 + 10 + 10 = 85.** That clears the 75 threshold, so ACME is a `strong_setup` with action state `buy_review`. The app's breakdown bars would show exactly these five component values, because the scanner stores each block's score alongside the total.

## What a high score means - and does not mean

**It means:** by five mechanical, backward-looking measures, this beaten-down name is showing the early signature of a turn. The selling has reset the indicators, the downward momentum is easing, price is still near the low, the longer trend is intact, and volume is participating.

**It does not mean:**

- **A breakout.** A high score is "dip recovering", never "strength continuing". Names at fresh highs score low here on purpose.
- **A prediction.** The score reads the past. Nothing in it knows about earnings tomorrow, a filing today, or news five minutes ago. The engine's own explanation payload carries this exact caveat: "Signal is technical only and does not include earnings, filings, or news context."
- **Advice.** Lyra is research tooling. `strong_setup` maps to `buy_review` - review, decide, and own the decision yourself. Any backtest of this logic produces hypothetical results.

## Backtest the same math in TradingView

Because the score is deterministic, it can be exported. `src/lib/pine/lyra-strategy.ts` generates a Pine Script v5 strategy (Pine is TradingView's scripting language) that reproduces the score bar-by-bar: same RSI(14), same MACD(12, 26, 9), same 60-period low, same point values, same 75 / 60 thresholds. In the app, the export button lives on the ticker chart view.

The mirror is held honest by 10 parity tests in `src/lib/pine/__tests__/lyra-strategy.test.ts` - they assert every weight, band, threshold, and the cap-at-100 against `LYRA_SCORE_MODEL`. Each side is pinned to the same documented constants by its own suite (pytest for the engine, the 10-test vitest suite for the model and Pine export), so most weight changes fail one suite - but the suites do not compare the two implementations directly, and keeping them matched is a manual step. Full walkthrough of the TradingView side: [../tradingview-copilot.md](../tradingview-copilot.md).

One honest caveat: identical *logic* does not guarantee identical *numbers* on every bar. TradingView's data feed, session handling, and indicator warm-up can differ slightly from the scanner's data source, so a given candle's score may differ by a few points between the two. The rules are the same; the inputs can differ.

## Verify the rules yourself

You do not have to take this document's word for any number. Two commands re-check the whole model (run them from the repo root after you have done the setup walkthroughs):

```bash
npm run test
```

You know it worked when: the Vitest summary shows `src/lib/pine/__tests__/lyra-strategy.test.ts` passing with 10 tests and the run ends with all test files passed.

```bash
npm run worker:test
```

You know it worked when: pytest's final line reports `passed` with 0 failures - this suite includes `tests/test_signal_engine.py`, which asserts the component scores and the `buy_review` action mapping.

And the primary sources, if you want to read the rules in the code:

```bash
grep -n "score +=" workers/stock_scanner/signal_engine.py
```

You know it worked when: you see the exact point values from the tables above (+10/+10/+5 RSI, +8/+12/+5/+5 MACD, and so on).

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| A ticker's trend (or another) block is stuck at 0 | Not enough history: SMA200 needs 200 candles, the 60-period low needs 60. The engine skips any rule whose input is `None` - it never guesses. | Wait for more scans, or raise `LOOKBACK_PERIOD_DAYS` (default 180) so the worker fetches more history per run. |
| Scores flip between `strong_setup` and `watchlist_setup` at different numbers than 75 / 60 | Thresholds are env-configurable and someone changed them. | Check `ALERT_SCORE_THRESHOLD`, `WATCHLIST_SCORE_THRESHOLD`, and `SIGNAL_CHANGE_THRESHOLD` in your worker environment (`.env.example` documents the defaults: 75 / 60 / 8). |
| The TradingView backtest score differs by a few points from the app on the same candle | Different data feed, session handling, or indicator warm-up window between TradingView and the scanner's data source. The logic is identical; the inputs are not always. | Expected. Compare the direction and shape of the score, not single-bar values. See [../tradingview-copilot.md](../tradingview-copilot.md). |
| A component value in the app's breakdown bars looks wrong | The bars render backend-owned values, which come either from the scanner's stored row or from the server-side live overlay (`src/lib/live-signals.ts`, computed from Yahoo daily OHLCV at request time - it falls back to the stored row per symbol only when the live fetch fails). The frontend itself never recalculates trading logic (a hard rule in this repo). | Re-run `npm run worker:test` to confirm the engine, then check whether the value came from the live overlay (per-symbol fallback) before inspecting the stored signal row in Supabase. |
| You changed a weight in the Python engine and `npm run worker:test` went red | `tests/test_signal_engine.py` pins the component totals - that is its job. The frontend parity suite does not read the Python file, so it stays green until you mirror the change. | Update the Python test expectations, then manually mirror the change into `LYRA_SCORE_MODEL` in `src/lib/pine/lyra-strategy.ts`, the pinned constants in `src/lib/pine/__tests__/lyra-strategy.test.ts`, `scoreSnap()` in `src/lib/live-signals.ts`, and `SCORE_COMPONENTS` in `src/lib/score-breakdown.ts` if a block cap changed, then re-run `npm run test`. |

## Where to next

- Back to the walkthrough index: [README.md](README.md)
- Backtest this exact logic in TradingView: [../tradingview-copilot.md](../tradingview-copilot.md)

Research tooling, not financial advice. Every score is a prompt to investigate, never an instruction to trade.
