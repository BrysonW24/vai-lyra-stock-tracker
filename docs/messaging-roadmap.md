# Lyra messaging roadmap - scheduled intelligence, not notifications

> Written 2026-07-17 from a 6-agent research and ideation pass (2 live-web research agents,
> 4 ideation lenses reading this codebase). Every RBA URL below was fetched and verified 200
> on that date; every idea names the existing rail it rides. Facts marked "unverified" are
> honestly unverified - do not promote them without checking.

## North star

Lyra's messages should read like a desk note from your own economics department, not a
retail app ping. The bar is the RBA Chart Pack itself: dense, measured, source-attributed,
zero hype. The doctrine that gets us there already exists in this codebase and is
non-negotiable for every idea below:

- **The deterministic engine decides; AI may only phrase.** No message is AI-originated.
- **Every number is measured** - from stored candles, real cost bases, real timestamps.
  A renderer must never infer "this went well" from prose.
- **Honest degradation** - missing data means the line is omitted and the omission is
  counted, never guessed.
- **Research, not advice** on research output; "not tax advice" where tax is described.
- Quiet hours, dedupe keys, idempotency keys, and the self-healing last-weekday + grace
  scheduling pattern (see `workers/stock_scanner/review_job.py`) apply to everything.

## The rails that exist today (build on these, not beside them)

| Rail | Where | What it gives a new message type |
|---|---|---|
| Hourly scan | `.github/workflows/hourly-stock-scanner.yml` | An hourly deterministic tick + fresh candles |
| Nightly job (Mon-Fri 22:05 UTC = 8:05am AEST next morning) | `nightly-maintenance.yml` | The natural "with your morning coffee" delivery slot |
| Periodic review scheduler | `review_job.py` | Last-weekday + 5-day-grace targeting, period-stable dedupe, measured `PortfolioPerformance` |
| Dispatch API | `src/app/api/notifications/dispatch/route.ts` | Auth, validation, dedupe, router, channel fan-out |
| Type roster | `src/lib/notifications/types.ts` | Compiler-forced completeness for new NotificationTypes |
| Renderers | `telegram-templates.ts`, `slack-templates.ts`, `templates.ts` | Performance badges, voice presets, per-type framing |
| Inbound Telegram webhook | `src/app/api/webhooks/telegram/route.ts` | Closed command enum, rate-limited, injection-safe. Pairing is stub-mode - completing it unlocks all on-demand ideas |
| Calendar table | `market_calendar_events` (migration 040) | Landing zone for RBA/Fed/CPI dates - `event_type: 'macro' / 'economic_release'`, importance |
| Watchlist at-add freeze | migration 034 | Immutable `signal_score_at_add` etc. - counterfactuals need zero new capture |

---

## Flagship: the RBA integration

The user reads the Chart Pack monthly by hand today. Lyra should deliver it - and the
decision cycle around it - automatically. All facts below verified live 2026-07-17.

### Verified data map

| Surface | URL | Cadence | Verified notes |
|---|---|---|---|
| Coming Up (best scanner surface) | `rba.gov.au/coming-up/` | rolling | Every upcoming event with date, time AND timezone |
| Board meeting schedule | `rba.gov.au/schedules-events/board-meeting-schedules.html` | annual, year-ahead | 2026: Feb 3, Mar 17, May 5, Jun 16, **Aug 11, Sep 29, Nov 3, Dec 8** (decision = day 2, 2:30pm Sydney). 2027 already published |
| Media releases RSS | `rba.gov.au/rss/rss-cb-media-releases.xml` | event-driven | RDF/RSS 1.0 (NOT 2.0). Only ~2 items deep - poll every 1-5 min on decision days, reconcile against `/media-releases/YYYY/` HTML index |
| Chart Pack | `rba.gov.au/chart-pack/` | 8x/year, 11:30am the day AFTER each meeting | 17 category pages; shows "Released on" + "Data as at" dates |
| Chart Pack PDF | `rba.gov.au/chart-pack/pdf/chart-pack.pdf` | overwritten in place | ~5.4 MB. Stable URL - detect new releases via Last-Modified header. No dated archive exists; keep our own history |
| Individual charts | `/chart-pack/images/{category}/{slug}.svg` | overwritten in place | **SVG only** (PNG 404s). Semantic slugs, e.g. `interest-rates/australian-cash-rate.svg`. Chart set churns - enumerate from category pages each release |
| Cash rate data | `/statistics/tables/csv/f1.1-data.csv` (monthly avg), `f01d.xlsx` (daily) | daily/monthly | octet-stream + UTF-8 BOM + 5 metadata rows before data - dedicated parser needed |
| Minutes | `/monetary-policy/rba-board-minutes/YYYY/YYYY-MM-DD.html` (date = meeting day 2) | +2 weeks, 11:30am | URL is predictable but 404s until the publication moment - poll for the 404-to-200 flip |
| SMP | `rba.gov.au/publications/smp/` | quarterly (Feb/May/Aug/Nov), 2:30pm with the decision | Next: 11 Aug 2026 |
| Exchange rates RSS | `rba.gov.au/rss/rss-cb-exchange-rates.xml` | daily 4pm Sydney | A genuine DATA feed - machine-readable rate values in the `cb:` namespace |
| Table-change alerts | `rba.gov.au/rss/rss-cb-changes-to-tables.xml` | event-driven | The ops feed: schedule slippage and format changes announced here - subscribe defensively |

### Licensing (verified from rba.gov.au/copyright/)

- Most RBA material: **CC BY 4.0** - reproduce/adapt commercially with attribution
  `Source: RBA 2026`, no implied endorsement.
- Cash Rate + Chart Pack graphs: allowed for personal AND commercial use with attribution,
  PLUS: if users are charged, they must be told the data is free on rba.gov.au.
- **Third-party-sourced charts (ABS/Bloomberg/LSEG footers): do NOT re-serve** - link to
  them on rba.gov.au instead. Charts sourced "RBA" alone are safe to re-render.
- Never reproduce: RBA logo, banknote images, multimedia.

### Engineering gotchas (all verified)

1. **Datacenter-IP blocking is real**: rba.gov.au 403'd hosted fetch infrastructure while
   serving 200 to local curl (even default UA). Test from the GitHub Actions runner IPs
   before trusting the design; have the HTML-index fallback ready.
2. RDF/RSS 1.0 needs an RDF-aware parser (`feedparser` handles it).
3. Decision release URLs (`mr-YY-NN`) are sequential across ALL release types - never
   pre-compute; discover from the feed/index at 2:30pm.
4. Sydney time, not fixed UTC: Nov-Mar decisions are AEDT (UTC+11). Use
   `Australia/Sydney`, never a constant offset. (Same rule the router already follows.)
5. `robots.txt` allows `/chart-pack/`, `/statistics/`, `/media-releases/`, `/rss/` -
   a compliant scraper is fine on every surface above.
6. No JSON API exists anywhere - HTML, RDF, CSV, XLSX, PDF only. All server-rendered.

### Build shape (three deliverables, one worker)

**RBA-1: Decision alert (~2:40pm AEST, 8 days/year).** New calendar-gated GitHub Actions
cron (04:35 UTC; 03:35 in AEDT months) seeded from the published meeting schedule - exits
clean on non-meeting days. Fetches the cash rate from the F1.1/f01d table, compares to the
stored prior target, renders held/cut/raised + the AUD/USD move since morning and what
that does to the user's US holdings in AUD terms:

> **RBA holds at 3.85%**
> Decision at 2:30pm AEST: cash rate unchanged at 3.85%. AUD/USD moved 0.6520 to 0.6534
> in the first half hour, so your US portfolio is worth about 0.2% less in AUD terms than
> this morning. Full statement: rba.gov.au. Research, not advice.

**RBA-2: Chart Pack morning delivery (11:35am the day after each meeting).** Detect the
new release via PDF Last-Modified; deliver per channel capability: Telegram gets the full
PDF (`sendDocument`, 50 MB cap, renders a thumbnail) plus a curated `sendMediaGroup` album
of 5-8 RBA-sourced charts rasterized SVG-to-PNG (cash rate, inflation, AUD TWI, world
growth, share markets); Slack gets Block Kit with key numbers as text plus image blocks
pointing at OUR hosted PNG rasters (public HTTPS required - see channel matrix); push gets
"RBA Chart Pack for August is out" deep-linking to an in-app chart-pack page. Archive each
release (RBA keeps no dated archive).

**RBA-3: Rate Day Companion (mornings, rides the existing nightly).** Pre-brief on
decision mornings ("announcement 2:30pm today, going in at 3.85%, here is how cuts tend to
flow through the AUD to your US holdings") and a minutes-morning note two weeks later.
Seeded dates land in the existing `market_calendar_events` table.

---

## The Playing Field - policy intelligence as a standing research pillar

The founder's directive (2026-07-17): macro/policy reading is not a message type, it is a
CORE PERIODIC RESEARCH INPUT. The app should hold a live map of the terrain the portfolio
fights on: where central banks are steering, what legislation is in motion, where
governments are deploying subsidies and industrial policy, and which companies are
positioned to take advantage. Knowledge is the edge.

### Why Lyra can already do this

The v0.39.0 scout is the chassis: it nightly reads a curated registry of broad-signal
sources - **already including DoE, DoD, NASA, SpaceNews, SemiAnalysis, World Nuclear News,
IEEE Spectrum and mining/quantum trade press** - deterministically attaches items to the
vertical map, banks unmapped items in a 14-day drumbeat window, and only ever files
evidence-linked idea cards that humans gate. The US government-money seam exists today.
The policy pillar extends the same doctrine to new source classes; it does not need a new
architecture.

### Source classes to add to the scout registry

| Class | Sources (to verify before registering, scout-style) | What it reveals |
|---|---|---|
| Central bank posture | RBA (verified above), Fed (federalreserve.gov feeds), FOMC statements/SEP | The cost of money; risk appetite regime |
| AU fiscal + industrial policy | Treasury + Budget papers (May), Future Made in Australia, National Reconstruction Fund, ARENA/CEFC, critical minerals strategy | Where AU subsidy money flows |
| AU legislation + procurement | Federal Register of Legislation, Parliament bills feeds, AusTender, GrantConnect | Rules changing + contracts landing |
| US fiscal + industrial policy | CHIPS award announcements, IRA/DoE loan programs office, USAspending awards | Where US subsidy money flows - directly relevant to the held US tech book |
| US legislation | congress.gov bill feeds, Federal Register | Rules in motion for held/watched verticals |
| Company positioning | Existing scout feeds + earnings-call themes | Who is moving to catch the money |

Registry discipline stays scout-grade: every source verified live before registering,
every item evidence-linked, deterministic vertical attach, humans gate promotion. AI never
asserts a policy intent that is not in a linked document.

### The deliverable: the Playing Field Briefing

Monthly (rides the review_job last-weekday + grace pattern), with event-driven
supplements on major drops (budget night, CHIPS award, rate decision):

> **The Playing Field - July 2026**
> Cost of money: RBA 3.85% (held Jun 16, next call Aug 11). Fed 4.25-4.50% (next Jul 29).
> Money in motion: DoE Loan Programs closed a $1.2B storage facility this month
> (evidence: 2 linked awards). AU National Reconstruction Fund opened round 3 -
> quantum + medical manufacturing named.
> Rules in motion: [bill], second reading, touches [vertical] - 2 linked items.
> Your exposure: 4 of 6 holdings sit in verticals with active subsidy flow; 0 face
> adverse bills this month.
> Every claim links to its source. Research, not advice.

Each claim in the briefing carries its evidence refs (the notification event's
`evidenceRefs` field exists for exactly this). The in-app page shows the full map; the
message is the desk note.

### Sequencing

The Playing Field lands AFTER wave 1-2 below (RBA plumbing + image pipeline are its
delivery substrate) and reuses the scout's registry/verification machinery for the new
source classes. First milestone: register + verify the AU fiscal and US industrial-policy
feeds, let the drumbeat window accumulate for a month, then ship briefing #1.

---

## Channel capability matrix (verified July 2026)

The one-renderer-per-channel design already exists; this is what each can physically do
with images. **Render every chart server-side to one PNG (~1200x675, under 5 MB) and fan
out** - none of the channels execute HTML/JS.

| Channel | Images | The hard constraint |
|---|---|---|
| Telegram | **Best.** `sendPhoto` (10 MB upload / 5 MB by URL), `sendMediaGroup` albums of 2-10, `sendDocument` PDFs to 50 MB, HTML captions to 1,024 chars, inline buttons | Caption budget is 1,024 not 4,096 - headline + one insight + link |
| Slack (incoming webhook) | Image blocks by **public HTTPS URL only** - Slack fetches and re-proxies | **Webhooks cannot upload files.** A private/unreachable image URL rejects the ENTIRE message (HTTP 400 `invalid_blocks`) - always be ready to retry text-only |
| Web push | `image` renders on Android Chrome + Windows Chrome/Edge only; silently dropped on macOS Chrome, Firefox, iOS | Image is progressive enhancement, never the payload - title/body must stand alone; deep-link the click |
| WhatsApp | Proactive media ONLY via a pre-approved template with a media header | Approve ONE generic Utility template up front ("Your {{1}} update for {{2}} is ready"), swap the header image per send |

Hosting implication: chart delivery needs a public unguessable-URL image route (capability
URLs). For personal-portfolio charts, generate via `@vercel/og`/satori from payload numbers
only.

---

## The idea catalogue - 32 ideas, 4 lenses

Full detail (trigger, worked message, rails, data needed, effort, wow) lives in the
ideation transcript; this is the curated register. **Bold = wave 1-2 picks.**

### Reflection - see how you actually did

| Idea | Cadence | Effort | Why |
|---|---|---|---|
| **Watchlist Hindsight ("what you almost bought")** | per item +30d | M | At-add freeze (migration 034) makes this pure read: "You added NVDA 30 days ago at 118.40. Today: 131.20 (+10.8%). Your entry rules fired twice in the window." |
| **Personal Alert Calibration Report** | monthly | M | The scanner grades ITSELF: "9 of 14 strong setups (64%) were higher 5 days later. The scanner is not magic. This is its real hit rate, measured." Pure join of `stock_alerts` x `signal_outcomes` |
| **Benchmark Reality Check (you vs SPY vs cash)** | monthly | S | Add SPY to the universe (one row, zero code) - "You beat the index by +1.8 pts this month. Over 6 months you trail by -0.9. One month is noise." |
| You vs the Bot: Friday scoreboard | weekly | M | Human vs paper bot, including "the trade you skipped" |
| Trade Anniversary Journal (30 days in) | per position +30d | S | What happened since you bought |
| Strategy Audit: did the dips actually turn? | quarterly | S | Cohort-level honesty about the mean-reversion thesis |
| Drawdown Depth Marker + Recovery Bell | event-driven | L | Peak-to-trough awareness + the honest recovery math |
| Quiet Hands discipline streak | weekly, losing weeks only | M | Praise for NOT panic-selling; suppressed in good weeks |

### Macro - the world, in your terms

| Idea | Cadence | Effort | Why |
|---|---|---|---|
| **RBA Decision Alert + AUD-terms impact** | 8x/year 2:40pm | M | Flagship - see above |
| **RBA Rate Day Companion** | 16 mornings/year | M | Pre-brief + minutes note; pays the one-time macro plumbing tax |
| **AUD-Terms Portfolio Translator** | FX thresholds + weekly line | M | The AU-investor killer feature: "+1.2% in USD this week; about +3.1% in AUD terms (AUD fell 1.9%)" |
| FOMC Morning-After Brief | 8 mornings/year | S | Nightly run already lands 3-4h after the 2pm ET announcement |
| US CPI in the morning digest | 12x/year | S | Prepended block, seeded calendar |
| Earnings T-1 for held/watched | event-driven | S | `company_events` table now actually stores rows (v0.41-42) |
| Ex-Dividend heads-up | event-driven | M | Date-driven, held symbols only |
| Regime Shift Alert | event-driven | S | `market_context` snapshots already classify the regime |

### Hygiene - catch the slow rot

| Idea | Cadence | Effort | Why |
|---|---|---|---|
| **CGT 12-Month Anniversary Radar** | T-30 + T-7 per position | S | Uniquely Australian, pure date math on stored `purchase_date` + cost base. "General information, not tax advice." |
| EOFY June Pre-Check | annual (June) | M | The Australian season, on the review_job pattern |
| Concentration Creep Monitor | monthly + threshold | S | "NVDA is now 41% of your portfolio" |
| Stop-Loss Drift Report | weekly fold-in | M | Price ran up, stop never moved |
| Stated-Risk vs Actual-Sizing Audit | on new position | S | Onboarding answers finally police the book |
| Stale Watchlist Sweep | monthly | M | 90-day-old items: thesis dead? |
| Cash Drag Ping | monthly | S | Idle allocation vs stated plan |
| One-Trade Portfolio Detector (correlation) | quarterly | L | "Your 6 positions are one trade in disguise" |

### Delight - alive, not gamified

| Idea | Cadence | Effort | Why |
|---|---|---|---|
| **The 9pm Pulse (AEST-native pre-open brief)** | Mon-Fri 9pm AEST | S | "Tonight on Wall St (open 11:30pm your time): 3 setups live, CRWD sits 2.1% above your trigger." Suppressed when empty - no hollow pings |
| **Lyra Wrapped (shareable year card)** | yearly | M | satori-rendered image card from the yearly_review numbers; Telegram sendPhoto + share URL |
| /brief + /explain on-demand commands | inbound 24/7 | S | Webhook + closed enum EXIST; complete pairing, wire real handlers |
| Milestone Moments | once-ever events | M | First double-digit winner, 100th scan night, Lyra anniversary |
| Patience Streaks | threshold crossings only | M | Anti-gamification: rewards holding through the plan, never trade frequency |
| Saturday Spotlight (one-holding deep-dive) | weekly | S | Friday's run already lands Saturday 8:05am AEST |
| EOFY Wrap + January Clean Slate | seasonal pair | S | The Australian year, bookended |
| Celebrations in your voice | n/a (applies to all) | S | Delight events through existing voice presets |

### Never build (the muppet line)

- Anything rewarding trade frequency, streak-nagging daily, or celebrating volume.
- Any message where the "performance" is inferred from prose instead of measured.
- Push-to-trade CTAs. Lyra observes, measures, and briefs. The user decides.

---

## Recommended build order

| Wave | Contents | Rationale |
|---|---|---|
| 1 | RBA-1 decision alert + RBA-3 rate-day companion + seeded macro calendar | The user's explicit ask; pays the macro plumbing tax (calendar seeds, F1.1 parser, one new cron) that CPI/FOMC then reuse for S-effort |
| 2 | Chart Pack delivery (RBA-2) + the image pipeline (SVG raster + hosted PNG route + Telegram sendPhoto/sendDocument + Slack image blocks) | The monthly ritual, automated; the image pipeline is the enabling asset for Wrapped and every future chart |
| 3 | CGT Anniversary Radar + Benchmark Reality Check + AUD-Terms Translator | Three S/M ideas, each wow-5 for an Australian investor; two fold into existing reviews |
| 4 | Watchlist Hindsight + Calibration Report + 9pm Pulse | The self-honesty layer - the app grades itself in front of the user |
| 5 | Pairing completion + /brief + /explain; then Wrapped, milestones, seasonal | On-demand unlock, then the delight layer on top of proven rails |

Every wave ends with: new NotificationTypes added to the roster (compiler-enforced),
renderer entries in all four template maps, router gating decided, tests for the trigger
math, and a version bump.
