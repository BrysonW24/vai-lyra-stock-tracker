# Lyra README Improvement Audit

> Audit date: 16 July 2026
> Target: `BrysonW24/vai-lyra-stock-tracker`
> Local source: `/Users/brysonwalter/Developer/vai-lyra-stock-tracker`
> Public baseline: commit [`01e1489`](https://github.com/BrysonW24/vai-lyra-stock-tracker/commit/01e1489a765475fa35a092cfa2ff1d3da6a96440), dated 27 June 2026

## Outcome

The README has a strong product voice, real visual proof and an unusually easy
demonstration-mode entry point. Its main weakness is that it no longer represents the
size or shape of the application. A 43-page research platform is presented as a small
momentum scanner, while a few setup and cost claims are ahead of what a visitor can
verify from the public repository and hosted site.

Recommended rating:

| Surface | Current score | Why |
|---|---:|---|
| Public GitHub README | 62/100 | Attractive and understandable, but stale setup instructions, limited feature coverage and weak operating truth |
| Local working draft | 76/100 | Fixes the port and schema paths and adds replication guidance, but has a broken cost link and claims an undeployed health route |
| Target after this brief | 92/100 | Product-first opening, honest capability map, verified setup paths, limitations, proof and maintainable navigation |

The best rewrite is not a longer version of the current README. It is a better ordered
one: product and proof first, a 60-second try path second, grouped capability coverage
third, and detailed setup links after that.

## Evidence Snapshot

### Current State

- Public `main` is at version `0.6.0` and commit `01e1489`.
- The local working tree contains uncommitted README, deployment, health-check and
  walkthrough improvements that are not visible on public GitHub.
- The local app contains 43 page routes, 28 API routes, four Python worker packages,
  28 Supabase migrations, 28 TypeScript test files and 18 Python test files.
- The public Vercel surface responds and redirects visitors to `/welcome`.
- The public Vercel surface returns 404 for `/api/health` as of 16 July 2026; the route
  exists only in the local working tree at the time of this audit.
- Every local README image path resolves.
- `COSTS.md` does not exist, although the local README links to it twice and lists it in
  the project tree.

### Verification

| Check | Result |
|---|---|
| `npm run doctor` | Pass |
| `npx tsc --noEmit` | Pass |
| `npm test` | Pass: 28 files, 255 tests |
| `.venv/bin/python -m pytest tests -q` | 173 passed, 1 failed, 16 warnings |
| README relative links | One missing target: `COSTS.md` |
| README image paths | All resolve locally |
| Hosted `/api/health` | 404 |

The Python failure is in `tests/test_multiuser.py`. The test supplies a UTC timestamp
but omits a timezone preference, while current code intentionally defaults quiet-hour
evaluation to `Australia/Sydney`. The newer timezone-specific tests pass, so this looks
like a stale expectation rather than evidence that quiet-hour conversion is broken.

## Priority Findings

### P0 - Fix Before Publishing the Local README Draft

1. **Resolve the missing cost document.**
   `README.md` promises itemised costs and links to `COSTS.md`, but the file is absent.
   Either add a dated, sourced cost document or remove the claim until it exists.

2. **Do not present the health route as deployed until it is deployed.**
   The local route is real, but `https://vai-lyra-stock-tracker.vercel.app/api/health`
   currently returns 404. Use wording such as "available after deploying this version"
   until the hosted surface is refreshed.

3. **Publish the corrected quickstart and schema path together.**
   The public README still runs bare `npm run dev` and then points to port 3042. It also
   directs users to the older `sql/` folder. The local draft correctly uses
   `npm run dev -- -p 3042` and identifies `supabase/migrations/` as canonical. These
   changes should land as one coherent documentation release.

4. **Replace the unconditional free/always-on claim.**
   The current draft says a fully live, always-on setup can run on free tiers. That needs
   qualification:

   - Vercel describes Hobby as a personal, non-commercial plan: [Vercel pricing](https://vercel.com/pricing).
   - Supabase says free projects can pause after a week of inactivity and have explicit
     resource caps: [Supabase pricing](https://supabase.com/pricing).
   - Standard GitHub-hosted runners are free for public repositories, but scheduled jobs
     can be delayed and, under heavy load, dropped: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) and [workflow troubleshooting](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows#scheduled-workflows-running-at-unexpected-times).

   Recommended wording: "A personal evaluation can start at $0 within provider limits.
   Commercial hosting, AI calls, higher data volumes and stronger availability may add
   cost. See the dated cost guide."

### P1 - Make the README Represent the Product

1. **Name the strategy precisely in the opening.**
   Lyra is an oversold-recovery scanner: it finds beaten-down names showing an early
   turn. It is not a generic strength or breakout momentum product. Put that distinction
   in the first paragraph because it changes how a reader interprets a high score.

2. **Replace seven feature bullets with six capability groups.**
   The current list omits most of the product. Use this grouping:

   | Capability | What to mention |
   |---|---|
   | Discover | Command Centre, Signal Radar, Live Wire, Findings and Investigation Graph |
   | Research | Charts, fundamentals, themes, supply chain, small caps, investors, filings, IPOs and commodities |
   | Personalise | Portfolio, watchlist, trade log, saved research and alert preferences |
   | Rehearse | Paper account, Paper Bot, simulation, strategy lab, backtesting and Pine export |
   | Explain | Grounded briefs and chat through OpenAI, Anthropic, OpenRouter, Google or xAI |
   | Operate | Supabase, hourly worker, PWA, Web Push, Telegram, WhatsApp and deployment runbooks |

3. **Show capability status, not just capability names.**
   A compact status table prevents readers from confusing demonstration content,
   configured data, optional AI and future broker transport:

   | Mode | Available after clone | Requires configuration | Important limit |
   |---|---|---|---|
   | Demo | Full interface and sample data | Nothing | Data is illustrative |
   | Data | Scanner, accounts and private overlays | Supabase plus worker configuration | Provider freshness varies |
   | Alerts | In-app/Web Push, Telegram and WhatsApp paths | Channel credentials and preferences | Scheduled delivery is best effort |
   | AI | Deterministic fallback | Hosted key or browser BYOK | AI explains grounded facts; it does not own scores |
   | Paper trading | Rehearsal and risk gates | Optional live quotes | No real broker order placement |

4. **Correct the notification story.**
   The README still says Telegram in the feature and stack lists. The code now includes
   Web Push, Telegram and WhatsApp dispatch paths. State the channels, then link to the
   notification guide rather than explaining every credential in the README.

5. **Surface Pine export and investigation as lead differentiators.**
   Version `0.6.0` was specifically about exporting the deterministic score to a Pine
   strategy, while versions `0.4.0` and `0.5.0` added Findings and the Investigation
   Graph. Those are more distinctive than a generic list of indicators and should be
   visible near the top.

### P1 - Repair the Visual Story

1. Rename `How to Access Lyra` to `Install Lyra on your phone` or `Add the PWA to your
   home screen`.
2. Remove the empty `Lyra Notifcations` section or populate it; also correct the spelling.
3. Remove duplicate section number `1` and stop numbering feature screenshots as if they
   were setup steps.
4. Reduce the gallery from 20 similarly sized phone screenshots to four proof groups:
   first-run, Command Centre, investigation, and paper/research tools.
5. Give each image a specific caption and alt text. Repeated `Command centre` alt text
   provides little accessibility or search value.
6. Put one strong hero screenshot directly under the opening and move the rest below the
   feature map.

### P2 - Improve Technical Accuracy and Maintenance

1. Change "read-only frontend key" to "publishable frontend key governed by Row Level
   Security". The key is intentionally public; RLS and authenticated routes provide the
   boundary.
2. In the project tree, describe `supabase/migrations/` as canonical and `sql/` as the
   older scanner-only path. The current local draft contradicts itself by warning against
   `sql/` in one section and describing it as the schema in another.
3. Link to `ARCHITECTURE.md` and `docs/README.md` instead of maintaining an increasingly
   incomplete hand-written tree in the README.
4. Add a verification block with `npm run type-check`, `npm test` and
   `npm run worker:test`, but do not add a green CI badge until a push/pull workflow runs
   those checks. The only current workflow is the hourly scanner.
5. Add direct links to `DISCLAIMER.md`, `PRIVACY.md`, `SECURITY.md`, `CONTRIBUTING.md` and
   `CHANGELOG.md` in a compact documentation table.
6. Add the live demo URL near the top. The hosted app itself is a stronger proof point
   than a long screenshot wall: [Lyra live demo](https://vai-lyra-stock-tracker.vercel.app).

## Recommended README Structure

Use this order:

1. Product name, one-sentence promise and research disclaimer.
2. Live demo, local demo and documentation links.
3. One hero screenshot.
4. "What Lyra actually does" with the six capability groups.
5. "How the score works" with the oversold-recovery distinction.
6. Mode/status table covering demo, data, alerts, AI and paper trading.
7. 60-second local start.
8. "Choose your setup path" linking to walkthroughs and `/setup`.
9. Architecture diagram and top-level stack.
10. Verification commands.
11. Limitations and safety boundaries.
12. Documentation index, contributing and licence.

Detailed Supabase, Coolify, notification and AI setup belongs in linked walkthroughs and
runbooks. The README should help a visitor decide, try and orient; it should not duplicate
every operations guide.

## Suggested Opening Copy

````markdown
# Lyra - Oversold-Recovery Stock Research Console

Lyra finds beaten-down technology stocks that may be starting to recover. Its
deterministic engine scores RSI reset, MACD improvement, price location, trend and volume;
the optional AI layer explains those facts in plain English without owning the numbers.

Research and education only. Lyra does not provide financial advice or place broker
orders.

[Try the live demo](https://vai-lyra-stock-tracker.vercel.app) | [Run locally](#run-in-60-seconds) | [Read the architecture](./ARCHITECTURE.md) | [Security](./SECURITY.md)

## Run in 60 seconds

```bash
git clone https://github.com/BrysonW24/vai-lyra-stock-tracker.git
cd vai-lyra-stock-tracker
npm install
npm run dev -- -p 3042
```

Open http://localhost:3042. No account, database or API key is required for demo mode.
````

## Target State

The improved README should let three readers succeed without reading the whole file:

- A curious visitor can understand the strategy and open the demo in under 30 seconds.
- A developer can clone and start demonstration mode in under five minutes.
- An operator can choose a linked data, alert, AI or hosting walkthrough without having
  to infer which credentials are safe for the browser.

Every major claim should point to one of four proof types: a working route, a test, a
source file, or a current external provider document.

## Migration Step

Apply the rewrite in this order:

1. Add or remove the `COSTS.md` references.
2. Deploy `/api/health`, or label it as pending deployment.
3. Replace the heading and screenshot block.
4. Add the grouped feature and mode tables.
5. Correct the notification, schema and RLS language.
6. Add the live demo, architecture and documentation links.
7. Run the link checker, TypeScript checks, Vitest and pytest.
8. Resolve the stale quiet-hours test before showing an all-green verification badge.
9. Commit the README, walkthroughs, deployment files and health route together so public
   GitHub does not expose half of the new setup path.

This document is an audit and implementation brief. It intentionally does not modify the
current README or the user's existing working-tree changes.
