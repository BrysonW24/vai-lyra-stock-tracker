# LOOPS.md - every loop in the system, end to end

Lyra is not a pipeline, it is a set of **loops**: each one has a trigger, does work, writes a
ledger, and something downstream reads that ledger back - usually feeding the next turn of the
same loop. A pipeline that never reads its own output is just an expensive log. This file maps
every loop top to bottom so nothing runs unread and nothing is read that never runs.

Companions: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (structure - what exists),
[`HARNESS.md`](./HARNESS.md) (enforcement - what keeps it honest),
[`DATA-ECONOMICS.md`](./DATA-ECONOMICS.md) (weight - what it costs and when history stops paying).

## The loop map

| # | Loop | Trigger | Ledger it writes | Who reads it back | Standing gate |
|---|---|---|---|---|---|
| 1 | Hourly scan | GHA cron `:17`/`:47`, market-hours gated | candles, signals, scores, indicators, alerts | dashboard, loop 2, loop 4 | CI worker tests, `check:schema-drift` |
| 2 | Outcome learning | nightly 22:05 UTC | `signal_outcomes`, `component_efficacy` | track record, `/signal-quality` retune | efficacy saturation ERROR |
| 3 | Digest + reviews | nightly / period-end | notification events | you, on your phone | worker tests |
| 4 | Notification delivery | every event + nightly sweep | `notification_deliveries`, `notification_engagements` | sweep, relevance tuning | `/notification-health` chain |
| 5 | Scout (notice-create-learn) | nightly 22:05 UTC | `scout_items`, `scout_runs`, ideas, source scores, stoplist | Scout-tab proposals, next night's clustering | zero-writes guards, saturation flags |
| 6 | Macro + calendar | hourly snap + seasonal crons | `market_context_snapshots`, calendar events | dashboard strips, loop 3 baselines | RBA no-number degradation |
| 7 | Horizon-2 workers | nightly 22:05 UTC | events, IPOs, fundamentals, news, hype | calendar, radar, detail pages | worker-failures reporter |
| 8 | AI copilot | user chat | `chat_turns`, `ai_runs` | twin memory, gap-miner, `/ai-ops` | budgets, injection fence, `/ai-quality` |
| 9 | Paper bot | signals + user commands | intents, orders, positions, equity snapshots | cockpit, approval gate | signed-capability approval |
| 10 | Data economics | nightly 22:05 UTC | the gate report itself | founder (ratifies pruning) | `check:data-economics` tripwires |
| 11 | Release | every push | `version.ts` RELEASES, CHANGELOG | `/whats-new`, deploy smoke, announce | version-guard + monotonicity + CI + smoke |
| 12 | Agent learning | every incident / verifier kill | `harness-incidents.jsonl`, `.claude/content-rules.jsonl` | next session, next draft workflow | `check:ledgers` |

Loops 1-2-3-4 are one circle (scan -> label -> coach -> deliver -> engage). Loop 5 is its own
circle. Loops 10-11-12 are the meta-circle that keeps the first nine honest.

---

## 1. The hourly scan loop - the heartbeat

```text
GHA cron :17 + :47 (hourly-stock-scanner.yml)
  |
  v
market-hours gate (skip outside US session)      workers/stock_scanner/main.py
  |
  v
yfinance fetch ~99 symbols (1h bars)             market_data.py  (network, NOT the DB)
  |
  v
indicators: RSI / MACD / SMA / 60-period low     indicators.py, derived_features.py
  |
  v
deterministic score (component values kept)      scoring -> stock_signal_scores
  |
  v
lifecycle vs previous signal (delta, states)     supabase_repo.get_previous_signal
  |
  +--> persist: candles, signals, scores, indicators, scanner_run row
  |
  v
alert engine: setups, portfolio risk,            alert_engine.py
watchlist + price-move thresholds
  |
  v
cooldown dedupe (6h/12h/30d by type)             recently_alerted() on stock_alerts
  |
  v
HTTP POST -> /api/notifications/dispatch  ------------->  [loop 4 takes over]
```

What closes it: the next hour's run reads `get_previous_signal` from this hour's write - score
deltas and lifecycle transitions only exist because the loop eats its own output. The scanner
never reads `stock_candles` back for scoring (it re-fetches live); the stored candles exist for
loops 2 and 3.

## 2. The outcome-learning loop - the engine grades itself

The core circle of the whole product. AI explains, the deterministic engine decides, and this
loop is how the engine finds out whether it was right.

```text
nightly 22:05 UTC (nightly-maintenance.yml)      workers/stock_scanner/outcome_job.py
  |
  v
load signals (90d window) + stored candles
  |
  v
label forward returns: 1d / 5d / 20d / 60d  -->  signal_outcomes (upsert; resolved rows
  |                                              never change again - the distilled learning)
  v
coaching follow-ups (5-day "how did that         send_followups() -> loop 4
setup actually go" messages, 14d max age)
  |
  v
component_efficacy FULL rebuild:                 efficacy_job.py
signal_outcomes x stock_signal_scores
per (strategy, component, tercile band,
5d/20d horizon) -> n, win_rate, avg_return
  |
  v
/signal-quality chain: a HUMAN (or agent with    .claude/commands/signal-quality.md
a human merge) reads the evidence and retunes
thresholds/weights in code
  |
  v
the deterministic engine scans differently  -->  [back to loop 1]
```

What closes it: retuning is evidence-gated ("no sample, no claim") and lands as a reviewed code
change - the engine itself stays static between ratified retunes. The rebuild is full-history
by design; its read caps log a saturation ERROR rather than silently under-counting
([`HARNESS.md`](./HARNESS.md): a green that cannot go red is not a signal). The public
`/track-record` page reads `signal_outcomes` raw - the loop's honesty is a product surface.

## 3. The digest + review loops - cadence stack

```text
daily (Mon-Fri nightly)      weekly (Fri)           monthly / quarterly / yearly
      |                          |                          |
      v                          v                          v
digest_job: last 24h of     digest_job: last 7d     review_job: period baseline vs now
signals + alerts, plus      "the week that was"     - baseline close = first candle at/after
earnings/IPO T-1 notices    + AUD-terms line from     period start (up to 5 grace days late)
(event_radar over loop 7's  market_context          - benchmark ("you vs S&P 500") line from
tables) and the CGT         snapshots [loop 6]        market_context_snapshots [loop 6]
365/30-day radar (from
portfolio purchase dates)
      +----------+---------------+--------------------------+
                 v
       notification event (dedupe-keyed per user+day/period)  -->  [loop 4]
```

What closes it: nothing writes back - these are read-out loops. Their retention needs are what
bind loop 10's horizons (the yearly review baseline is WHY candles keep 380 days, not 180 -
audited in [`DATA-ECONOMICS.md`](./DATA-ECONOMICS.md) section 6).

## 4. The notification loop - deliver, hold, sweep, learn

```text
event arrives (loops 1/2/3/5/6/7/9)              src/lib/notifications/dispatch.ts
  |
  v
dedupe probe (user_id + dedupe_key;              notification_events (unique index backstop)
day-scoped keys for digests, LIFETIME keys
for portfolio/watchlist thresholds)
  |
  v
route: prefs, relevance, quiet hours             routeNotification (explicit timezone)
  |
  +--> deliver now: push / telegram / slack /    every internal link tagged ?nid=&ch=
  |    whatsapp (each attempt -> deliveries)
  |
  +--> HOLD (quiet hours / instant off) -> notification_deliveries status=held
  |
  v
held release runs at the top of EVERY dispatch   releaseHeldEvents - held rows live
for that user; the nightly sweep (22:05) exists  until released, never age out; sweep
for users with no new events + retries failed    retry window for failed chat sends
chat sends once (24h window)                     is 24h
  |
  v
user taps a tagged link -> beacon POST           NotificationEngagementBeacon ->
/api/notifications/engaged -> first              /api/notifications/engaged
(event, channel) wins
  |
  v
notification_engagements - the behavioral        [future: relevance tuning reads which
ledger: which alerts actually got acted on       alert types earn taps -> better routing]

...and the loop runs BOTH ways: replies in the   src/app/api/webhooks/telegram/route.ts
same chat are commands - a closed set (status,   (+ whatsapp) -> InboundCommand, a closed
portfolio, watchlist, today, mute, unmute,       enum in src/lib/notifications/types.ts
paper, approve, reject, killswitch). mute/
unmute write routing prefs [back into this
loop]; approve/reject drive loop 9's gate
```

What closes it: today, engagement accumulates and routing does not yet read it - that is the
open half of this loop, by design (ship the ledger first, tune from evidence later). The
`/notification-health` chain audits the delivery side; loop 10 audited this table as
keep-forever (lifetime dedupe keys + findings projections).

## 5. The scout loop - notice, create, learn

Three sub-loops sharing one nightly run (`workers/scout/main.py`):

```text
NOTICE (every night)
  fetch ~100 registered sources (36 RSS open; 1 API +   workers/scout/sources.py,
  22 crawl + 41 X gated behind keys)                    providers.py
  |
  v
  dedupe -> deterministic attach to vertical themes     attach.py (keyword index from
  (attach-exception ledger enforced - a corrected        generated JSON; exceptions from
  mis-attach can never recur)                            scout_attach_exceptions)
  |
  v
  stamp_outcomes BEFORE clustering: human verdicts      workers/scout/outcomes.py
  on scout cards                                        (verdicts shape the SAME night's
  -> accepted: credit scout_source_scores               clustering, not next week's)
  -> declined: debit + entity -> scout_stoplist
  |
  v
  persist scout_items (90d retention, nightly prune)
  |
  v
  14-day unmapped window (5,000 cap, saturation-loud)
  -> cluster: >=3 items from >=2 sources, stoplist-aware  cluster.py
  -> scout proposal cards (community_ideas origin='scout', dedupe_key upsert,
     shown on the Scout tab - never the Ideas tab) + drumbeats
     ("2/3 items - needs one more source")
  -> scout_runs ledger row (feeds the Scout tab)
  |
  v
  gap-miner: recurring unmapped copilot topics           gapminer.py (counts only,
  (>=3 turns, >=2 users, 30d) -> content-gap cards        never quotes or identities)

CREATE (on founder acceptance)
  card status -> planned  =  the queue                   npm run scout:queue
  |
  v
  /draft-vertical chain: evidence -> author +            .claude/commands/draft-vertical.md
  adversarial-verify workflow (seeded with               (reads .claude/content-rules.jsonl)
  content-rules) -> integrate -> PR. Agents draft,
  HUMANS merge - always.
  |
  v
  merged vertical -> attach() has a new theme -> tomorrow's NOTICE maps more of the world

LEARN (every night, before clustering)
  accepted/declined verdicts -> source scores + stoplist -> the same night's NOTICE clusters better
```

What closes it: all three arrows point back into the nightly run. A declined idea is never
re-filed (stoplist), a wrong attach is never repeated (exceptions), a source that keeps
producing accepted ideas earns rank, and every merged vertical widens what the scout can see.

## 6. The macro + calendar loops

```text
each in-session scan:    market_context_snapshots (regime + payload)  workers/stock_scanner/main.py
                           -> dashboard macro strip (latest row)      (after the market-hours gate,
                           -> review + weekly baselines [loop 3]       so US-session hours only)
                              (earliest row at/after period start)

seasonal weekday crons:  RBA decision alert (rba-decision-alert.yml, AEST/AEDT month split)
                           -> statement fetched + parsed by regex; if no number parses, the
                              alert DEGRADES to "decision out, read it here" - never invents

nightly (in digest_job): market_calendar_events seeded + maintained   macro_calendar.py
                           -> calendar board; loop 3 sends the earnings/IPO T-1 notices
                              and the CGT radar built on these + portfolio dates

Vercel cron 13:00 UTC:   /api/ingestion/gov-awards - daily federal-award pull (6h-cached,
                           live/mixed/sample provenance) -> ingestion proof surfaces
```

What closes it: the yearly review (loop 3) reads the January snapshot a year later - the
longest-memory read in the system, and the reason `market_context_snapshots` keeps 372 days.

## 7. The horizon-2 worker loop - the world outside the tickers

```text
nightly 22:05, before the digest so tonight's digest sees today's world:
  events_worker        -> company_events, ipos, event_risks     (earnings/IPO radar T-1)
  fundamentals_worker  -> fundamental_snapshots, valuation_metrics
  intelligence_worker  -> news_items + hype_scores              (needs migration 049 applied)
each: || echo >> worker-failures  ->  "Report worker failures" step fails the run at the END
                                      (best-effort must never mean invisible)
```

What closes it: calendar + radar + detail surfaces read these tables next morning; failures
page via Telegram/Slack. `FINNHUB_API_KEY` unset = these run against empty providers (free key,
pure upside to set).

## 8. The AI copilot loop - grounded, budgeted, remembered

```text
user asks -> grounding assembled server-side       src/app/api/ai/chat/route.ts
(dashboard signals, market context, knowledge      src/lib/knowledge/ (deterministic
retrieval, injection-fenced live news)              lexical + doc-identity rerank)
  |
  v
BYOK key (user pays, any model) or hosted key      src/lib/ai/credentials.ts
(model pinned, budget-metered: 2k/run,             budget-tracker.ts (charge BEFORE call;
250k tokens/day shared ceiling)                    verdict blocks -> deterministic fallback)
  |
  v
answer (research only, never advice, never         guardProse + policy.ts
an invented number)
  |
  +--> ai_runs (durable audit trail, AI-SEC-05)    -> /ai-ops metrics + token cost
  +--> chat_turns (twin-consented users only)      -> newest-8 seed the NEXT session's
  |                                                   prompt (a returning user is not a
  |                                                   cold start)
  +--> unmapped recurring topics -> gap-miner [loop 5] -> content-gap cards
```

What closes it: memory (chat_turns) and demand signal (gap-miner) both feed forward; `/ai-quality`
chain audits groundedness; the scout brief on idea cards runs the same budgeted path with
server-side evidence grounding and a template fallback that stands when anything fails.

## 9. The paper-bot loop - practice trades, gated hands

```text
signals [loop 1] -> bot proposes intents -> APPROVAL GATE (signed capability per intent -
user approves in cockpit; date-less dedupe key holds for the intent's life) -> paper orders
-> positions -> equity snapshots -> cockpit performance view -> user adjusts strategy ->
next proposals
```

What closes it: the human approval IS the loop's hinge - the bot never trades unapproved, and
the flag feed is per-user. (Active development lane - see CHANGELOG for current state.)

## 10. The data-economics loop - the database watches its own weight

```text
nightly 22:05 (schema-drift job)                   scripts/check-data-economics.mjs
  |
  v
measure: DB MB vs 250/300 MB tripwires; every
monitored table vs its budget; sunk rows past
each AUDITED benefit horizon; 7d write rates
  |
  +--> green: report only (weight next to worth - every table names what it feeds)
  +--> red: nightly fails, Telegram/Slack page fires
  |
  v
founder ratifies a horizon (DATA-ECONOMICS.md      pruning jobs ship per-table ONLY after
section 6) -> pruning job ships -> table           ratification; a check never deletes
plateaus -> free tier holds (~130 MB bounded
plateau + ~60 MB/yr learning tables)
```

What closes it: the gate's sunk-row report is the standing evidence for the next retention
decision - act on measurement, not memory. Horizons came from a 12-agent adversarially-verified
read-path audit (2026-07-18).

## 11. The release loop - every change announces itself

```text
edit code -> prepend RELEASES entry                 src/lib/version.ts (single source of truth)
  -> npm run release (syncs package.json + CHANGELOG)
  -> git push
       |- pre-push: version-guard (bump required for src/supabase/workers/public;
       |  monotonicity - a concurrent session shipping ahead BLOCKS you, renumber above)
       |- CI: version-guard, type-check, lint, vitest, build, pytest,
       |      check:chains, check:ledgers, check:onboarding(+contract),
       |      check:migrations, migrations-from-zero
       |- Deploy Smoke: live site serves >= the pushed version, surfaces respond
  -> npm run announce (AFTER the push, never before) -> Slack/Telegram/WhatsApp
  -> /whats-new in-app changelog renders the same RELEASES array
```

What closes it: the version badge users see and the announce message you receive are generated
from the same array the gate enforced - the loop cannot claim a ship that did not happen. Two
sessions share this tree daily; the monotonicity gate has blocked its own author twice.

## 12. The agent-learning loops - the harness learns too

```text
something breaks in a new way
  -> incident + root cause + the gate it earned    harness-incidents.jsonl (repo root)
  -> next session greps the ledger BEFORE          (12+ seeded incidents: version races,
     debugging a familiar failure                   silent skips, tz tests, demo forks...)

a verifier kills a claim in a draft workflow
  -> rule appended                                 .claude/content-rules.jsonl
  -> /draft-vertical seeds BOTH author and
     verifier prompts with every rule -> the
     next vertical starts where the last ended

both ledgers: npm run check:ledgers in CI - a ledger that stops parsing stops teaching.

standing maintenance loops (skill chains - every code section has an owning chain,
enforced by check:chains):
  /production-keeper    keep the deployed thing alive
  /feedback-loop        user feedback -> triaged change
  /signal-quality       loop 2's human half
  /notification-health  loop 4's audit
  /data-integrity       schema/fixture/live coherence
  /scout-intel          loop 5's audit
  /onboarding-parity    human/html/agent surfaces stay in sync
  /security-sweep       the fences hold
  /ai-quality           loop 8's groundedness
  /onboarding-funnel    the path from landing to activated
  /ux-surface, /logs-to-genui, /setup, /draft-vertical
```

What closes it: the ledgers are versioned WITH the code (they survive database resets and
travel in every clone), and the chains are the documented owners a fresh agent inherits -
[`SKILL-CHAIN.md`](./SKILL-CHAIN.md) is the registry, [`HARNESS.md`](./HARNESS.md) the
enforcement map.

---

## Reading this file when something is wrong

- A ledger nobody reads back is the smell to hunt: this file exists so every write column has a
  named reader. If you add a table, add its loop here - and its budget/horizon to
  [`scripts/check-data-economics.mjs`](./scripts/check-data-economics.mjs).
- The known open half-loops, on purpose: engagement -> routing (loop 4, ledger first, tuning
  later), `news_items` -> a reader (loop 7, table currently write-only), ML recovery-model refit
  on real bars (loop 1, trains on synthetic reference data today), and the dormant Python
  trading modules (`workers/stock_scanner/paper_trading.py`, `backtest_engine.py`,
  `trade_snapshot_engine.py` - test-covered but no production caller; the live paper bot is the
  TypeScript implementation in loop 9).
- Cadence quick-check: in-session hourly = scan + macro snapshot; nightly 22:05 UTC Mon-Fri =
  everything else; daily 13:00 UTC = gov-awards (Vercel cron); seasonal = RBA; per-push =
  release loop; per-incident = agent learning.
