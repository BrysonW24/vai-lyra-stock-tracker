# lyra-marketing - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
Campaigns, channels, launch assets, and growth experiments. Today: the landing surface is live and
tested; campaigns/channels/growth-experiments are greenfield.

## Lyra as it is today
- **Landing surface (live):** `src/app/welcome/` + `src/components/landing/` (StackSection, FutureStateAI,
  UltimateGoals, FeatureTiles). The hero states the oversold-recovery framing plainly, WhatsApp is
  qualified "(Meta template)", fine print is AA-pass with 44px footer links, and the CTA decision is an
  extracted, tested pure function (`getWelcomeEntry`). Assessed at 92/100 in the gap-to-95 audit (V16).
- **Growth config home:** `growth/` exists (README only - no `landing.yaml` or experiment records yet).
- **Acquisition channel today:** TestFlight beta (build 3, 2026-07-28). `docs/messaging-roadmap.md` +
  `docs/product/beta-testers.md` hold the messaging + beta framing.
- **Campaigns / channels / paid growth:** greenfield.

## How it works
The landing renders from `src/app/welcome`; there is no campaign engine, channel plan, or experiment
loop yet. Marketing today = the product's own landing page + a TestFlight beta invite.

## Strengths (verified)
- The landing is honest and tested (no leaked background-delivery claims in the Solo build; oversold
  framing pinned) - a trustworthy front door.

## Gaps, risks, what is missing
- Greenfield: campaigns, channel plans, growth experiments; `growth/landing.yaml` + store-assets listing
  not populated.
- gap-to-95 V16 residuals: Solo/Community conditional landing copy is unpinned; flip-card captions fail AA.

## Where to find it
`src/app/welcome/`, `src/components/landing/`, `growth/`, `store-assets/`, `docs/messaging-roadmap.md`,
`docs/product/beta-testers.md`, `lyra-audits/2026-07-29-gap-to-95-audit.md` (V16).

## Posture
Landing live and tested; campaigns/channels/growth-experiments greenfield.
