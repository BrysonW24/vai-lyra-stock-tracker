# Small-Cap Research System

Status: implemented foundation, live-source ingesters staged.
Last updated: 2026-06-17.

## Goal

Lyra’s small-cap research surface should find early, evidence-backed companies before the trade is obvious. The highest-signal pattern is not “small company mentioned in AI news”; it is overlap between:

- official government spending, contracts, grants, or procurement activity
- buyer-volume and technical confirmation
- a real vertical thesis such as AI infrastructure, AGI compute, quantum, defence, power grid, critical minerals, space, or robotics
- enough liquidity and evidence quality to make a paper-only proposal worth testing

The product remains research-only. The paper bot can simulate proposals, but it never creates, approves, or executes live trades.

## Most Effective Sources

| Priority | Source | Use | Integration |
|---|---|---|---|
| 1 | [USAspending.gov API](https://api.usaspending.gov/) | US contracts, grants, loans and award search by recipient | Next ingester |
| 1 | [SAM.gov Contract Awards API](https://open.gsa.gov/api/contract-awards/) | US award/IDV contract records, agency and vendor data | Next ingester |
| 1 | [AusTender OCDS API](https://github.com/austender/austender-ocds-api) | Australian Government contract notices in OCDS format | Next ingester |
| 1 | [SEC EDGAR data APIs](https://data.sec.gov/) | Form 4, 8-K, 13F, submissions and XBRL company facts | Next ingester |
| 2 | [FINRA equity short interest](https://www.finra.org/finra-data/browse-catalog/equity-short-interest) | Short pressure, squeeze/risk context | Later ingester |
| 2 | [Finnhub API](https://finnhub.io/docs/api) | Market data, company news and fundamentals | Already used for live smart-money extraction when configured |
| 2 | [Twelve Data API](https://twelvedata.com/docs) | OHLCV, indicators and affordable watchlist polling | Later |
| 3 | [Polygon/Massive stocks API](https://massive.com/docs/rest/stocks/overview) | Higher-grade intraday aggregates, trades, quotes and WebSocket alerts | Later paid upgrade |

Primary-source rule: official government and regulator data gets priority over newsletters or social posts. News/social can raise a flag, but it should not be enough to promote a company into the paper-bot queue without technical and evidence confirmation.

## Backend Implementation

Shipped code:

- `src/lib/small-cap-research.ts`
  - source registry
  - deterministic candidate scoring
  - government/backer evidence scoring
  - buyer-volume scoring
  - technical scoring
  - paper-bot readiness tagging
- `src/app/api/small-caps/research/route.ts`
  - returns the backend research contract for the mobile app
- `src/app/small-caps/page.tsx`
  - renders the backend queue before the existing discovery buckets
- `supabase/migrations/025_small_cap_research_backend.sql`
  - `small_cap_source_events`
  - `small_cap_research_scores`
  - `paper_bot_research_candidates`

## Scoring Contract

Each small-cap candidate receives:

- `governmentScore`: policy support, direct award/backer evidence and evidence quality
- `buyerVolumeScore`: volume ratio and score delta from the scanner
- `technicalScore`: scanner score, RSI zone and MACD/histogram confirmation
- `verticalScore`: theme fit, capital flow, policy support and small-cap opportunity
- `riskPenalty`: dilution, hype, crowding and liquidity weakness
- `totalScore`: weighted deterministic research score
- `paperBot.eligible`: true only when score, technicals, buyer volume, liquidity and risk gates clear

Paper-bot readiness is a research queue label only. The existing paper-bot endpoint still requires an explicit proposal and manual approval before a simulated fill.

## Ingestion Roadmap

1. USAspending recipient/award search into `small_cap_source_events`.
2. SAM.gov award and opportunity keyword scans for AI, quantum, defence, autonomy, chips, critical minerals and power-grid terms.
3. AusTender OCDS contract notice scans for AU government spending.
4. SEC EDGAR CIK/ticker mapping, Form 4, 8-K and 13F ingestion.
5. FINRA short-interest files for squeeze/risk context.
6. Upgrade market data from Finnhub/demo to Twelve Data or Polygon depending budget and latency needs.

## Mobile UX

The first screen should show:

- research queue cards with total score, government score, buyer-volume score and technical score
- paper-bot-ready badge when eligible
- tap-through to theme dossier, ticker page or paper bot
- source links visible enough that the user understands why a company surfaced

No card should say “buy.” Allowed labels are research, watch, monitor, review risk and paper bot ready.

## Compliance Notes

- Research only, not financial advice.
- Small caps carry high liquidity, dilution and promotion risk.
- News/social sources are noisy and must not outrank official evidence.
- 13F data is delayed and incomplete: long US-listed holdings only, no shorts, no private positions, and positions may have changed since filing.
