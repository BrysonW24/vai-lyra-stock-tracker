# lyra-modelling

> Lyra-specific: the stock oversold-recovery scoring/modelling research and the score's source of
> truth - the reset-band (RSI 35-50), improving-but-negative MACD histogram, and within-~10%-of-60-low
> logic that the deterministic engine turns into a score.

Founder-facing operating domain in Lyra's `lyra-<domain>` structure - see
[`../lyra-folder-convention.md`](../lyra-folder-convention.md). No template equivalent; this is the
Lyra-native modelling home (Podium's analogue would be its coaching-model research).

## What lives here

- Modelling research, score-component rationale, and band-threshold decisions.
- Reference screenshots / charts of the model behaviour (the `*.PNG` captures currently here).

## The one law it must never break

The **deterministic engine decides; AI only explains and never invents a number.** Any change to the
score model here must stay in lockstep with its two executable implementations - `src/lib/score-model.ts`
(TS) and `workers/stock_scanner/signal_engine.py` (Python) - which are cross-checked by the golden
vectors in `contracts/score-golden-vectors.json`. Change the model here, then the code, then re-prove
parity; never let this doc drift ahead of the tested engine.
