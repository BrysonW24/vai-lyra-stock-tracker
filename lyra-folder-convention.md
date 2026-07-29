# Lyra folder convention

Founder-facing operating folders use the `lyra-<domain>` pattern. The stable `lyra-` prefix keeps
every operating system grouped together and easy to scan in Finder, terminals, and editor sidebars,
separate from the technical folders (`src`, `public`, `scripts`, `status`, `docs`, ...).

This is Lyra's instantiation of the shared mobile-app convention
(`Vivacity.ai/vd-mobile-apps/apps/_template/project-folder-convention.md`), which generalised
Podium's proven `podium-<domain>` system. Lyra graduated to its own standalone repo, so it carries
the same operating structure with its own `lyra-` slug. Each domain is a predictable **home**: fill
it as the work appears, delete the ones Lyra never needs.

## The operating domains

| Folder | For |
| --- | --- |
| `lyra-ai` | AI surfaces, model policy, prompts, guardrails, memory, and fallbacks. |
| `lyra-architecture` | Runtime, data, service, scale, and failure boundaries. |
| `lyra-audits` | Recurring user-readiness audits: dated per-run reports + the movement log (`AUDIT-LOG.md`), scored against the fixed five-dimension rubric. Ships seeded with the methodology - see its `README.md`. |
| `lyra-back-office` | Legal, billing, invoices, taxes, subscriptions, support, vendors, compliance. |
| `lyra-bugs` | Reproducible defect evidence (screenshots + repro notes) and the bug ledger. |
| `lyra-competitors` | Feature watch, product teardowns, positioning, and response decisions. |
| `lyra-content` | Concepts, lessons, drills, scenarios, copy, and content backlog. (Distinct from the top-level `content/` knowledge-source pipeline that feeds `scripts/build-knowledge.mjs`.) |
| `lyra-cyber` | Threat models, privacy controls, security evidence, incidents, and release gates. |
| `lyra-design` | Design system, responsive, accessibility, and experience quality. |
| `lyra-evals` | Deterministic AI quality, provider parity, datasets, and promotion gates. |
| `lyra-forecasting` | Demand, retention, revenue, economics, capacity, reliability, and scenarios. |
| `lyra-marketing` | Campaigns, channels, launch assets, and growth experiments. |
| `lyra-metrics` | KPI, OKR, evidence, event, and claim contracts. |
| `lyra-modelling` | Lyra-specific: the stock oversold-recovery scoring/modelling research and score-parity source of truth. (Lyra domain, no template equivalent.) |
| `lyra-operations` | Cadence, incidents, service ownership, convergence, and AI-native references. |
| `lyra-reporting` | Source authority, privacy-safe aggregation, founder reports, and decision receipts. |
| `lyra-research` | Customer, product, technical, and market evidence. |
| `lyra-strategy` | Customer, product, commercial, packaging, and bet decisions. |
| `lyra-testing` | Benchmark registries, test suites, AI eval lanes, browser and phone QA, and evidence. (Distinct from `tests/` and `workers/**/tests` which hold the executable test code.) |

## Stable technical folders (do NOT rename)

Code, build tooling, data, and the app contract depend on these, so they keep their factory names
and are not founder-facing operating domains:

`assets`, `backlog`, `content`, `contracts`, `docs`, `growth`, `ios`, `native`, `public`, `scripts`,
`sql`, `src`, `status`, `store-assets`, `supabase`, `testflight`, `tests`, `workers`.

New founder-facing domains must use `lyra-*`. This is a compatibility boundary, not licence for new
unprefixed operating folders.

## Known deviations (honest state, 2026-07-29)

- **`testflight/`** currently fills the `lyra-testflight` role (beta screenshots / install evidence).
  Per the convention it should be `lyra-testflight`, but a rename is deferred to a dedicated
  migration because a co-worker (Codex) has pending deletions staged in `testflight/`; renaming now
  would collide with that lane. Rename once that lane closes.
- **`docs/`** stays unprefixed (the template treats `docs` as a stable technical folder; Podium uses
  `podium-docs`). Lyra keeps the template convention - `docs/` holds runbooks, walkthroughs, and
  strategy source docs.
- **`status/`** is seeded as a home with the expected operating-yaml checklist; it is not yet
  populated with Lyra's full belief-graph / promise-registry / route-map set.
