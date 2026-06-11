# content/ - AI-native content layer

This directory is the **single source of truth for the app's editorial / reference content** -
the data that goes stale and needs updating (IPO reference prices, smart-money holdings,
commodities notes, etc.). It is designed to be trivially editable by an agent or a human
**without touching any source code**.

## How it works

- One **JSONL** file per content domain (`<domain>.jsonl`). **One record per line.**
- `scripts/build-content.mjs` compiles every `*.jsonl` here into importable JSON at
  `src/lib/generated/<domain>.json` (client components cannot read the filesystem at
  runtime, so the build step bridges it).
- The matching `src/lib/<domain>.ts` imports that generated JSON and re-exports it with the
  domain's TypeScript type. The type lives in code; the **data** lives here.
- Compilation runs automatically via `predev`, `prebuild`, and `pretype-check`, or manually:

  ```bash
  npm run content:build
  ```

## Updating a fact (the whole point)

To change, say, SpaceX's estimated reference price, you edit **one line** in
`content/ipos.jsonl` and re-run `npm run content:build` (or just start the app). No grep
through `.tsx` files, no code change, no risk of breaking a component.

## Rules for editing

- Each line must be a single valid JSON object. Blank lines and lines starting with `//`
  are ignored.
- Keep the field names exactly as the domain's TypeScript interface in `src/lib/<domain>.ts`
  expects - the codegen does not rename or coerce.
- Never use em dashes or en dashes in copy fields; use a plain hyphen `-`.
- `manifest.json` (generated) lists every domain so an agent can discover them in one read.

## Domains

| Domain | File | Backing type | Surfaced in |
|--------|------|--------------|-------------|
| Commodities | `commodities.jsonl` | `Commodity` (`src/lib/commodities.ts`) | Commodities page |
| IPOs | `ipos.jsonl` | `IpoCompany` (`src/lib/ipos.ts`) | IPO Radar + deep-dive |
| Smart money | `smart-money.jsonl` | `SmartMoneyItem` (`src/lib/smart-money.ts`) | Smart Money page |
| Themes | `themes.jsonl` | `Theme` (`src/lib/world-radar.ts`) | World Radar + theme dossiers |
| Supply-chain nodes | `supply-chain-nodes.jsonl` | `SupplyChainNode` (`src/lib/world-radar.ts`) | Theme dossiers (supply-chain map) |
| Theme companies | `theme-companies.jsonl` | `ThemeCompany` (`src/lib/world-radar.ts`) | Theme dossiers + Small Caps |
| Capital events | `capital-events.jsonl` | `CapitalEvent` (`src/lib/world-radar.ts`) | World Radar + theme dossiers |
| Investors | `investors.jsonl` | `Investor` (`src/lib/world-radar.ts`) | Investor Radar + theme dossiers |
