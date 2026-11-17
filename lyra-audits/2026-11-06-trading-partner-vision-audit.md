# Trading-partner vision audit - 2026-11-06

Audited at v0.138.2 (`ce95ee3`; `origin/main` is one operations-only commit ahead at `12583f0`).
Read-only: no code, setting or data was changed. This is not a re-score of the sixteen-vertical
rubric in `README.md`; it measures Lyra against a different question.

**The question.** The founder wants to share Lyra with friends as a trading partner in their
pocket: updates on their own holdings, free AI questions on open models over their own data,
warnings when a market or sector breaks (his example: technology falling about 25% in six
sessions), monitoring across the Asian, European and American sessions, and intraday processing
of policy events (the Fed, the US President, the Australian government). He asked how well that
is set up today and whether the architecture is the efficient one for it.

**Method.** Run history, live probes and the Supabase project list first, then four scoped
read-only reviews (alerting, event sources, AI layer, multi-user readiness), each returning
file:line evidence. **[confirmed]** means the lead auditor re-opened the source or checked it
live. **[reviewer]** means a reviewer cited file:line and it was not re-opened. The production
database is paused, so nothing here was checked against production rows, and Vercel environment
values were not visible.

## The short version

1. **Lyra is switched off.** The database has been paused since 26 October, seven scheduled
   jobs are disabled, production shows sample data and nobody can sign in. Nothing has been
   sent for eleven days.
2. **Most of the vision is not built.** The earlier audits scored Lyra 91.7 out of 100 for what
   it was designed to be: one operator's hourly scanner of US technology shares, with strong
   honesty checks. Measured against the trading-partner vision the picture is the table below.
3. **The architecture is efficient for the old goal and the wrong shape for the new one.** It
   was optimised to cost nothing. That choice is why it is offline, and an hourly job on
   GitHub's scheduler cannot do intraday, multi-region, event-driven work.

| What was asked for | Today | In one line |
|---|---|---|
| It is running | No | Database paused, schedules disabled, sample data on production |
| Each friend gets updates on their own holdings | Partly | Only for holdings inside the roughly 100 scanned US technology names. Anything else is stored but never priced, scanned or alerted |
| The partner voice (evening read, morning guide, setup alerts) | Founder only | Keyed to one operator id and one Telegram chat |
| Warnings when a market or sector breaks | Absent | No drawdown, speed, breadth, volatility-change or sector monitor. The "regime" label is stored and displayed, never sent |
| Asia, Europe and US monitoring | US only | US regular-hours hourly bars. ASX 200 and AUD/USD are snapshotted but never alerted. Nikkei, FTSE and STOXX on the board are fixed sample values |
| Intraday | No | Worst case about 1.5 to 2.5 hours from a move to a message, on a scheduler that drops firings |
| The Fed | Date only | A fixed "FOMC decided overnight" line the next morning. The statement is never read. Seeded dates end 9 December 2026 |
| US President, White House, Treasury, tariffs | Absent | No source |
| Australian government | RBA only | The RBA decision alert is the one real intraday event path. Treasury, ASX, ASIC and ABS: nothing |
| Free AI on open models | No | A 14-day trial on a paid closed model, then bring your own key. No free, open or local model path |
| AI over their own data | Partly | Holdings, watchlist and goals reach the prompt. Trades, alert history, news and the calendar do not, and chat cannot look anything up |
| A harness that searches the right places | Partly, wrong scope | One nightly web-research run on technology themes, with no list of authoritative sources, on a paid Anthropic key |

## 1. Lyra is switched off [confirmed]

- Supabase reports project `lyra-stock-tracker` as `INACTIVE` (management API, 6 November). Its
  hostnames no longer resolve.
- The last successful scan was 26 October 01:38 UTC. Fifty-four consecutive scanner failures
  followed (`lyra-operations/2026-10-27-actions-outage.md` on `origin/main`).
- The decision recorded in issue #3 on 27 October: keep Podium and Vivacity on the two free
  database slots and pause Lyra's seven database-dependent workflows. All seven are
  `disabled_manually`: hourly scanner, nightly maintenance, daily read, AI briefing, morning
  guide, content review, RBA decision alert.
- Production `/api/health` returns `mode: live` with `lastScanAt: null`. The radar page renders
  `generatedFrom: demo`. Sign-up and sign-in use the same paused project, so a friend given the
  link today cannot create an account (inferred from the dependency; no form was submitted).
- **Restore window.** Supabase allows a paused free project to be restored for 90 days. After
  that only a downloadable backup remains, to be loaded into a new project. Counting from
  26 October that is about 24 January 2027. The dashboard shows the exact countdown.

## 2. Market monitoring and warnings

**F1. No market or sector event detector exists, and there is no notification type for one.**
[confirmed]
- `workers/stock_scanner/market_context.py` snapshots the S&P 500, Nasdaq, Dow, VIX, US 10-year
  yield, gold, oil, AUD/USD, ASX 200, bitcoin and a fear and greed index on each scan. Every
  figure is a one-session change.
- The regime rule (lines 219-224) is: risk-off if VIX is above 25, or fear and greed is below
  30, or two of the three US indices fell that session. The fear and greed input is
  alternative.me's index, which measures crypto sentiment (line 30).
- The word "regime" does not appear in `alert_engine.py`, `signal_engine.py` or
  `portfolio_engine.py`. The label is stored, shown in the interface, passed to the AI chat and
  printed in the operator's read. It never creates a notification.
- A better regime measure (SPY against its trend, drawdown from the 252-day high) exists in
  `workers/emerging_winner/regime_source.py` and feeds only that model's score. [reviewer]
- Nothing computes multi-day drawdown, drawdown speed, sector aggregates, breadth, correlation
  or valuation stretch. [reviewer]

**F2. What a friend would have received in the drawdown described.** [confirmed for the code
paths]
- `portfolio_price_move_down_5/10/15` is measured from the holder's own cost basis
  (`alert_engine.py:61-78`), so a holder still in profit hears nothing. The dedupe key carries
  no date, and the router dedupes on that key with no time limit (`dispatch.ts:716-727`
  [reviewer]), so each threshold fires once per holding, ever.
- `portfolio_risk` fires only if the oversold score of a held, scanned name falls.
- The nightly digest of whatever fired, and the evening AI briefing if its web search happened
  to cover the fall.
- Nothing says "technology is down this much over this many sessions, and this share of your
  book is exposed".
- The engine is a dip-recovery scorer with no regime gate. As a fall slows it surfaces "strong
  setup" candidates, and those alerts go only to the operator (`main.py:117`).

**F3. Coverage is US regular hours only.**
- Scanned and alerted: about 100 US-listed technology names on NASDAQ and NYSE (65 in
  `universe.py`, the rest seeded in the database). [confirmed for the code list]
- One-hour bars, scored once complete, fetched without pre-market or after-hours data
  (`market_data.py:100-110`). [reviewer]
- The scheduler fires at :17 and :47 around the clock (repository variable
  `ENABLE_MARKET_HOURS_GUARD=false`) [confirmed], but no Asian or European instrument is
  scanned, so there is nothing to see outside the US session.
- Worst case from a move to a message is about 1.5 to 2.5 hours: bar completion, the next
  firing, then GitHub's delay. The workflow file records GitHub dropping firings for hours.
- Board values for Nikkei, FTSE and STOXX are fixed sample constants (`market-board.ts`). Hang
  Seng, KOSPI and DAX are absent. [reviewer]

**F4. Watchlist alerts have never been on in production.** [confirmed]
`ENABLE_WATCHLIST_ALERTS` defaults to false (`config.py:93`) and no repository variable sets it.

**F5. Holdings outside the scanned list are invisible to the engine.** [confirmed] A ticker a
user adds is inserted with `scan_enabled: false` (`src/lib/supabase/ticker.ts:53`,
`src/app/api/trades/route.ts:51`), and the scanner loads only scan-enabled tickers. Reported
consequences [reviewer]: an ASX holding is accepted but stored inconsistently (`CBA` on the
position, `CBA.AX` on the ticker row), and a holding with no overlay is priced at its average
buy price, so profit and loss shows 0%.

## 3. Events and the global source harness

**F6. One event is processed intraday: the RBA decision.** [reviewer] A cron at 2:31pm Sydney
on seeded days reads the official statement, extracts the decision and rate, adds the AUD/USD
move and dispatches within minutes (`rba_decision_job.py`). The message carries one general
line about US-dollar holdings; it does not reason about the reader's positions.

**F7. The Fed is a date, not content.** [confirmed] The day after a seeded FOMC date the
morning digest carries fixed text ending "the statement is at federalreserve.gov"
(`macro_calendar.py:209-222`). Nothing fetches the statement. The seeded dates end at
2026-12-09 (line 47), after which the line stops with no warning. Minutes, speeches and
unscheduled actions are absent.

**F8. No source exists for the rest of the named events.**
- US President, White House, executive orders, tariffs, US Treasury: nothing. [reviewer]
- Australian Treasury, the budget, ASX and ASIC announcements: nothing. ABS data on the
  Australian macro card are fixed values from June 2026 (`src/lib/macro-context.ts:58-62`).
  [reviewer]
- ECB, Bank of England, Bank of Japan, People's Bank of China: nothing. [reviewer]
- US CPI, jobs and GDP dates are deliberately excluded because the BLS schedule page blocked
  verification (`macro_calendar.py:14-15`). [confirmed]

**F9. News ingestion is not live.** [confirmed]
- The Actions secrets hold no `FINNHUB_API_KEY`. By the workers' own gate, the news worker and
  the earnings and IPO worker persist nothing without it (`intelligence_worker/main.py:85-96`
  [reviewer]). The earnings notices that depend on those rows are therefore probably inert;
  this could not be checked against production.
- Separately, migration 014 creates `news_items.title text not null`, the worker writes
  `headline` and never `title` (`intelligence_worker/main.py:193-203`), and migration 049 adds
  `headline` without relaxing the constraint on `title`. On a database built from the
  migrations every news insert would be rejected. Production's actual table shape is unknown.

**F10. The scout registry is the nearest thing to a "right places" harness, and it points
elsewhere.** [reviewer] It holds 36 open RSS feeds plus Finnhub general news, 21 crawl targets
(these need a Firecrawl key, which is not set [confirmed]) and 47 X accounts with no adapter.
The subject matter is defence, energy and technology procurement. It runs nightly whatever
cadence a source declares, and its output goes to the ideas board, never to alerts.

**F11. The AI briefing is the only web-research path.** [confirmed]
- Claude Opus with web search and web fetch, once an evening (`ai_briefing.py:402-409`).
- No allowed or blocked domain list. The only location hint is Sydney. The prompt covers ten
  technology themes and four desks (IPOs, venture, government contracts, small caps), written
  for "Australian private investors who follow AI and technology shares" (lines 110-146). It
  has no instruction to cover central banks, macro data, tariffs or market stress.
- Its verification guard is strong: every cited address must have come back from a tool, at
  least one page must have been opened, and every figure must appear in a cited page.
- It needs a paid Anthropic key (US$40 a month ceiling). That credit ran out on 7 October; the
  current balance is unknown. There is no free or open-model research route.

**F12. Chat cannot answer "what just happened and what does it mean for me".** [reviewer;
curation date confirmed] The chat's grounding holds the hourly macro snapshot and a
hand-written catalyst list last curated on 13 June 2026 (`src/lib/catalysts.ts:121`), now
expired. It holds no news rows, no calendar events, no RBA alert and no briefing.

## 4. AI

**F13. There is no free path.** [confirmed] A new account gets a 14-day trial on the hosted
key (`src/lib/ai/entitlement.ts:21`). The hosted default is `gpt-5.5` (`gateway.ts:76`), a
closed model paid for by the founder. After day 14 chat returns "add your own model key". The
Solo deployment is always bring-your-own-key. `AI_INCLUDED_EMAILS` is the only permanent grant.

**F14. "Free / open" in settings is a label.** [confirmed, with reviewer detail]
- `NEXT_PUBLIC_LYRA_FREE_AI` is read in one place, `ChatWidget.tsx:281`, to show the chat as
  connected. The server never reads it.
- The OpenRouter default is `meta-llama/llama-3.1-70b-instruct`, with no `:free` suffix, and it
  needs the user's own key.
- Provider endpoints are hardcoded (`gateway.ts:272-288`). There is no Ollama, local or custom
  base-address option.

**F15. The shared-key fence is neither per user nor global.** [confirmed]
`src/lib/ai/budget-tracker.ts` keeps the day's spend in an in-process map, one per serverless
instance, with a default of 250,000 estimated tokens a day per key. The only per-user limit is
30 requests a minute, so one person can use the whole day's allowance in minutes. The credit
system designed in June (about 50 credits per person) does not exist.

**F16. Chat has no tools.** [reviewer] No function calling and no web, news or quote lookup.
Actions are text proposals a user confirms with a button, off by default. `/api/ai/agent` has
no caller in the interface. Knowledge retrieval covers Lyra's own documentation only.

**F17. "Their own data" is partial.** [reviewer] Holdings, watchlist, goals and opt-in chat
memory reach the prompt, scoped per user. Trades, alert history and the trading twin do not.

**F18. Guardrails hold on every provider path.** [reviewer] One system prompt, injection
screening, a number-grounding output check and an advice block run server-side whichever model
answers. This is a strength to keep.

**F19. Telegram and WhatsApp accept a closed command set.** [reviewer] A person cannot ask
Lyra a question from a chat app.

## 5. Sharing with friends

**F20. Data isolation is sound.** [reviewer] Row-level security is owner-only on positions,
watchlists, overlays, alerts and channels (`supabase/migrations/015_rls_policies.sql`), with a
negative test in CI over three tables (`scripts/rls-tenant-fence.sql`).

**F21. Who receives what.** [reviewer; first row confirmed]

| Message | Audience |
|---|---|
| Strong-setup, score-jump and invalidated-signal alerts; five-day follow-ups | Founder only |
| Daily read (8pm), morning guide (8:30am), content review | Founder only |
| Portfolio risk and cost-basis price moves | Each user, scanned symbols only |
| Daily digest, Friday report, periodic reviews, tax and earnings notices, RBA alert | Users with at least one holding or watchlist row |
| AI briefing | Every account receives the same text; no-account subscribers receive it reordered around their holdings |

**F22. It is easy to finish onboarding with no working channel.** [reviewer]
- The onboarding alerts step sets up web push only. Telegram, Slack and WhatsApp are deferred
  to Settings.
- Accounts have no email channel; email exists only for `/subscribe`.
- The iOS app cannot receive push (the plugin is installed and not wired), while its
  onboarding copy says alerts can reach the phone.
- A user with no verified channel has every event dropped, and the setup checklist counts
  unverified channel rows as done.
- A failed save of alert preferences is logged and still reported as success
  (`src/app/api/onboarding/route.ts:126,148`).

**F23. Controls for a shared deployment are missing.** [reviewer] No invite or allow-list, no
admin role, no way to disable an account. Account export omits holdings, watchlist, trades and
channels. Quiet hours always run on Sydney time, because the app writes `profiles.timezone`
while the router reads `user_alert_preferences.timezone`.

**F24. Three latent cross-user leak paths.** [confirmed] None is known to have fired, and all
three should close before a second person's holdings are in the system.
- `load_active_user_ids` returns an empty list on any exception
  (`supabase_repo.py:247-249`). The scanner then takes its single-operator branch
  (`main.py:294-303`): it loads every active position with no user filter
  (`supabase_repo.py:251-261`) and stamps them with the operator's id, so every user's alerts
  would route to the founder.
- When dispatch fails and a user has no Telegram channel, the alert falls back to
  `send_telegram_message(chat_id=None)`, which targets the operator's chat (`main.py:329,
  388-401`, `telegram.py:87`). The `TELEGRAM_CHAT_ID` secret is not set in Actions today, so
  this path is inert as configured.
- Worker logs print a user id with a symbol (`main.py:339`), and Actions logs on this
  repository are public.

**F25. iOS distribution is a TestFlight remote shell.** [reviewer] A friend needs an invite.
Solo and account modes are explained only in `SHARE.md` and on the Solo build's welcome page.

## 6. Architecture: is it the efficient shape?

**For the original goal, yes.** One deterministic engine computed once and overlaid per user,
AI that explains and never decides, a notification router with dedupe, quiet hours, a rate cap
and verified channels, budgets enforced from ledgers, a briefing that checks every claim
against its source, and failure paging that works. These are the right foundations and none of
them needs replacing.

**For the trading-partner vision, no.** Six structural points:

- **A1. Availability is hostage to free tiers.** Three incidents in six weeks: the database
  restricted for exceeding its transfer quota (26 to 30 September, 188 failed scans), the
  Anthropic credit exhausted (7 October), and the database paused under the two-free-project
  limit (26 October to now). The database was 311 MB of a 500 MB cap on 13 October. Vercel's
  Hobby tier is non-commercial and capped at 100 deploys a day across all the founder's
  projects. yfinance is personal-use access with no service level.
- **A2. The heartbeat cannot do intraday.** GitHub's scheduler is best-effort and visibly drops
  firings. Each firing starts a fresh machine and installs Python to do a few minutes of work
  inside a 15-minute limit, with a serial per-user dispatch call (8-second timeout) in the same
  job [reviewer]. That suits an hourly scan and a nightly batch. It does not suit watching
  three trading sessions or reacting to a statement within minutes.
- **A3. One operator is built in.** `DEFAULT_USER_ID`, the `SUMMARY_TELEGRAM_*` chat and "the
  operator's book" sit under the best content Lyra produces.
- **A4. Breadth over depth.** 58 pages, 53 API routes, about 98,000 lines of TypeScript, 25,000
  of Python, 12 workflows and 59 migrations, for four accounts as of October. Several surfaces
  show static or sample content (commodities, the exchange board, the Australian macro card,
  the catalyst list). The loop the vision needs - detect an event, size it against my book,
  tell me - is a small amount of code that does not exist.
- **A5. Schema changes are applied by hand** in the SQL editor. Ten migrations were found
  unapplied in July and three more in October.
- **A6. The documents have drifted.** `ARCHITECTURE.md` describes 28 migrations and no CI.
  `DATA-ECONOMICS.md:53` says an idle pause is impossible. `SHARE.md:42` says the full universe
  is swept every hour.

**The smallest change of shape that fits the vision:**

1. A database that cannot pause.
2. One small always-on watcher, separate from the hourly scan: it polls a few dozen
   instruments (index futures, regional indices, sector funds, VIX, currencies) through each
   session and a list of official feeds, writes events and calls the existing dispatch route.
   GitHub Actions keeps the hourly scan and the nightly batch.
3. Two new event types on the existing router, `market_risk` and `policy_event`, each carrying
   the reader's exposure computed from their holdings.
4. Scan what people hold, not only the seeded list.
5. A free AI tier with a per-user daily quota held in Redis, an open-model default and a
   configurable endpoint.
6. Per-user versions of the read and the morning guide.

**Cost of that shape.** The database is about US$25 a month if Lyra sits alone in a paid
Supabase organisation, or about US$45 a month if the existing three-project organisation is
upgraded (Supabase billing documentation, read 6 November). The watcher costs nothing extra if
the existing Sydney server still has the headroom recorded in July (not re-checked), otherwise
a small server. A licensed market-data feed becomes the next line item once more than a few
people rely on the alerts.

## 7. Recommended order

0. **Bring the database back** (founder decision, see section 8), re-enable the seven
   workflows, validate one real scan.
1. **Close the three leak paths in F24.** Small, and it must precede a second user.
2. **Build the market-risk monitor**: rolling drawdown and speed for indices and sector funds,
   VIX level and change, breadth across the scanned names, regional indices and index futures
   for Asia and Europe, with each reader's exposure attached. Add re-armable per-holding
   drawdown alerts measured from a recent high, and scan every held symbol. This is the piece
   the founder described, and it rides rails that already exist.
3. **Give friends the partner voice**: the evening read and morning guide per user, and a
   Telegram connect step inside onboarding.
4. **Free AI**: a hosted open-model tier with per-user quotas, then news, calendar and trades
   in the chat's grounding, then a small tool loop.
5. **Policy events**: a source registry by region (Fed, White House, US Treasury, BLS, RBA,
   Australian Treasury, ABS, ASX, ECB, BoE, BoJ), a poller on the watcher, and a grounded step
   that relates each event to the reader's book. Give the briefing a macro desk and a list of
   authoritative domains.

## 8. Decisions for the founder

1. **Which route brings the database back, and when.** A paid organisation for Lyra, an
   upgrade of the existing organisation, or freeing one of the two free slots. The restore
   window closes around 24 January 2027.
2. **Whether a small always-on watcher is acceptable**, and on which server.
3. **Which provider funds the free AI tier**, and the daily allowance per person.
4. **The Anthropic balance**, which decides whether the read and the briefing write prose when
   the schedules return.
5. **How far the wording may go.** Lyra's rule that the AI describes and never advises is the
   right line to hold as this is shared: in Australia, personal financial product advice
   generally requires a licence. Warnings should state what happened and the reader's exposure,
   not what to do. Worth a lawyer's check before sharing beyond close friends. This is not
   legal advice.

## Not verified

- Anything in production rows: account and channel counts, table shapes (F9), whether
  migrations 056 to 060 are all applied.
- Vercel environment values: whether `OPENAI_API_KEY`, `GOOGLE_AI_KEY`, `AI_INCLUDED_EMAILS`
  or the Upstash pair are set.
- Whether production email uses custom SMTP or Supabase's rate-limited default mailer.
- Whether a paused Supabase project can be transferred between organisations before it is
  restored.
- The current headroom on the Sydney server.
- The market move itself. The 25% figure is the founder's; no market data was pulled for this
  audit.
