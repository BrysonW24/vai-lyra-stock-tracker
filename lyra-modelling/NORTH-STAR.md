# North Star - the most sophisticated model stack this app can honestly carry

_2026-08-01. The target-state architecture for the Emerging Winner Engine at full sophistication.
Companion to [`MODEL-REPORT-CARD.md`](../lyra-evals/MODEL-REPORT-CARD.md) (where we are) and
[`TRAINING-PIPELINE.md`](TRAINING-PIPELINE.md) (how training runs today). This is a TARGET STATE
document: nothing here exists until its earn-gate is passed, and the doc says so per component._

## What "most sophisticated" means here

Sophistication is bounded by doctrine, and the doctrine survives every upgrade:

1. **The engine computes every number; models inform, they never decide.** At maximum
   sophistication the deterministic layer still owns actions; the models own probabilities,
   rankings, analogues and annotations.
2. **Veto vs annotate stays separated.** Risk gates veto legibly; intelligence annotates. No model
   ever silently vetoes, no matter how good its AUC.
3. **Every number must carry its explanation.** A model that cannot produce a per-name receipt
   (attribution, neighbours, interval) does not get a seat, whatever its backtest says.
4. **An upgrade earns its seat on the standing loop** - purged walk-forward, one-shot holdout,
   symbol-clustered CIs, floors, and the >2x-lift leakage alarm - or it stays a challenger.
5. **The LLM phrases; it never scores.** At every level of sophistication the language model is a
   narration layer over engine-owned numbers. Agentic LLM-as-decision-layer is permanently out of
   scope: non-determinism and fabrication are the exact failure modes this design exists to prevent.

And one ordering fact the 2026-08-01 backtest proved with numbers: **sophistication compounds in
the order data > labels > estimator > loop.** A better estimator on today's data buys almost
nothing; better data raises the ceiling of every estimator after it. The stack below is sequenced
by that law, not by what is most fun to build.

## The destination, in one picture

```
L0  POINT-IN-TIME DATA SPINE          bitemporal, delisted-inclusive, corporate-action-safe
        |
L1  FEATURE STORE                     versioned as-of features, per-feature coverage + freshness
        |
L2  THE SIX SEATS (upgraded)          M1 explain | M2 GBDT-ordinal | M3 learned analogue index
        |                             M4 LTR queue | M5 legible gates + ruin annotator | M6 temporal/graph
L3  UNCERTAINTY LAYER                 conformal intervals, prevalence-shift recalibration, abstention
        |
L4  DECISION + LEARNING LOOP          research queue -> ledger -> matured outcomes -> champion/challenger
        |                             cadence -> (later) queue-level bandit with off-policy eval
L5  NARRATION                         LLM phrases engine-owned numbers; provenance on every sentence
```

## L0 - the point-in-time data spine (the foundation; everything above is capped by it)

The single most valuable artefact this product can own. Target properties:

- **Delisted-inclusive universe**: every name that EVER filed with the SEC in the window, not the
  survivors. Built from EDGAR's historical filer index joined to delisted price history. This is
  what makes the -80% ruin class real, precision numbers honest rather than optimistic bounds, and
  the ruin model (M5's annotator) trainable at all.
- **Bitemporal discipline**: every fact carries event time AND knowledge time (`filed`). The corpus
  builder already enforces `filed <= T`; the spine generalises that from a backtest convention into
  the storage schema itself, so look-ahead becomes structurally impossible rather than carefully
  avoided.
- **Event-timed multi-source ingestion**, each source with its own as-of tests before it ships:
  EDGAR financial facts (built), Form 4 insider flow (next build, CIK-safe), 13F ownership deltas,
  USAspending awards, a DATED theme/taxonomy source (so theme becomes a feature instead of a leak
  risk), delisting/corporate-action events.
- **Corporate-action-safe prices**: raw prints, split factors and dividend factors stored
  separately (never a pre-collapsed "adjusted" number whose anchor moves), so any consumer can
  build the series it needs without inheriting someone else's adjustment.

## L1 - the feature store

Versioned feature definitions with as-of join semantics; per-feature coverage and freshness
metadata as first-class values. Coverage honesty stops being a convention in the scorecard and
becomes a queryable property: "this feature, for this name, at this date, was knowable/fresh/absent".
The same store serves training and live scoring, killing the train/serve skew class by construction
(the drift guard then verifies a tautology, which is exactly what a drift guard should verify).

## L2 - the six seats at full sophistication

| Seat | Today | North star | Explanation artefact it must produce |
|---|---|---|---|
| M1 domain scorecard | rule-based, refuted as a ranker | **Stays deterministic on purpose** - its role is formalised as the transparent feature/coverage/explanation layer, never the ranking authority again | the legible domain read (already exists) |
| M2 classifier | logistic `real-v1` (lift 1.72x holdout) | **Gradient-boosted ordinal (CatBoost/LightGBM)** with monotonicity constraints where evidence is directional (dilution never scores up), regime features, class-imbalance-aware objectives; a compact tabular attention model (FT-Transformer class) only if the delisted-inclusive corpus grows past ~1M rows and beats GBDT on the loop | per-name SHAP over real features + conformal interval |
| M3 analogue | cosine vs curated seed (illustrative) | **Learned metric over point-in-time snapshot trajectories** (contrastive training: winners near winners at the same stage), served from a real vector index (pgvector/FAISS); neighbours are actual historical names with dates and outcomes | "resembles X (2019Q2, +240%) and Y (2020Q4, -85%)" - receipts, not vibes |
| M4 ranker | weighted linear priority | **Learning-to-rank (LambdaMART)** optimising per-cohort precision@k with a diversity constraint so the queue is never ten clones of one theme; exploration quota reserved for the bandit (L4) | per-signal rank attribution |
| M5 risk gates | rule thresholds (pump-block pinned) | **Rules stay the veto** (capital protection must be legible forever). Sophistication arrives as an ANNOTATOR: a ruin-probability model trained on the delisted-inclusive -80% class, feeding gates as an input they threshold legibly | the gate reason string, plus the ruin model's factors |
| M6 timing | heuristics, shadow-only | **Temporal sequence model** (TCN/GRU over bars + event stream) and a graph layer (theme/supply-chain adjacency; simple graph features before any GNN). Annotate-only until it survives its own standing-loop cycle | "attention leads evidence by ~3 weeks" style annotations with the series that produced them |

## L3 - uncertainty as a first-class output

- **Conformal prediction intervals** on M2's probability (distribution-free, honest at small n).
- **Prevalence-shift recalibration**: probabilities restated at deployment base rate, not corpus
  base rate - the backtest's odds-rescaling formalised into the serving path.
- **Abstention**: below a coverage/freshness floor the model returns "insufficient data" rather
  than a low-confidence number. Coverage honesty graduates from a throttle on confidence into a
  refusal to guess.

## L4 - the loop that learns

- The ledger + maturation job close the data loop: nightly real scans -> immutable predictions ->
  12-month matured outcomes -> `load_training_dataset` auto-upgrades -> the standing
  champion/challenger cadence re-runs on a schedule instead of on demand.
- **Queue-level contextual bandit** (the true long-term shape): "which names get research
  attention" becomes an action with realised rewards (matured outcomes + user research signal).
  Strictly gated: off-policy evaluation on logged data first, exploration capped, and the bandit
  chooses among names that already passed the gates - it allocates attention, it never overrides a
  veto. This is the last thing built, because it only pays after L0-L3 exist.

## What we will NOT build, at any sophistication level

- A single end-to-end black box replacing the DAG (trades the inspectability that IS the product).
- Voting/consensus ensembles across the seats (consensus-by-voting is what the DAG was built to avoid).
- An LLM decision layer (narration only, forever).
- Any model without a per-name explanation artefact.
- Any upgrade that skips the standing loop, the one-shot holdout, or the >2x leakage alarm.

## Earn-gates and sequencing (each step unlocks the next; none skip the loop)

| Step | Builds | Earn-gate to ship |
|---|---|---|
| 1 | Form 4 insider domain (starts L0 source #2) | as-of tests green; domain lights up in backtest without lift alarm |
| 2 | 13F + USAspending + dated theme source | same per-source gate |
| 3 | Delisted-inclusive universe (completes L0) | ruin class present; survivorship caveat retired from provenance |
| 4 | Feature store (L1) | train/serve features byte-identical by construction |
| 5 | M2 GBDT challenger | beats real-v1 lineage on dev walk-forward AND a fresh one-shot holdout, CIs separated |
| 6 | M3 learned analogue index | neighbour-retrieval precision beats cosine-seed baseline on the loop |
| 7 | Conformal + prevalence recalibration (L3) | intervals empirically valid per cohort |
| 8 | M4 LTR + M6 temporal/graph | each beats its incumbent on the loop; M6 stays annotate-only |
| 9 | Live maturation at scale + scheduled cadence | >= 20 matured live cohorts; monitor gates flip to live data |
| 10 | Queue bandit (L4 complete) | off-policy eval shows regret improvement; founder approves exploration budget |

## Definition of "arrived" (measurable, so the north star can be audited)

- Random-slice, delisted-inclusive holdout: **top-5% lift >= 3.0x with CI90 floor >= 2.0x**, at a
  real ~3% base (i.e. >= ~9% top-pick precision with the ruin class present).
- **Worst quarterly cohort beats its null in >= 90% of quarters** - no more dead regimes.
- **ECE <= 0.03 at deployment prevalence** with valid conformal coverage per cohort.
- Live calibration (not backtest) sustains the surfacing gate for two consecutive quarters -
  the founder-gated promotion out of shadow finally has live evidence under it.
- Every surfaced name carries: probability + interval, top SHAP factors, two named historical
  analogues with outcomes, gate verdicts, and timing annotation - the full receipt, generated by
  models, phrased by the LLM, decided by no one but the reader.

_Grade trajectory this implies: data D -> A over steps 1-4; estimator D+ -> B+ over steps 5-8;
accuracy C+ -> B target at step 9 (the honest ceiling for 12-month multi-bagger prediction is
modest lift, well-calibrated, regime-robust - anyone promising more is selling something)._

## Evidence addenda (dated - what the loop has since established)

**2026-08-02 (gen-2 close + evidence sprint):**

- Step 1 is in flight: the Form 4 backfill (~205k filings, 991 names, 2015-06) runs at the SEC's
  published fair-use pace. **Gen-4 sourcing note:** when the universe widens beyond 991 names,
  ingest the SEC's bulk **Insider Transactions Data Sets** (quarterly pre-parsed Form 3/4/5
  tables since 2006) for training history, and keep the raw-XML parser solely for live parity -
  per-document fetching does not scale to the full ~10k listing.
- Step 3 scoping is now evidence-based: the free price source does NOT serve delisted histories
  (SIVB/FRC empty; recycled tickers like BBBY are an identity trap). The delisted universe
  requires a paid corpus source (Sharadar-class) or a CIK-anchored EDGAR+OTC assembly. Identity
  must be CIK-anchored, never ticker-anchored.
- Step 5 has first evidence: depth-2 boosted trees beat the linear retrain on gen-2 dev
  walk-forward (1.393x tuned vs 1.27x, config pre-committed and frozen for gen-3) but sit below
  the 1.5x floor - consistent with this document's thesis that data unlocks precede estimator
  wins.
- Step 7 sharpened: weak calibration is now measured (champion slope 0.755 CI90[0.57, 0.98],
  level -0.05, 3%-base restatement transfers). The artifact-carried logit-linear correction seam
  exists, inert; turning it on is a standing-loop decision at gen-3.
- Protocol upgrades now standing: paired-difference gate (never CI overlap), attempt ledger
  (every trial logged, refusals included), per-generation per-row score archiving (enables
  paired cross-generation tests from gen-2 onward).
