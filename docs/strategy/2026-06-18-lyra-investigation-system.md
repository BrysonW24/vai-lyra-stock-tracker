# Lyra Investigation System - Opportunity Findings + the Drawer Stack

> Status: Phase 1 shipped (2026-06-18). This doc is the architecture + the road ahead.
> Companion: `2026-06-18-lyra-forward-bets.md` (GenUI-in-drawer + the rating loop).

## The idea in one sentence

Lyra is not a dashboard, it is an **investigation system**: every surfaced setup is an Opportunity
Finding, every finding has evidence, every evidence item links to entities, every entity links to
patterns, and every pattern links to research actions - and the user peels back each layer through a
nested drawer stack. Wiz for investing intelligence.

A finding answers five things instantly: **What surfaced? Why did Lyra surface it? What evidence
supports it? What is it connected to? What can I do next?**

## Why this fits Lyra (it is mostly composition, not greenfield)

The causal chain Lyra already scans - themes -> supply-chain bottlenecks -> companies -> evidence ->
technical confirmation - *is* the investigation graph. The data already exists; Phase 1 gave it a
presentation.

- **Finding spine already exists:** `notification_events` (router.ts + types.ts) already models what
  surfaced, the trigger reason, relevance, dedupe, and the related entity/theme. A signal alert, a
  price move, a small-cap discovery are already findings - delivered as notifications, not yet
  rendered as an investigable feed.
- **Evidence engine already exists:** the `research_analyst` agent (run-agent.ts) emits cited,
  confidence-scored output, gated by `assertNoFabricatedNumbers`. The AI corpus now carries themes,
  supply-chain nodes, bottlenecks, IPOs and education modules (tools/index.ts).
- **The honesty line is free and is the moat:** every evidence item carries "what it does not prove."
  That is the literal embodiment of Lyra's deterministic-decides / AI-explains / research-not-advice
  doctrine and reuses the fabrication guard. Competitors do not write that line because most cannot.

## Phase 1 - what shipped (the interaction model, on demo data)

Lives at `/findings` (the existing `/intelligence` is the market-news feed; left untouched).

- `src/lib/findings/types.ts` - the model: `Finding`, `Entity`, `EvidenceItem`, `Relationship`,
  `TimelineEvent`, `RiskNote`, `FindingAction`, plus the `FindingState` lifecycle and the
  research-only `FindingActionKind` (never Buy: research / watch / monitor / compare / paper_bot /
  review_risk).
- `src/lib/findings/demo-findings.ts` - BKSY + SOUN, with nested evidence -> source records ->
  entities -> relationships -> timeline, sharing the `node:earth-observation` node so the
  connected-companies pattern is demonstrable.
- `src/lib/findings/stack.ts` - the URL drawer-stack codec (entity ids contain colons, so it splits
  on the first colon only and round-trips exactly). Pure + tested.
- `src/components/findings/FindingsFeed.tsx` - ranked finding cards grouped into sections; owns the
  drawer stack via the URL (`?inv=`), so an investigation is shareable and survives reload.
- `src/components/findings/InvestigationDrawerStack.tsx` - the nested drawer: Finding (tabs
  Summary / Evidence / Risk / Timeline / Actions) -> Evidence (with "what it does not prove") ->
  Source Record (raw payload + Lyra interpretation + limitations) -> Entity -> its connected
  entities, with a breadcrumb and back.
- Tests: `tests/findings-model.test.ts` (every evidence has the honesty line, every link resolves,
  the connected-pattern holds, vocabulary is research-only) + `tests/findings-stack.test.ts`
  (URL round-trip).

The signature interaction works end to end: open BKSY -> why surfaced -> government evidence ->
source record -> earth-observation node -> see PL exposed to the same bottleneck. One stock becomes a
pattern.

## The Finding lifecycle (the pre-boom story)

Findings are not one-shot. They are a **persisted lifecycle that accretes evidence over time**:

```
Monitor -> Watchlist candidate -> Deep research candidate -> Paper-bot research queue -> Review risk
```

The Timeline tab is what reveals "evidence was building before price moved" - a patent in May, a
government award in June, volume rising, the score crossing 70, promotion to the research queue. The
existing notification dedupe/event model already supports accretion; live findings get promoted
through states as evidence stacks.

## Trust patterns (non-negotiable, and consistent with the rest of Lyra)

- **Why surfaced** block on every card and finding: evidence / market / technical / theme / risk lines.
- **What it does not prove** on every evidence item; **Lyra interpretation + Limitations** on every
  source record.
- **No Buy.** The action vocabulary is Research / Watch / Monitor / Compare / Simulate / Review risk /
  Ask Lyra / Paper Bot - enforced at the type level and tested.
- The deterministic engine owns every number; the drawers format and explain, they never recompute or
  invent. GenUI-in-drawer (forward-bets doc) extends this: the AI generates the *view*, never a value.

## The road ahead

- **Phase 2 - depth:** richer entity drawers (company / theme / supply-chain node / investor) and the
  Timeline wired to real evidence beats. (Entity + timeline drawers exist in Phase 1; Phase 2 deepens
  them and adds the company/investor detail surfaces.)
- **Phase 3 - the graph:** a curated, explorable relationship map at `/graph` (node types: company,
  theme, supply-chain node, commodity, agency, contract, patent, filing, investor, signal, holding).
  Each node opens a drawer. This is the "deep investigation" surface.
- **Phase 4 - live wiring + GenUI:** replace demo findings with a `findingsFromEvents()` adapter over
  `notification_events`, `small-cap-research`, scanner signals and `research_analyst` cited evidence;
  add a `findings` persistence table for the lifecycle; and let a finding offer "want to see what this
  could look like?" -> a GenUI view generated in the drawer (deterministic numbers, AI-composed
  layout, fabrication-guarded). See the forward-bets doc.

## Near-term seeds (cheap now, make later phases cheaper)

1. Keep `notification_events` rich (entity/theme/relevance/dedupe) - it is the live Finding source.
2. Keep `research_analyst` citations structured - they are the live evidence stack.
3. Keep the `FindingActionKind` vocabulary research-only as features grow.
4. When the live adapter lands, map one notification type (signal_alert) first to prove parity, then
   widen.

## What makes it defensible

The evidence chain + the "what it does not prove" honesty line + the deterministic spine. Anyone can
show a stock going up. Lyra shows *why it surfaced, what proves it, what it connects to, and what it
does not prove* - and lets you walk the whole chain. That is a research instrument, not a ticker.
