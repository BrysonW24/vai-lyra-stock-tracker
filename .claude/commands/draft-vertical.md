# /draft-vertical - turn an accepted scout card into a reviewable vertical PR

You are Claude Code running in the Lyra repo. This chain is v2 of the scout loop - the
"creating" half. A human accepted a scout card (status "planned" on the Ideas board);
your job is to draft the vertical it proposes - theme, companies, chain nodes, backing
events, attach keywords - as a PULL REQUEST the human reviews. You draft; you never merge.

Doctrine: **the scout notices, humans decide, agents draft, humans merge.** Every claim
in the draft must trace to a source a human can check. A vertical with an unverifiable
company, an unbacked small cap, or an invented chain link is worse than no vertical - the
content gates encode most of this, and the adversarial verify stage exists for the rest.
Research framing only, never advice.

## Stage 1 - Pick from the queue

- `npm run scout:queue` lists accepted scout verticals (status planned/in_progress) with
  their evidence. Take the OLDEST planned card unless the human named one.
- Read the card's evidence links and pull the wider drumbeat:
  the scout's own store has more than the card carries -
  `select title, url, summary, source_id from scout_items where unmapped and title ilike '%<entity>%'`
  (pooler access, or ask the human to run it). This is your seed corpus.
- **Gate:** you can state in one sentence what the vertical IS and why the evidence
  suggests it deserves a chain. If the evidence reads as one company's PR cycle rather
  than a sector, STOP and tell the human the card looks premature - that is a finding,
  not a failure.

## Stage 2 - Author + adversarially verify (workflow)

Use a multi-agent workflow (author + verify + deterministic merge, the same shape as the
chain-fattening builds). **First, read `.claude/content-rules.jsonl`** - every rule in it
was learned by a verifier killing a real defect in a previous draft; include the relevant
rules verbatim in BOTH author and verifier prompts so past kills are pre-empted, not
re-discovered. Authors draft, verifiers try to KILL each row:

- **Theme row** (`content/themes.jsonl`): slug, name, emoji, one-paragraph thesis.
- **Companies** (`content/theme-companies.jsonl`): REAL tickers only - every ticker
  verified against a live quote source by a verifier agent. Private companies (most
  emerging-vertical anchors are private) belong in node descriptions, not company rows.
- **Chain nodes** (`content/supply-chain-nodes.jsonl`): the end-to-end value chain,
  tiered upstream -> downstream, with the node id prefix convention.
- **Backing events** (`content/capital-events.jsonl`): every small/micro cap MUST carry
  a disclosed backing event with an actor the backing engine can match
  (`GOVERNMENT_ACTORS` / `HYPERSCALER_ACTORS` regexes in `src/lib/small-cap-lifecycle.ts`)
  - the content coherence tests enforce this and WILL go red on an unbacked small cap.
- **Attach keywords** (`workers/scout/attach.py` theme index source): the terms that let
  the scout map FUTURE news to this vertical - this is what closes the loop (the signal
  that announced the vertical starts populating it instead of banking as unmapped).
- **Gate:** every verifier verdict resolved; no company row without a live-verified
  ticker; no small cap without a matchable backing event.

## Stage 3 - Integrate + prove

- Append the JSONL rows, run `npm run content:build`, then the full gates:
  `npm run type-check && npm test && npm run lint` (the content coherence suite inside
  Vitest is the real judge here) and `node scripts/py.mjs -m pytest tests/ -q`
  (attach tests cover the new keywords - add a pin: the vertical's headline entity must
  attach, and a bare unrelated headline must not).
- **Gate:** all green LOCALLY before any branch is pushed.

## Stage 4 - The PR (the human gate)

- Branch `scout/vertical-<slug>` from a fresh `origin/main`. Commit ONLY the content
  files, generated artifacts, attach keywords, and tests you authored.
- Include a `RELEASES` entry + `npm run release` in the branch. The version counter may
  move on main while the PR sits - whoever merges renumbers ABOVE the head at merge time
  (the monotonicity gate will insist).
- `gh pr create` with: the card's title, the evidence links, what the verifiers checked,
  and the sentence "Drafted from accepted scout card <id> - review the chain, then merge."
- **Never merge it yourself. Never push the branch to main.** The PR sitting unmerged IS
  the success state of this chain.
- Set the card's status to `in_progress` (maintainer or status API) with the PR link in
  a comment if the board supports it; after the human merges, a close-out session sets
  `shipped` - and the v3 stamping pass credits the sources that fed the card.

## Stage 5 - Report

State: the card drafted, the PR URL, row counts per content file, what the verifiers
rejected along the way (rejections are evidence the process works), and the one-line
thesis. The human's next action must be obvious: review the PR.
