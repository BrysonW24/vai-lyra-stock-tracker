# lyra-strategy - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
Customer, product, commercial, packaging, and bet decisions. Today: a clear product thesis and an
active flagship bet exist (in docs + the modelling domain); formal strategy/decision registers are greenfield.

## Lyra as it is today
- **Product thesis (clear, documented):** a research-first tech-stock oversold-recovery scanner - a
  dip/early-turn (mean-reversion) strategy, not momentum/breakout. Grounded in `README.md`,
  `docs/product/product-principles.md`, `docs/horizons.md`, `docs/PATH-TO-PRODUCTION.md`.
- **Active flagship bet (as of 2026-07-29):** the **Emerging Winner Engine** - a 10-domain structural
  archetype classifier ("does this small cap resemble companies that became outsized winners?"),
  documented by the founder in `lyra-modelling/research/2026-07-29-emerging-winner-engine.md` and
  summarised in `lyra-modelling/README.md`. Decision: **build the archetype engine (Model B) first**;
  the event/timing model (Model A, "will X hit +20% in 21/63/126 days") is a fast-follow on the same
  rails. First slice targeted at `workers/emerging_winner/` (not yet on disk). See `lyra-modelling` for
  the modelling detail.
- **Commercial/packaging (nascent):** BYOK + a 14-day hosted-key trial + a standing `ai_included` grant
  (`supabase/migrations/055_ai_included.sql`); no paid tiers, no packaging decisions formalised yet.

## How it works
Strategy currently lives as prose in `docs/` + the modelling research doc, and bet decisions live in git
history + `CHANGELOG.md`. There is no machine-readable decision/strategy register in this folder yet.

## Strengths (verified)
- The thesis is sharp and consistently expressed (research-only, deterministic-engine-decides, mean-reversion).
- There is a live, dated, concrete bet (Emerging Winner Engine) with an explicit build order.

## Gaps, risks, what is missing
- Greenfield on a formal strategy/decision register (Podium ships `decision-register.json` /
  `strategy-registry.json`); Lyra's decisions are implicit in git.
- No commercial packaging/tier strategy yet; the paid seam (`ai_included`) exists but is unpriced.
- Customer/market strategy is pre-users - see `lyra-research`.

## Where to find it
`docs/product/product-principles.md`, `docs/horizons.md`, `docs/PATH-TO-PRODUCTION.md`, `README.md`,
`CHANGELOG.md`, `lyra-modelling/research/2026-07-29-emerging-winner-engine.md`.

## Posture
Product thesis clear and a flagship bet is live; formal strategy/decision registers greenfield.
