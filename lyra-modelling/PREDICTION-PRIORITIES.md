# Prediction priorities — aiming the model at the right question

> 2026-08-02 · Founder decision record + build directive.
> Companions: [`THRESHOLD-SWEEP-EXPERIMENT.md`](THRESHOLD-SWEEP-EXPERIMENT.md) ·
> [`PER-TIER-EVAL-PLAN.md`](PER-TIER-EVAL-PLAN.md) · [`MODEL-SELECTION-AND-OSS-STACK.md`](MODEL-SELECTION-AND-OSS-STACK.md) ·
> [`NORTH-STAR.md`](NORTH-STAR.md)
>
> Context: "can we predict?" is answered — yes, modestly (gen-2 holdout 1.94×, pending the volatility
> baseline). The binding question is now **what to predict, and in what order of value.** This doc locks
> that ordering and the reasoning, so it stays revisitable.

---

## 1. The reframe (decided)

**The thesis is the universe. The model is the filter. They are different jobs.**

The founder's thesis — AI/AGI flagship; space, quantum, robotics supporting — does not need a model.
Amazon's completed $50B investment in OpenAI (Aug 2026) is the kind of fact that makes the theme
*consensus*, and consensus is priced. No classifier earns its keep by re-discovering what a headline
already said.

What consensus does create is the model's real job: **when a theme is hot, every small cap wearing its
label gets bid — including the fakes.** The discriminating question inside a gold rush is not "which of
these resembles a winner" (for a while, they all do) but **"which of these is real, and which is going to
zero."**

### The value ordering (locked)

| # | Layer | Job | Who does it |
|---|---|---|---|
| 1 | **Thesis** | Pick the pond (AI flagship; space/quantum/robotics supporting) | Founder judgment — no model |
| 2 | **Ruin screen** | Drain the junk: diluters, pumps, zombies wearing AI costumes | **M5 — the next trained model** |
| 3 | **Winner similarity** | Rank the survivors | M2 (built, shadow-live) |
| 4 | **Timing** | Entry timing on ranked names | M6 / Model A (later) |

This is the existing 9-gate architecture — the update is the **order of value**. Gate 1 was always
first in the pipeline; it is now also first in build priority.

---

## 2. Why the ruin model is the next trained model (evidence)

1. **It owns the best-evidenced signal in the whole scorecard.** Net share issuance / dilution
   (Pontiff & Woodgate, JF 2008) is among the most robust, replication-surviving negative predictors
   known — while the winner-side domains (theme, adoption, narrative) carry the least external evidence.
   We have been planning to train hardest on the weakest-evidenced half of the scorecard.
2. **Ruin is more learnable than glory.** Far more small caps die than 10×: more positives, better
   statistical power. Its signals are concrete and point-in-time in EDGAR — shelf registrations
   (S-1/S-3), cash runway, going-concern language, share-count growth — and its feedback loops are
   shorter than a 12-month winner label.
3. **Hot themes make it more valuable, not less.** The MAX/lottery literature says visibly lottery-like
   names in hot themes are systematically *overpriced*; AI-washing is the current failure mode. The
   gen-1 finding that `technical` and `liquidity` flip negative on real doublers is consistent with the
   same story — the danger cohort is identifiable.
4. **Nothing on the roadmap is wasted.** The delisted-universe project (Stage 3) *is* the ruin model's
   training data — the −80%/delisting class is its label. Stage 3 now serves two models, which raises
   its priority too.

**Directive:** M5 graduates from rule-based gates to a trained survival/dilution model (competing-risks
framing: ruin-delist vs acquisition vs survive — delisting-reason-aware per the labeler spec), behind the
same artifact → drift-fixture → shadow-live contract as M2. Same eval discipline: purged walk-forward,
one-shot holdout, per-tier grading, volatility null.

---

## 3. The sharpened thesis: mega-cap sponsorship (new, testable)

Founder statement of the target: **"the small caps that are being invested in by the big AI mega caps are
the companies I'm targeting — getting ahead of the curve."**

This is a *precise, observable, point-in-time signal* — and it's a specific, buildable version of
domain 9 that is far cheaper than the general sponsorship pipeline:

### 3.1 Why it's cheap to build

General domain 9 means parsing every institution's 13F. **This version means watching ~20 filers.**
Strategic stakes by NVIDIA, Microsoft, Amazon, Alphabet, Meta, AMD, TSMC-adjacent vehicles, SoftBank etc.
in *public* small caps surface, point-in-time, through:

- **13F holdings** of the mega caps' own investment arms (a handful of CIKs, quarterly);
- **13D / 13G** beneficial-ownership filings (>5% stakes, filed within days);
- **8-K material agreements** (strategic investments, supply/capacity agreements, anchor-customer deals);
- the counterparty's own filings and announcements.

All EDGAR, all CIK-keyed, all inside the ingestion discipline already spec'd. Call it the
**strategic-sponsorship sub-signal**: `sponsor_stake` (who, when disclosed, size) + `sponsor_agreement`
(8-K commercial link). Precedent that the signal moves markets: NVIDIA's 13F disclosures alone repriced
its disclosed small-cap holdings violently in 2024 — the phenomenon is real and documented.

### 3.2 The honesty mechanics (read before celebrating)

- **The disclosure pop is not capturable.** The day a stake is disclosed, the price gaps. The tradable
  question is the **post-disclosure drift**: do sponsored names outperform their tier *after* the pop,
  over 6–12 months? That is exactly what the corpus + standing loop can measure, point-in-time, with the
  disclosure date as the feature timestamp. Nobody needs to guess — run it.
- **"Ahead of the curve" has two honest forms.** (a) *After disclosure, before the market fully digests* —
  measurable drift, the realistic edge. (b) *Before disclosure* — predicting private deal-making; that is
  not honestly modellable and should never be claimed. The product surfaces (a) and says so.
- **Second-order names are where resemblance modelling earns its keep.** The sponsored name itself is
  public information the moment it matters; its *suppliers and dependents* (archetype 6, "second-order
  supply-chain winner") reprice slower. The theme graph + supply-chain nodes already in `content/` are
  the substrate for this.
- **Sponsorship raises the stakes for the ruin screen.** Sponsored themes attract imitators — every
  NVIDIA stake spawns ten "AI infrastructure" pretenders. The two models are complements: sponsorship
  shortlists, ruin screen disqualifies.

### 3.3 Pre-registered hypotheses for the standing loop

Logged before the data runs, so the results are tests, not stories:

- **H1:** mega-cap strategic sponsorship (stake or material agreement, as-of disclosure date) predicts
  positive drift vs tier over 6–12 months, surviving the volatility null.
- **H2:** the effect is larger for *agreements* (revenue-linked) than for *stakes* (financial).
- **H3:** second-order supply-chain exposure to a sponsored name predicts drift with a longer lag than
  direct sponsorship.
- **H4:** among sponsored-theme names *without* sponsorship, ruin risk is elevated vs tier (the
  imitator effect).

Each gets the full treatment: purged walk-forward, per-tier grading, vol null, paired tests, one-shot
holdout. If H1 fails, the thesis is wrong in its measurable form and we say so.

---

## 4. Build order (supersedes prior sequencing where it conflicts)

| # | Work | Serves | Size |
|---|---|---|---|
| 1 | **Volatility-only baseline** through the standing loop (THRESHOLD-SWEEP §1.1) | Validates/deflates the current 1.94× before anything is built on it | S |
| 2 | **Strategic-sponsorship pipeline** — ~20 mega-cap filer CIKs: 13F + 13D/G + 8-K, as-of disclosure date | H1–H4 · domain 9's highest-value slice at lowest cost | M |
| 3 | **Run H1–H4** on the corpus via the standing loop | The thesis, measured | S–M |
| 4 | **Delisted-inclusive universe** (Stage 3, priority raised) | Ruin labels + honest precision | L |
| 5 | **M5 trained ruin model** (survival / dilution / competing-risks) | The value-ordering's #2 layer | M–L |
| 6 | Winner-classifier upgrades (GBDT/EBM bake-off etc.) | Layer #3 — after the layers above it | M |

---

## 5. Doctrine note (unchanged, restated on purpose)

The product remains **research, never advice** — the engine surfaces calibrated resemblance, sponsorship
facts, and risk flags; it never says buy, never prints a target, and the founder's personal use of his
own research tool is outside the product's claims. On the personal goal itself, the honest arithmetic
stands: at target performance a top pick doubles roughly one time in four or five, and micro-cap costs
eat thin edges — the realistic path is a real modest edge, compounded, with ruin avoided. That is what
this ordering is designed to produce.
