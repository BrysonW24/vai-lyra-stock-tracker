# store-assets/ - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
App Store / TestFlight listing collateral (a stable technical folder, not a `lyra-*` operating domain):
screenshots, preview video, description, keywords, review notes.

## Lyra as it is today
Greenfield: `store-assets/` currently holds only its `README.md`. No listing assets are staged here yet.
Related material that DOES exist elsewhere:
- `testflight/` - raw TestFlight beta screenshots + install evidence (the `lyra-testflight` role; rename
  deferred per `lyra-folder-convention.md`).
- `docs/runbooks/app-review-checklist.md` - the App Review checklist.
- `docs/product/beta-testers.md` - beta framing.
- The current iOS build is TestFlight build 3 (2026-07-28); public App Store listing is not yet prepared.

## How it works
Nothing runs from here. When a public App Store release is prepared, the finalised screenshots (per device
size), App Preview video, description, keywords, and `review-notes.md` land here.

## Strengths (verified)
- The App Review checklist + research-only framing already exist, so a listing can be assembled quickly.

## Gaps, risks, what is missing
- Greenfield: no screenshots, no preview video, no finalised description/keywords, no `review-notes.md`.
- Lyra is TestFlight-only today; the public-listing assets are a future-wave deliverable.

## Where to find it
`store-assets/README.md`, `testflight/`, `docs/runbooks/app-review-checklist.md`, `docs/product/beta-testers.md`.

## Posture
Greenfield - established home; assets land when a public App Store release is prepared.
