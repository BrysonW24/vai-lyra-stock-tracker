# Prediction-Target Redesign - pre-registered 2026-08-02

**Status: REGISTERED BEFORE GEN-3 RESULTS EXIST** (Form 4 backfill in flight, no gen-3 corpus
built, no gen-3 holdout scored). Founder direction, same date: the hunting ground is the four
capital-concentration themes - **AI (flagship)**, space, robotics (supporting), quantum
(watching) - and the question has shifted from "can we predict?" (answered: yes, thinly but
rigorously) to "what is the most effective thing to predict, to adjust buying habits?"

## The strategic premise, stated honestly

In a hot theme the theme call itself is consensus and worth nothing - everyone knows AI is where
the capital is going. History's lesson (dot-com 2000): the theme was RIGHT and most theme stocks
still died. Alpha inside a gold rush comes from three places only:

1. **Name selection within the theme** - which members capture the flow;
2. **Earliness** - finding the inflection before the re-rating, not after;
3. **Survival** - not being in the ones that die on the way.

Generic "will any stock double?" mixes all of this with volatility noise (measured: the
jumpiness null scores 1.41x on our own label). The redesigned targets aim at those three
components directly.

## Target 1 - Theme-relative outperformance (the selection question)

**Label:** within a dated theme universe, did the name outperform its own theme basket by >= X
over the horizon? (X and horizon chosen by the threshold-sweep method, pre-registered separately;
initial arm X = +30% relative, 12 months.)

**Why:** a relative label cancels the shared theme/market/vol component that the barrier label
imports - the exact leak the volatility null exposed. It matches the actual buying decision:
theme exposure is assumed; WHICH name is the question.

**Falsifier:** if within-theme relative skill is no better than the within-theme jumpiness null,
the model cannot select names and the honest product is a theme basket, not a picker.

## Target 2 - Business inflection (the earliness question)

**Label family (point-in-time from EDGAR data already on disk):**
- revenue acceleration: quarterly YoY growth improves for 2+ consecutive quarters inside the window;
- new-money evidence: first/major government contract (USAspending bridge, action_date-dated)
  or insider net-buy cluster (Form 4, filed-dated) inside the window.

**Why:** the current label rewards price emergence from ANY cause; the founder's stated hunt is
companies that move because THE BUSINESS IS WINNING. Decomposing P(business inflects) from
P(price pays it) turns "high on the first, not yet on the second" into the buy-early candidate
list - the actual product.

**Falsifier:** if P(inflection) is unlearnable from our domains, or inflection does not lead
price on this corpus, the two-stage thesis dies and we say so.

## Target 3 - Ruin (the survival question) - PROMOTED 2026-08-02

**Priority shift (founder-ratified via the strategy review):** in a consensus theme the theme
call is free and every name gets bid, fakes included - so draining the junk is worth more than
ranking the winners. Ruin is also the MORE learnable side: more examples (far more small caps
die than 10x), stronger documented signals (dilution / net issuance is the best-replicated
predictor in the whole domain set), shorter feedback loops. The ruin model is therefore the NEXT
TRAINED MODEL after gen-3 closes, ahead of further winner-classifier work.

**Two stages, honestly labelled:**

- **Ruin-lite (gen-4, buildable from data already in hand):** label = -80% first-touch within
  12 months on the existing corpus. Survivor-censored (delisting deaths absent) and stated so on
  every number - this UNDERSTATES true ruin, making it a conservative screen, which is the safe
  direction for a drain-the-junk gate. Features already available: EDGAR dilution/net issuance,
  shelf-registration recency (S-3/S-1/424B forms sit in the cached submissions indexes, dated),
  insider NET SELLING (same Form 4 backfill, S codes), realised volatility (the null becomes a
  feature here), liquidity, cash-runway proxies from quarterly fundamentals.
- **True ruin (gen-5):** delisting-inclusive label once the delisted corpus exists - the same
  build that de-censors everything else. Nothing on the roadmap is wasted; Stage 3's training
  data IS this model's training data.

**Full lifecycle discipline applies:** own artifact, purged walk-forward, floors, one-shot
holdout, paired nulls (vol is a null here too - jumpy names die more), attempt ledger. The
deterministic M5 gates stay as the safety backbone; the trained model ANNOTATES first and may
only replace a gate by beating it on the loop.

**The effective stack this implies (order of value in a hot theme):** founder thesis picks the
pond (no model needed) -> ruin model drains the junk -> winner-similarity ranks the survivors ->
timing last. Same architecture as always; the update is the ORDER.

## The theme-universe problem (and its fix)

SIC codes cannot see the flagship theme: AI-native small caps file under generic software/
services SICs that our map deliberately refuses to call "AI" (no inflation rule). The fix is a
**dated, point-in-time theme source from filing text**: EDGAR full-text (10-K/10-Q/8-K), theme
term intensity + FIRST-MENTION DATE, usable only via filed <= T. Free, honest, and it dates a
company's entry into the theme instead of asserting it retroactively. Space/defence remain
SIC-visible (map already live); robotics partially; quantum is watchlist-only (tiny public
float, mostly story-stage - recorded as a deliberate low priority).

## What does NOT change

The exam system is label-agnostic and transfers unchanged: point-in-time corpus, purged
walk-forward, one-shot holdouts per generation, paired nulls (including per-theme jumpiness
nulls - a theme slice gets the same discipline the tier slices got), attempt ledger, generation
log. The barrier label stays through gen-3 for comparability; Targets 1-2 enter at gen-4 as
co-labels beside it, not as a rip-and-replace.

## Sequencing (reconciled 2026-08-02 with lyra-modelling/PREDICTION-PRIORITIES.md)

- Vol baseline: SHIPPED v0.117.0 (standing null in every eval, within-tier paired verdicts) -
  the gate for everything below is already in place.
- Gen-3 (imminent): unchanged - sponsorship lit, estimator fair fight, vol-feature arm.
- Gen-4 window, three small independent builds: (a) mega-cap sponsorship watchlist - the ~20
  investment-arm filers (NVIDIA, Microsoft, Amazon, Alphabet, Meta et al.) via 13F/13D/13G/8-K,
  the highest-value slice of the sponsorship domain at a fraction of full-13F cost, tested via
  the H1-H4 pre-registrations in PREDICTION-PRIORITIES.md (drift after disclosure, never the
  uncapturable pop); (b) ruin-lite trained screen (Target 3 above); (c) theme-from-filings
  source feeding Targets 1-2 co-labels; verdict grid gains a per-theme axis.
- Gen-5: true ruin + everything de-censored when the delisted corpus exists; live ledger begins
  validating all of it.

**Pre-registered prediction (falsifiable):** within the AI theme universe, Target 2 evidence
(insider cluster + revenue acceleration) will beat the within-theme jumpiness null where the
generic barrier label has not yet managed it within-tier; and Target 1 relative skill will be
concentrated in micro/small members. If neither holds at gen-4/5, the honest conclusion is that
our edge is infrastructure, not prediction, and the product leans on receipts + gates + baskets
rather than ranking.
