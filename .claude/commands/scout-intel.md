# /scout-intel - keep the broad-signal scout honest and its cork board trustworthy

You are Claude Code running in the Lyra repo. Run the scout upkeep loop: the source
registry stays real, the fetch layer degrades cleanly, attachment stays conservative,
clustering stays junk-free, and every idea card the scout files carries evidence a human
can check. This chain owns `workers/scout/`, `content/scout-sources.jsonl`, and the feed
surface ("what the scout saw": `src/app/api/scout/` + `src/components/community/ScoutFeed.tsx`,
backed by the `scout_runs` ledger the worker writes each run). It shares the ideas surface
with `/feedback-loop` (board UI + `src/app/api/community/`, including the grounded AI-read
route `src/app/api/community/ideas/brief/`).

Doctrine: **the scout notices, humans decide.** The scout only files evidence-linked
cards (origin='scout') into the community_ideas table - surfaced as "Scout proposals"
on the SCOUT tab, never on the Ideas tab (the Ideas tab is purely human feature
requests; external signals stay on Scout - see ScoutProposals.tsx). It NEVER mutates
the vertical map, and 'accepted' status transitions are maintainer-only
(RLS-enforced, migration 043).
Confidence is breadth math (items x sources), never a model opinion.

## What already exists (build WITH it)

- **Registry** - `content/scout-sources.jsonl`: ~100 curated + adversarially verified
  sources. Kinds: `api` (Finnhub general news, env-gated), `rss` (open feeds, fetch with
  stdlib XML parsing - no feedparser dependency), `crawl` (Firecrawl hosted API,
  `env:FIRECRAWL_API_KEY`), `x` (registered voices, `gated:x-api` until credentials
  exist). Access gating lives in `workers/scout/sources.py::active_sources`.
- **Pipeline** - `workers/scout/main.py`: fetch -> dedupe -> deterministic attach
  (`attach.py`, keyword index built from `src/lib/generated/*.json`; bare 2-3 letter
  tickers NEVER match - $SYM or 4-5 letter words only) -> persist `scout_items` ->
  cluster the trailing 14-day unmapped window (`cluster.py`, multi-word entities only,
  >=3 items from >=2 independent sources) -> upsert idea cards by `dedupe_key`.
- **Board** - `community_ideas` with scout columns (origin/kind/evidence/confidence,
  migration 043); UI badge + evidence links + maintainer status buttons in
  `src/components/community/IdeasBoard.tsx`.
- **Schedule** - nightly-maintenance.yml step "Scout worker", failure-visible (records
  into worker-failures, never a silent green).

## Stage 1 - Registry health

- Run `npm run worker:scout` locally with Supabase env EMPTY (demo mode). Every rss
  source should log a fetch; note any that return 0 items two runs in a row.
- Dead or moved feeds: fix the URL if the outlet still publishes, delete the row if it
  is gone. Never leave a knowingly-dead row - the registry's contract is "everything
  here is believed real".
- Gate: `python -m pytest tests/test_scout_worker.py` green.

## Stage 2 - Attachment honesty

- Sample 10 recent `scout_items` marked unmapped: should any have attached? If a real
  vertical term is missing from the index, the fix is CONTENT (themes/nodes/companies
  keywords), not a looser matcher.
- Sample 10 attached items: false attachments mean a term in the index is too generic -
  add it to `STOP_TERMS` in `attach.py`.

## Stage 3 - Cluster quality

- Read the scout cards on the board (origin='scout'). Junk cards ("Emerging signal:
  General") mean the junk-word list or the multi-word rule regressed - fix in
  `cluster.py` and add the offending phrase to the tests.
- Every card must have >= MIN_ITEMS evidence links that actually support the title.

## Stage 4 - Access expansion

- When `FIRECRAWL_API_KEY` lands: the crawl sources activate automatically; verify the
  DoD contracts page yields items and stays within Firecrawl's plan limits.
- When X API access lands: implement an `x` adapter in `providers.py` (fetch_source
  currently returns [] for kind='x'), then flip those rows' access from `gated:x-api`.

## Done means

- Registry has zero knowingly-dead sources; gated counts reported honestly.
- Scout runs green in demo AND live modes; nightly step visible in the failure report.
- Every scout card on the board is evidence-linked and junk-free.
- `npm run check:chains` green (this chain owns `workers/scout/`).
