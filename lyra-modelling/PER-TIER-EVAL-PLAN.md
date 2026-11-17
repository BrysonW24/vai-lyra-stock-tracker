# Per-tier evaluation plan — honest readings for micro / small / mid / large

> 2026-08-01. Companion to [`THRESHOLD-SWEEP-EXPERIMENT.md`](THRESHOLD-SWEEP-EXPERIMENT.md).
> Goal: a precise, fair skill reading for each market-cap group, so "beats chance" always means
> "beats chance *for that kind of stock*" — and so a small cap doubling (normal) is never graded
> on the same curve as a mega cap doubling (rare).

## Step 1 — Define tiers point-in-time

Tier is assigned from market cap **at the scoring date**, from the corpus — never today's cap
(a 2016 micro that's now a mid must count as micro in 2016, or you leak the outcome into the grouping).

| Tier | Cap at T |
|---|---|
| Micro | < $300M |
| Small | $300M – $2B |
| Mid | $2B – $10B |
| Large | > $10B |

Pin the boundaries in one place in code; log each row's tier into the corpus so every later step is a
group-by, not a recomputation.

## Step 2 — Per-tier base rates (the chance bar)

For each tier × threshold (+10 … +300%) × quarter: what fraction of that tier hit the barrier?
This table is the foundation — it *is* "chance" for that group, and it will confirm your intuition
(micro/small doubling is common; large doubling is rare). Publish it as its own artifact; it's also the
product's "random pick at this setting" number.

## Step 3 — Per-tier nulls (the real bar)

Within each tier, run two dumb baselines through the exact standing loop:

1. **Random-within-tier** — the floor.
2. **Jumpiness-within-tier** — rank that tier's names by trailing realised volatility, take the top k.

The vol-sort is the bar that matters. A skill claim for a tier = beating *that tier's* vol-sort,
not beating random overall.

## Step 4 — Score the model within tier

Rank and cut top-k **within each tier separately** (top 5% of micros, top 5% of smalls, …), then compute
per tier: precision@k, lift vs that tier's base rate, SEDI (comparable across the very different base
rates), and symbol-clustered bootstrap CIs — same machinery you already have, grouped.

Never pool tiers into one headline: a pooled top-5% will be all micros (they have the highest touch
rates), which silently converts the eval back into a jumpiness sort.

## Step 5 — Show the sample size, grey the thin cells

Mid and large tiers will have few winners at +100%+ (a large cap doubling is a handful of names per
year). Every tier × threshold cell reports its positive count, and any cell where the permutation null
band contains the model's score renders **greyed with "not enough evidence"** — same instinct as the
shadow-live gate. Expect most of the mid/large × high-threshold grid to be grey. That's honest, not a
failure.

## Step 6 — The verdict grid

One heatmap: tiers × thresholds, cell = model's skill (SEDI or vol-adjusted lift) with CI, grey where
unproven. This answers the whole question in one picture: *where — which kind of company, at which move
size — does the model genuinely know something?* Expectation to test: the signal concentrates in
micro/small at moderate-to-+100% thresholds; if the grid confirms it, that cell range becomes the
product's declared universe, in writing.

## Step 7 — Wire it into the standing loop

- `eval` grows a by-tier slice; results append to `model-metrics-history.jsonl` per tier.
- New registry metric: **worst-tier lift among claimed tiers** (alongside worst-quarter).
- Report card: the verdict grid replaces/joins the current lift-by-tier chart.
- Standing rule: **a tier is only claimed in the product where it beats its own vol-null with CI
  separation; unclaimed tiers render greyed in the UI.**

## Order of work

1. Tier assignment into corpus (point-in-time) — small.
2. Base-rate table (Step 2) — small; run first, it sanity-checks everything else.
3. The two per-tier nulls (Step 3) — the volatility baseline from THRESHOLD-SWEEP §1.1, now per tier.
4. Per-tier model scoring + grid (Steps 4–6) — medium.
5. Loop wiring + standing rule (Step 7) — small.
