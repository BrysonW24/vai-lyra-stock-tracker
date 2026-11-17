# lyra-evals

> **Current state:** [`STATE-AUDIT.md`](STATE-AUDIT.md) - how this part of Lyra works today (2026-07-29).

> Deterministic AI quality, provider parity, datasets, and promotion gates.

Founder-facing operating domain in Lyra's `lyra-<domain>` structure - see
[`lyra-folder-convention.md`](../lyra-folder-convention.md). Generalised from Podium's proven
`podium-<domain>` system and the `vd-mobile-apps/_template` scaffold.

## What lives here

- **[`MODEL-REGISTRY.md`](MODEL-REGISTRY.md)** - the model-versions space + **the north star**. The
  single ledger of every predictive-model version, what changed, and its one honest number, so
  "we improved the model" is provable. Source of truth: [`model-registry.json`](model-registry.json);
  kept honest by `npm run check:model-registry` (CI-gated).
- **[`MODEL-REPORT-CARD.md`](MODEL-REPORT-CARD.md)** - letter grades per layer + the staged
  improvement roadmap. Regraded every backtest cycle.
- **[`model-metrics-history.jsonl`](model-metrics-history.jsonl)** - the raw backtest numbers per
  cycle, corpus-hashed. Append-only; the north star reads its latest row.

## Also here (fill as the work appears)

- `ROADMAP.md` - what this domain is driving next.
- `PROJECT-STANDUP.md` - running status notes.
- `decision-register.json` / `risk-register.json` - decisions + risks owned here.
- `skill-chains.md` - which skill chains read/write this domain.
- Dated working docs + domain registries as they are produced.

This is a home, not a mandate: fill it as the work appears, delete it if Lyra never needs it.
