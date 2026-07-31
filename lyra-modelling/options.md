Two sets of four, here they are:

Direction (which model first) - you picked #1:
Emerging-winner first ✅ (shared platform, momentum as fast-follow)
Both in parallel
Momentum model first (the diagrams)
Emerging-winner only (park momentum entirely)


Winner label (what the model learns) - you picked #1:
Multi-bagger, 12mo ✅ - >= +100% within 12 months, first-touch; US small/micro <~$2B; point-in-time incl. delisted; base rate ~2-4%
Top-decile, 12mo (relative) - top 10% forward return vs cohort; base rate ~10%, easier to learn
True moonshot, 24mo - >= +200-300% within 24 months; base rate ~0.5-1.5%, hardest
Composite quality-winner - +100% AND survived AND liquidity grew; anti-pump-and-dump
Both full menus (with tradeoffs and previews) are going into the planning doc so the choices stay revisitable. Now setting up the build.

---

This is a genuinely different and more ambitious model than the diagrams, and you're right that nothing in Lyra addresses it today. My five mappers just confirmed that from every angle: everything Lyra has built is technical momentum on 63 NASDAQ mega-caps (universe.py), the small-cap surface is curated/demo content, and there is no fundamental / insider / government-spend / VC / hiring pipeline anywhere (gov-awards.ts, filings.ts, insider-flow.ts are all hand-authored "illustrative sample" literals with no worker and no table). So let me separate the two models cleanly, because they are not the same thing.

Two different models
Model A - the Phoebe diagrams. Momentum/recovery: P(+20% before -10%) in 21/63/126 days, on liquid names, driven by RSI/MACD/price-location. It answers "is this already-known stock about to bounce?" The substrate for it mostly exists in the repo.

Model B - what you actually described. An "emerging winner" classifier: given a small cap now, what is the probability it becomes a big winner over a long horizon, learned from what the actual winners of 2024-2026 had in common - and, just as importantly, which factors are driving that call. It answers "which unknown small cap is the next play, and why does it resemble the ones that already ran?" This is fundamental + thematic + macro + alternative-data, not price action. It is the higher-difficulty, far more differentiated model, and it's the one you care about. Nothing like it exists in Lyra.

They are not rivals. Model B reuses almost all the plumbing the diagrams specify (point-in-time feature store, immutable prediction ledger, calibration, champion/challenger, the evidence card, the ranked queue) - it just aims that machinery at a different label and a different universe. So the honest answer is: build one platform, make the emerging-winner classifier its first tenant, and let the momentum model ride the same rails later. Phoebe's work isn't wasted; it becomes the second tenant.

The three hard truths (this is the "highest difficulty" you named)
I want to be straight with you, because a model like this is either done honestly or it is worse than useless.

Survivorship bias will silently fake it. If we train on "the small caps that did well in 2025-2026," the model just learns that winners look like winners. The only honest way is point-in-time with the dead included: reconstruct the small-cap universe as it existed at time T - including every name that later delisted, diluted to zero, or got taken under - snapshot each one's features as known at T, and label by what happened next. Free data is almost all survivorship-biased, so rebuilding an honest point-in-time universe (with the failures) is the single hardest data problem here, and the repo has none of it.

The features that make this model special don't exist yet, and half of them can't be honestly sourced. Of the things you named: SEC fundamentals & R&D & dilution (EDGAR), insider buying & institutional accumulation (Form 4 / 13F), and government awards (USAspending) are free, official, and point-in-time - real pipelines we can build. Curated theme-graph membership and news trajectory, Lyra half-has. But private VC funding rounds, historical hiring velocity, and "founder vision" are paywalled, ToS-fraught, or not honestly reconstructable point-in-time - so I'd build the sourceable half properly and explicitly flag the rest as deferred, rather than fake them. The model's realism is bounded by that sourceable half, and it's a multi-month data-engineering effort, not a weekend.

The base rate is tiny and the world is non-stationary. True multi-baggers are ~2-4% of small caps a year, so the classes are wildly imbalanced and positives are few. And what made a 2021 winner (zero rates) is not what makes a 2025 winner (AI capex). With only a few years of history, we can't trust AUC - we validate with walk-forward by year (train ≤2023 → test 2024, etc.) and report precision@k ("of my top 20 picks that quarter, how many actually ran") and calibration, not a single headline number.

What I'd build
A GBDT (LightGBM) classifier with SHAP attributions as the champion - tabular, tolerant of the sparse/missing data small caps have, and its explanations are the "why it resembles past winners" panel you want. It outputs a calibrated probability, a percentile rank, the top factors driving it, and a mandatory risks / what's-missing / what-would-invalidate panel (non-negotiable - a "moonshot small-cap tip list" is the most abused surface in finance, so the honesty has to be dialled to maximum). It's born shadow-live behind an immutable ledger, validated backtest-first because the real forward horizon is 12-24 months, and it stays inside Lyra's contract via the reconciliation my doctrine-mapper already worked out: engine-owned numbers, research-queue framing, never "buy," never a price target.