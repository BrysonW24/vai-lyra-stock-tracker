# growth/ - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
Machine-readable growth config + experiment records (a stable technical folder, not a `lyra-*` operating
domain). Founder-facing campaign/channel strategy lives in `lyra-marketing/`.

## Lyra as it is today
Greenfield config home: `growth/` currently holds only its `README.md`. The template ships a
`growth/landing.yaml` block the site build reads; Lyra has not populated one - its landing renders
directly from `src/app/welcome/` + `src/components/landing/` instead. No experiment records exist yet.

## How it works
Nothing runs from here yet. When populated, `landing.yaml` would feed landing copy/config, and one file
per experiment would record hypothesis/variant/metric/result.

## Strengths (verified)
- The home + convention are in place, so growth config has a predictable destination.

## Gaps, risks, what is missing
- Greenfield: no `landing.yaml`, no growth experiments. The live landing is hard-coded in components.

## Where to find it
`growth/README.md`, `src/app/welcome/`, `src/components/landing/`, `lyra-marketing/STATE-AUDIT.md`.

## Posture
Greenfield config home - established, unpopulated.
