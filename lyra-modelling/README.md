# lyra-modelling

> Lyra's modelling home: the deterministic score's source of truth **and** the research + planning for
> Lyra's predictive models. Founder-facing operating domain in Lyra's `lyra-<domain>` structure - see
> [`../lyra-folder-convention.md`](../lyra-folder-convention.md).

## What lives here

- **The deterministic score model** - the reset-band (RSI 35-50), improving-but-negative MACD histogram,
  and within-~10%-of-60-low logic the engine turns into a score. This is the always-on backbone.
- **Predictive-model research + planning** in [`research/`](./research/).
- **Reference diagrams** (renamed 2026-07-30 from UUID captures), three sets:
  - `deck-1of7 ... 7of7-*.png` - the Emerging Winner Engine 6-model deck (overview + Models 1-6). The authoritative visual spec for `workers/emerging_winner/`.
  - `families-1of5 ... 5of5-*.png` - candidate model families (GBDT, Temporal Fusion Transformer, TCN/GRU/LSTM, Dynamic Graph NN, Stacked Ensemble + Uncertainty).
  - `architecture-*.png` - the end-to-end predictive-modelling and model hosting/inference architecture posters.

## The models on the table

Two model classes, one shared platform. Full framing in the research docs.

| Model | What it answers | Status |
| --- | --- | --- |
| **A - Event model** (the `families-*.png` + `architecture-*.png` diagrams) | "Will stock X hit +20% in 21/63/126 days?" - technical momentum on liquid names | Designed (diagrams); substrate mostly exists in-repo |
| **B - Emerging Winner Engine** (flagship) | "Does this small cap resemble the companies that became outsized winners?" - a 10-domain structural archetype classifier | **Shadow-live (all six models running)** - the full deck stack under [`../../workers/emerging_winner/`](../../workers/emerging_winner/): M1 domain scorecard, M2 classifier, M3 analogues, M4 archetype+ranker, M5 risk gates, M6 timing/network (shadow challenger). Reference-v1 until the Phase 1 point-in-time dataset lands. Planning: [`research/2026-07-29-emerging-winner-engine.md`](./research/2026-07-29-emerging-winner-engine.md) + spec [`emerging-winner-engine.md`](./emerging-winner-engine.md) |

Decision (2026-07-29): **build B first**; A is a fast-follow *timing* tenant on the same rails. The
end-state combines them - archetype says "future winner," event says "timing is turning now."

## The one law it must never break

The **deterministic engine decides; AI only explains and never invents a number.** This holds for the
predictive models too: winner-similarity / probability / percentile are engine-owned numbers, rendered as
metric-grid keys, never AI prose; the models **inform**, they never **decide** an action; research only,
never advice, never a price target, never "buy."

Any change to the score model here must stay in lockstep with its two executable implementations -
[`src/lib/score-model.ts`](../../src/lib/score-model.ts) (TS) and
[`workers/stock_scanner/signal_engine.py`](../../workers/stock_scanner/signal_engine.py) (Python) -
cross-checked by the golden vectors in [`contracts/score-golden-vectors.json`](../../contracts/score-golden-vectors.json).
Change the model here, then the code, then re-prove parity; never let a doc drift ahead of the tested engine.
