# status/ - Lyra operating state

> **Current state:** [`lyra-today-snapshot.md`](lyra-today-snapshot.md) - Lyra as it is today (shared grounded facts) (2026-07-29).

Machine-readable operating state for the app: the yaml files a founder (or an agent) reads to know
what Lyra is, what it promises, what runs, and what is decided. Mirrors the
`vd-mobile-apps/_template/status/` set. This folder is a stable technical folder (not a `lyra-*`
operating domain) - see [`../lyra-folder-convention.md`](../lyra-folder-convention.md).

Seeded as a home; populate each file as the state stabilises. Expected set (from the template):

- `identity.yaml` - name, bundle id, category, one-line what-it-is.
- `spine.yaml` - the app's core value spine (see/understand/act loop).
- `thesis.yaml` / `commercial.yaml` - product + commercial thesis.
- `promise-registry.yaml` - every promise the product makes to a user (the claim contract).
- `route-map.yaml` - every route + its purpose + auth gate.
- `feature-map.yaml` - features and their state (live / building / deferred).
- `fitness-functions.yaml` - the executable invariants that must stay true.
- `risk-register.yaml` / `decisions.yaml` - risks + decisions of record.
- `belief-graph.yaml` - what we believe and the evidence behind it.
- `repo-atlas.yaml` - the folder/section map of the repo.
- `research.yaml` / `lessons.yaml` / `parking-lot.yaml` / `timeline.yaml` - evidence, lessons, deferred ideas, history.
- `launch-scorecard.md` / `release-checklist.yaml` - launch readiness.

Do not let this drift from reality: a status file nobody reads back is the smell it exists to catch.
