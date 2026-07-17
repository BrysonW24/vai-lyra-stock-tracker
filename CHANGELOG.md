# Changelog

All notable changes to Lyra are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.37.0] - 2026-07-17

Telegram alerts are readable now: colour-coded relevance, real formatting, no more wall of text.

### Changed

- Telegram alerts have been rebuilt. Slack had a purpose-built layout while Telegram fell back to a plain-text format meant for the wire - one dense paragraph, no formatting, capped at 399 characters on a channel that allows 4096. Alerts now arrive with a proper header, bold title, scannable body and a tappable link.
- Your relevance score is now a colour-coded meter you read at a glance - green for a strong 70+, amber in the middle, red below 40 - instead of a number buried in a sentence.
- The engine's reason for firing now sits in its own quoted block, so the provenance reads as a citation and never gets lost in the narrative.
- Your chosen alert personality (Analyst, Coach, Minimal or Narrator) now applies to Telegram too. Previously only Slack honoured it.
- An alert can no longer be lost to a formatting bug: if the rich layout ever fails to parse, the message is re-sent as plain text rather than silently dropped.

## [0.36.0] - 2026-07-17

The Ideas board can actually save your ideas now - four migrations had never reached production.

### Changed

- Your ideas and upvotes now save. The Ideas board shipped without its two database tables ever being created in production, so every suggestion and vote was writing into nothing. The tables are in place now - along with three other database changes that had silently never been applied: your goal target can persist, activation tracking records again, and the digital twin has its consent switch.
- Fixed the ordering bug that caused it. A migration that adds columns to the calendar table was numbered to run AFTER the one that indexes those same columns, so setting up a database from scratch failed outright with "column ticker does not exist". The reconcile now runs first, and a fresh clone can build the whole schema in one pass.
- The nightly jobs are now writing to a database that matches them: the calendar, fundamentals and event-risk tables all have the columns their jobs have been trying to fill.

## [0.35.0] - 2026-07-17

The chain explorer: every vertical traced end to end, and the chains are finally deep.

### Changed

- The end-to-end value chain is now an interactive explorer on Small Caps: chip tabs switch between all ten verticals - AGI Infrastructure, Quantum, Robotics, Space, Power Grid, Nuclear, Semiconductors, Critical Minerals, Defence and Cybersecurity - and selecting a shortlist name snaps the explorer to its vertical with the name highlighted where it sits in the chain.
- The chains got deep. Nine verticals had only 2-4 supply-chain tiers mapped while AGI had 16 - every vertical now carries 8-12 nodes spanning end demand down to raw materials, with 120 companies and 95 capital events across the map (was 45 companies and 48 events). Every new row passed an adversarial fact-check before landing, and the ones that did not were struck.
- Backing integrity held: every small cap on the map now connects to at least one DISCLOSED backing source - 16 real capital events landed (DOE loans, US Navy contracts, NASA agreements, an Nvidia partnership), 5 names were honestly resized out of small-cap (Argan and MYR Group outgrew it), and 6 names with no defensible backing were removed rather than propped up.
- The chain is no longer hidden below the fold: a "Trace the full chain" action on every selected name jumps straight to the explorer, the shortlist cards are one-line compact instead of four stacked rows, and a verticals strip in the page header shows all ten focus areas with their tracked small-cap counts.
- AGI Infrastructure now wears a robot instead of a brain (a brain read as biotech), and Robotics & Automation takes the mechanical arm - every vertical has a distinct mark.

## [0.34.0] - 2026-07-17

The nightly jobs were failing silently every night - your digest, calendar and fundamentals are fixed.

### Changed

- Your daily digest is fixed. It had been crashing every single night before a single message went out: a market-wide digest was being filed against a made-up ticker called "MARKET", and the database rejected it outright. A digest is not about one stock, so it is now filed with no ticker - which is the honest answer and what the schema always allowed.
- The market calendar reads live events again. The events table had been defined twice with two different shapes, and the version the app actually reads never took effect - so every calendar lookup asked for a date column that was not there. The two definitions are now reconciled into one.
- Company fundamentals are being saved again. Every nightly snapshot, for every ticker, was silently rejected because the table was missing thirteen of the columns the job writes - including cash, debt and the P/E ratios. Nothing had been stored.
- Event risk actually works now. The nightly job was reading a table that has never existed, so every ticker came back "inactive" and no event risk was ever raised. It also kept the OLDEST reading per stock instead of the newest.
- Added a build gate that blocks this whole class of bug: it fails the build if two migrations share a version number or define the same table with different shapes - the exact traps that let all of the above fail quietly for so long.

## [0.33.0] - 2026-07-17

Product updates and Ideas get the premium glass treatment.

### Changed

- The Product Updates page has been rebuilt around a single glass header with a sliding Product Updates / Ideas switch, replacing the stack of boxed panels that repeated the same sentence three times over.
- Releases now read as a proper timeline: one continuous rail threading every version, with the build you are on marked by a lit amber node.
- The Ideas board is cleaner and easier to scan - a functional toolbar showing how many ideas there are and how they are sorted, roomier upvote controls, and a friendlier empty state.
- Glass surfaces now degrade gracefully: if your browser cannot blur, or you have asked your device to reduce transparency, every panel falls back to a solid, readable fill.

## [0.32.0] - 2026-07-17

Settings split into three focused pages instead of one long scroll.

### Changed

- Account settings are now three separate pages with a tab switcher at the top: Account (your profile, a device PIN lock, and your data), AI Settings (the model that powers Lyra), and Notifications (push, Telegram, WhatsApp, Slack). No more scrolling one long page to find the setting you want.
- Every link that used to jump to a section of the old page - the account menu, the AI prompts in chat, the setup checklist and product tour - now opens the right page directly.

## [0.31.0] - 2026-07-17

Lyra listens to your onboarding: the copilot now tailors itself to how YOU answered.

### Changed

- The AI copilot now reads your full onboarding profile. If you told us you are new and want step-by-step explanations, a few-months horizon, or just the signal with no lecture, Lyra tailors its depth, tone and framing to exactly that - instead of treating every beginner the same.
- Lyra sizes ideas against your own money goal now - suggestions relate to the target you actually set, not a generic milestone.
- Hardened the profile read so a not-yet-applied database change can never blank out your whole personalisation. At worst one optional field falls back to a sensible default; the rest of your profile always reaches the AI.
- Added a deterministic build gate that proves every onboarding answer is saved, read back, and reaches the AI - so this personalisation can never silently drift if the code changes later.

## [0.30.0] - 2026-07-17

The floating button gently nudges Feedback into view now and then.

### Changed

- The floating Ask Lyra / Feedback control now brings Feedback forward for a couple of seconds every so often, then slides back - a quiet reminder that the same button is where you tell us what to fix or build, so you never have to go looking for it.
- It never interrupts: the nudge is skipped while a panel is open, and it stays completely still if your device is set to reduce motion.

## [0.29.0] - 2026-07-17

Product Updates gets an Ideas board: suggest features and upvote what we build next.

### Changed

- The Product Updates page now has a two-tone switch - Product Updates (the release history) and a new Ideas board where you can suggest a feature and upvote the ones you want most, so what gets built next is driven by what you vote for.
- Each idea shows its date, title and description with a one-tap upvote and a live vote count, ranked most-wanted first. One vote per person per idea - tap again to take your vote back.
- The in-app feedback box now links straight to the Ideas board when you pick "Idea", so a suggestion can become something others rally behind.
- Fixed a confusing double changelog: the product-updates timeline is now generated from one source of truth (the version log) and is searchable, instead of a version list sitting next to a separate feed that had drifted out of date.

## [0.28.0] - 2026-07-17

Clearer notifications: an honest per-device push badge, real Telegram and WhatsApp logos, and sharper alert copy.

### Changed

- The push badge now reflects THIS device, not just your account. Before, it showed a green "on" whenever any device you own was subscribed - so an iPhone that had never granted permission still looked done. It is now green only when this device has actually enabled push, and shows an amber "Not on this device" otherwise, so the one tap that matters is obvious.
- Telegram and WhatsApp now show their real brand logos beside their fields and save buttons, matching Slack - no more generic placeholder icons. Nothing ships unbranded.
- Sharper alert copy: the test push and the service-worker fallback no longer repeat "Lyra" in the headline (your phone already shows the app name), so the title reads as one clean line instead of wrapping onto two. The test message now confirms push is live and previews how a real alert will land.

## [0.27.0] - 2026-07-17

Make it yours: a customisable bottom bar, a colourful Explore, cleaner type - and an honest goal bar.

### Changed

- Your bottom bar is now yours to arrange. Open Explore, tap Customise, and drag your daily surfaces into any order, remove the ones you never touch, and add any surface from the app - placed wherever you want. Your layout is saved on your device.
- The Explore drawer now reads in Lyra colour, grouped by the job it does: amber for Your desk, cyan for Discover, purple for Research, green for Practice, pink for Learn - so the eye finds things by colour instead of scanning a grey wall.
- Cleaner bar by default: Portfolio and Watchlist are spelled out in full, and Paper Bot now rides the bar (Trade Plan moves one tap into Explore). The bar also sits a little higher so it clears the phone home indicator.
- Fixed a confusing goal reading: the progress bar now runs straight from zero to your target, so "X of Y", the percentage, and the amount to go all agree - no more 6% sitting next to "$26.6k of $50k".
- A more premium, consistent typeface across the app (the native Apple system font) with crisper rendering - and the Settings form no longer bounces between monospace and sans: placeholders and fields now read in one clean face.

## [0.26.0] - 2026-07-17

Error monitoring verified live in production - and the setup scaffolding is removed.

### Changed

- Confirmed Sentry is armed in production: the DSN is inlined in the deployed client bundle, so a real crash - a browser error, a server exception, or a 500 in an API route - is now captured with a stack trace instead of vanishing. It stays optional and privacy-safe: with no DSN set (demo mode, self-hosting, forks of this repo) it sends nothing at all.
- Removed the two temporary example routes the Sentry setup wizard created - a public page and API that deliberately throw an error. They existed only to prove reporting worked; with that confirmed, the app no longer exposes any deliberate crash endpoint.
- No behaviour change for users: the monitoring runs silently in the background and only ever reports genuine errors, never usage or content.

## [0.25.0] - 2026-07-17

Error monitoring: Sentry now catches crashes and server errors in production - optional and off by default.

### Changed

- Wired Sentry across all three Next.js runtimes (browser, server, edge) so a real crash - a frontend error, an unhandled server exception, a 500 in an API route - is captured with a stack trace instead of vanishing. Until now the only production signal was /api/health plus the scanner paging on failure.
- Optional and privacy-safe by design: it reports only when a Sentry DSN is set in the host environment, so demo mode, self-hosting, and forks of this repo send nothing at all. No session replay, no user data - just errors and a 10% trace sample in production.
- The root error boundary now reports the crashes that reach it, and source maps upload on production builds so a real-user stack trace points at real code instead of minified noise.

## [0.24.0] - 2026-07-17

Your Activity: a private, on-device dashboard of how you use Lyra - time, sessions, AI questions, and a surface heatmap.

### Changed

- A new Your Activity page (in Explore under Learn & set up) shows how you actually use Lyra: total time on the app, number of sessions, active days, average session length, and how many AI questions you have asked.
- A surface heatmap shows which parts of Lyra you live in - every surface you visit, tinted brighter the more you use it, with a ranked most-used breakdown (visits, share, and time on each). Click any tile to jump straight there.
- Private by design: it is computed entirely from your own browser storage and never leaves your device - no account needed, no server, nothing tracked about you anywhere. A one-click "Clear my activity" wipes it whenever you want.
- It also quietly powers the owner-side Vercel analytics that was already wired, so the same navigation now feeds both your personal page and the aggregate dashboard - without double-counting or sending any content.

## [0.23.0] - 2026-07-17

Global rate limits: the abuse guard now counts across every serverless instance, not per-instance.

### Changed

- The three unauthenticated endpoints (per-symbol signal refresh, ticker lookup, and in-app feedback) now enforce their rate limits across every serverless instance at once, using the shared Upstash counter instead of a separate in-memory bucket per instance. Before, a burst spread across instances could get several times the intended allowance; it is now one exact global budget per IP.
- Fail-safe by design: with Upstash unconfigured (demo mode, self-host) or briefly unreachable, the limiter degrades to the in-process guard rather than failing open - it always does something, and the app still runs with zero keys.
- Proven, not assumed: a new test clears the in-memory buckets between calls to simulate a request landing on a fresh, cold instance and shows the shared counter still blocks an over-budget request - the exact gap this closes.

## [0.22.0] - 2026-07-17

One clean rail and an Explore drawer: the daily-drivers up front, the deep research one tap away.

### Changed

- The navigation no longer shows all 34 surfaces at once. The rail (and the mobile bar) now carry just the daily-drivers - Command, Portfolio, Watchlist, Plan - so the goal cockpit owns the screen instead of competing with a wall of icons.
- Everything else lives in a new Explore drawer, grouped by the job it does: Your Desk, Discover, Research, Practice, and Learn. One tap opens it, one tap gets you anywhere, and it closes on Escape, a tap outside, or when you navigate.
- Nothing was removed - all 34 surfaces are still there, just organised by what you are trying to DO rather than listed flat. The Explore control highlights when you are inside one of its surfaces, so you always know where you are.
- On mobile this replaces a 34-item horizontal scroll with five evenly-spaced tabs, so the thing you need is no longer three swipes away.

## [0.21.0] - 2026-07-17

True orientation: both sides of every name you hold and watch, and a goal target that is your own number.

### Changed

- The cockpit now shows a two-sided orientation across the names you hold AND the names you watch: what is good (opportunities) and what is bad (risks), side by side, from the live news flow. Not just downside and not just holdings - a balanced read of both sides at once, weighted toward the names where your money is on the line.
- Bad news on a name you own no longer hides in a feed you have to go find. If something breaks on a holding, it surfaces as a risk right in the cockpit; if something good lands, it shows as an opportunity - each one links straight to the ticker.
- Your goal is now YOUR number. Set a target like $50,000 and the whole cockpit re-anchors to it - the progress bar, the amount to go, and the pace all track the goal you actually stated. Leave it unset and it still climbs a sensible milestone ladder so there is always a next number to reach.
- The target is saved to your profile (owner-scoped, private to you) and editable inline from the cockpit in one click - no digging through settings.
- As always: every read is deterministic and two-sided by design - it shows the good and the bad, and never turns either into a buy or sell instruction.

## [0.20.0] - 2026-07-17

The goal cockpit: your target, your progress, and the exact moves your money needs - exits first.

### Changed

- The home screen now LEADS with your goal, not a wall of data. A cockpit at the very top shows where you stand - your account value, your return on invested capital, and a progress bar climbing to your next milestone (or your own target) - so you never have to hunt for whether you are winning.
- Under it sits "what needs you now": a short, ranked list of the actual moves your book needs, built deterministically from the engine reads on YOUR positions. Protecting capital comes first - a broken thesis or a position through its loss line is the loudest row, ahead of any new idea.
- Downside and exits are first-class. It flags when a setup that put a name in your book has invalidated (the get-out signal), when a position is past the loss line for your risk profile, when risk is rising, when a winner is extended enough to bank some, and when one name has grown too large for the book.
- It is personalised: your risk comfort widens or tightens the loss and profit lines, your cash and holdings drive the standing, and idle cash and behind-pace nudges only surface when nothing more urgent is competing.
- Honest by construction: every read is deterministic math on your own positions and goal - risk framing, never a licensed buy/sell call. The app prompts the decision and points you to size it in the Trade Plan; the trade is yours, placed at your broker.

## [0.19.1] - 2026-07-17

Landing polish: the alert-channel pills get their own line.

### Changed

- On the landing page, the Telegram / Slack / WhatsApp pills now sit on their own line below the "Alerts, where you live" label instead of wrapping unevenly beside it on narrow screens.

## [0.19.0] - 2026-07-17

Quantified upside and honest freshness: the high-upside shortlist finally puts a number on the payoff, the live scanner covers the small caps, and stale boards say so.

### Changed

- The emergence shortlist now QUANTIFIES upside instead of only ranking it: each name carries a deterministic bear/base/bull re-rate estimate, a base-case upside %, and an asymmetry ratio (upside vs downside), plus a tier - Asymmetric, Balanced, Limited, or Lottery. It is a model estimate of payoff shape from disclosed factors, clearly labelled as such - never a price target or a promised return.
- The live scanner now covers the 14 small-cap emergence names it never touched before. Previously the scan universe was 100% large-cap, so every high-upside name fell back to a neutral momentum reading and the "market is turning" signal was structurally dead for the exact list the app exists to surface - that leg is now wired to real momentum.
- Honest catalyst freshness: the Catalyst Radar and the countdown are hand-curated editorial lists, and when every event passes they used to silently render nothing - reading as "all quiet" when it meant "nobody refreshed the list". They now show the curation date and an explicit "refresh due" state so an empty board can never masquerade as a calm calendar.
- The position-size calculator now links straight to the Trade Plan, so working out a size flows into sizing it against a real name, your own cash, and the round-trip cost and expectancy - the decision-moment surface is one click from the math.
- Every new upside and conviction number ships with the same discipline: it is a deterministic estimate of shape, it says when no measured track record stands behind it, and it never reads as a proven return.

## [0.18.0] - 2026-07-17

Portfolio-aware, honest about capital: no more fantasy $100k account, real small-account costs, and win rates that never masquerade as a track record.

### Changed

- The paper account no longer starts from a fantasy $100,000 balance: a new account begins from the cash you actually have on file (or a realistic small-account example when none is set), so you practise the position sizes you can really take instead of ones that only work on paper.
- Simulated fills now charge a realistic fixed commission floor instead of a flat 0.05% - the cost that most distorts a small account, where a $3 minimum is a real slice of a $500 trade but a rounding error on a $30k one. Your paper track record is now honest about the drag a beginner actually pays.
- The Trade Plan is now portfolio-aware, not just single-position: it reads your open positions and flags when adding a name over-deploys the whole account (little dry powder left) or piles too much into one correlated theme - the concentration risks that sink small accounts even when each trade looks fine alone.
- Onboarding honesty fix: the strategy picker used to show win rates like "68% win" with no label, reading as a measured fact on the very first screen. Those figures are now clearly marked illustrative - what the strategy aims at, not proof of what it returns.
- The signal-intelligence board now says plainly that its conviction score has no measured track record yet: high agreement between signals today is not a proven hit rate. No number in the app should feel more certain than the evidence behind it.

## [0.17.0] - 2026-07-17

Honest edge and a real trade plan: sizing to your own capital, netting costs against the signal, and never dressing up a guess as history.

### Changed

- A new Trade Plan surface (/plan) sizes one name against YOUR real capital, not a fantasy account: it floors to whole shares, tells a small account when an entry price is simply out of reach, and shows the worst-case dollar loss if the stop is hit - the position-size math finally lives at the moment of decision instead of a separate calculator page.
- The plan models the costs that actually hurt a small account: a fixed commission floor (which is a big slice of a $300 trade), the AUD-to-USD FX spread you pay twice on a US ticker, and wider slippage on thin small-caps - then shows the break-even move you need just to cover the round trip.
- Every win rate now travels with its expectancy, so a high hit rate on tiny wins and large losses (the classic mean-reversion trap) can no longer read as edge - and the plan flags when friction wipes out an otherwise-positive edge for your account size.
- Honesty fix: illustrative outcome numbers are now labelled "illustrative, no measured history yet" wherever they appear, the live signal drawer needs a real 20-sample floor (not 5) before it shows a measured win rate and caveats small samples, and a break-even move no longer counts as a win.
- The AI research assistant can now build the same cost-aware, expectancy-aware plan on request (read_trade_plan) - it presents the risk flags honestly and, as always, never turns them into a recommendation to trade.

## [0.16.0] - 2026-07-16

The calendar tells the truth and every dialog behaves: live events, a real clock, and one shared focus system.

### Changed

- The calendar was frozen in time - a hardcoded "today" of June 3rd meant every countdown in the app was weeks wrong. It now runs on a real clock, reads the nightly-synced event tables when configured (bounded to the 30-day board window so earnings season cannot truncate it), and honestly labels live vs sample data.
- IPO listings now appear on the live calendar too: they live in their own table, so the live board synthesizes their entries with importance scaled by valuation - previously flipping to live mode silently deleted the entire IPO event class the sample set had.
- The sample calendar can never age out: demo events re-anchor to today on every request (not once at server start), so a self-hosted demo deploy that has been up for a month shows the same fresh month of events as a cold start - pinned by a test.
- Every dialog now behaves like a dialog: focus moves in on open and returns on close (screen readers were being stranded behind the backdrop), Tab is contained with hidden elements filtered out, overlapping overlays negotiate via a shared dialog stack instead of fighting over keystrokes, and the feedback sheet joins the same system with Esc-to-close.
- Esc in a deep investigation now steps back one level - matching the on-screen Back button - instead of throwing away the whole trail, and the event drawer shares the exact clock and event set as the board that opened it, so the two can never disagree near midnight.

## [0.15.0] - 2026-07-16

On the move: fresh IPO data, live-refreshing drawers, and a console that respects your thumb.

### Changed

- The IPO radar now serves the live calendar: the nightly Finnhub sync (which was filling a table nothing read) feeds the page hourly, a past-dated "upcoming" IPO can no longer pretend it has not happened, the date sort finally puts the soonest listing on top, and the page says honestly whether you are looking at the live calendar or the sample set.
- The signal drawer refreshes itself the moment you open it - current engine numbers for that one symbol instead of the page-load snapshot, a "how setups like this resolved" line from measured outcomes, an optional AI read grounded on exactly the figures shown (server-side, fabrication-guarded), and a shareable link: /radar?signal=NVDA opens straight to the setup.
- Drawers behave like drawers now: the page behind stops scrolling on every overlay (the #1 mobile scroll leak), Esc closes the chat sheet, focus moves in and returns on close with proper dialog semantics, content clears the iPhone home indicator, and the IPO drawer rides the same shared shell as everything else.
- Mobile screens got their space back: the watchlist no longer renders your entire list twice, the radar caps its card stack with "show more" paging, the nine catalyst cards fold to headline + heat until tapped, the intelligence filter wall collapses behind a Filters toggle, and the home "strongest setups" table - the last one without mobile cards - got them.
- Honesty and thumbs: pulsing "Live" badges on last-scan data now say "as of last scan", sample data is labeled as sample, and the primary controls (IPO filters, panel pickers, chart toggles, refresh) meet the 44px touch floor on small screens.

## [0.14.0] - 2026-07-16

Signature onboarding: a branded terminal splash, gate micro-delight, a private commissioning card, and a live nervous-system map.

### Changed

- npm run dev now opens with a branded first-run splash - the Lyra wordmark in the tri-gradient with "by Vivacity.ai" - printed right before the localhost URL. Truecolor, gracefully plain on a non-TTY, and it can never block the dev server.
- The Setup Companion celebrates progress: the moment a stage clears, its card gets a one-shot tri-gradient shine sweep, plus an opt-in soft tone. Transitions are baseline-seeded so opening the page mid-setup never bursts, and prefers-reduced-motion is fully respected.
- A private commissioning card: once a fresh clone reaches a healthy deploy, npm run commission writes a branded receipt (commission/card.svg + COMMISSIONED.md) into the clone - a local keepsake, read from /api/health, gitignored and never shared anywhere.
- A new nervous-system map at /harness-map.html renders SKILL-CHAIN.md + HARNESS.md as one interactive page - click a chain to focus the sections it owns, filter by path, and see every deterministic gate. Generated on the content pipeline so it can never drift from the rails it describes.
- The README now spells out how to share Lyra by audience - a live link for humans, a fork for builders, AGENT-ONBOARDING.md for agents - and the onboarding ledger records every new asset.

## [0.13.0] - 2026-07-16

Your digital trading twin: Lyra now learns your interests, habits, and risk posture - and reflects them back.

### Changed

- New "Your Twin" surface (/twin): a private, research-only mirror of how you actually trade - your top themes, the signal kinds you trust, your stage lean, and the gap between the risk posture you stated at onboarding and the one your paper trades reveal. A mirror, never advice - the deterministic engine still owns every signal.
- A real deterministic preference model computes your affinities and revealed-risk stats (average position size vs your stated cap, sizing up after a losing close, late-stage chase, theme concentration) from data Lyra already holds - no LLM, fully unit-tested.
- Opt-in, inspectable, portable, deletable: a consent switch gates all behavioural capture (default off), with server-side inspect (GET /api/account), export (a versioned JSON snapshot of your profile + twin), and true delete (wipes every server row) - and the old "nothing is uploaded" copy is now honest.
- The copilot can cite your twin (a read-only read_trading_twin tool) and remembers you across sessions (opt-in conversational memory), and the command centre now surfaces equally-scored names you care about first - with an enforced anti-bubble duty so risk is never hidden.
- Row-level-security hardening: tightened the read policies on the paper-trading tables so your simulated trades are strictly owner-only, plus a migration-scanning test that fails the build if a future change ever re-opens them.

## [0.12.0] - 2026-07-16

The agent harness: every section of the codebase now has an owning maintenance chain, enforced in CI.

### Changed

- New HARNESS.md maps the full enforcement system - deterministic gates (scripts/check-*.mjs), git hooks, CI jobs, the test harness, runtime guards, and scheduled loops - so any agent (or human) can see exactly what keeps this repo honest and how to work inside it.
- New SKILL-CHAIN.md registry assigns every code section an owning skill chain via a machine-checked coverage map: 254 sections, 12 chains, zero orphans - an unowned section now fails CI (npm run check:chains).
- Seven new skill chains join setup, production-keeper, feedback-loop, onboarding-parity, and logs-to-genui: /signal-quality (evidence-backed scoring), /ai-quality (evals + guardrails + system card), /notification-health (delivery + template completeness), /onboarding-funnel (activation drop-offs + the demo promise), /data-integrity (migrations, RLS, demo parity), /security-sweep (secrets, fail-closed authz, abuse limits), and /ux-surface (one surface to premium per loop).
- Every chain carries the same contract: staged gates, execution over advice, and explainability - each run ends with shipped, verified work and a plain-language report backed by engine-owned numbers.
- The harness is wired into onboarding: AGENT-ONBOARDING.md, the ONBOARDING.md ledger, CLAUDE.md, and the /setup wrap-up all route new agents through HARNESS.md and the coverage map.

## [0.11.2] - 2026-07-16

Onboarding stays honest: a parity gate + skill chain across the human, in-app, and agent surfaces.

### Changed

- The three onboarding surfaces - the human walkthroughs, the in-app Setup Companion, and the agent front door - now have a deterministic parity gate (npm run check:onboarding) that runs in CI, so they cannot silently drift from the stack, costs, routes, or walkthroughs the code actually ships.
- A new /onboarding-parity skill chain (with per-surface skills for human, companion, and agent docs) restores parity in one pass and proves it with the gate.
- The in-app Setup Companion copy is now generated from its source at build time, so the served page can never fall behind the authored one.

## [0.11.1] - 2026-07-16

The loop closes: measured outcomes, real digests, follow-up coaching + a console that cannot silently fail.

### Changed

- Every setup now gets its outcome measured: a nightly job computes forward returns (1d/5d/20d/60d, max upside, max drawdown) from the same stored candles that scored the signal, and once the 5-day horizon resolves you get a follow-up alert - "your NVDA setup from Jul 9 is +8.2% after 5 days, cohort median +3.2%" - so the scanner finally answers whether its signals work.
- The daily digest is real: an end-of-session summary (setups found, top scores, alerts sent) lands on your channels every trading night, with a weekly report on Fridays. Quiet-hours alerts are held and released when your window ends - never dropped - and a failed delivery retries once instead of dying silently.
- Published scores can no longer repaint: the in-progress hourly bar is discarded before scoring, so every number an alert cites stays reproducible forever. The three dormant data workers (events + IPOs, fundamentals, intelligence) now actually run nightly, and provider hiccups retry with backoff.
- Console you can trust: the side rail scrolls with visible groups (nothing clipped at 1080p any more), branded error and 404 pages replace the white crash screen, every tab carries its own title, the What's New dot only lights for releases you have not seen, and "Explore the demo first" walks a visitor through the real console read-only before sign-up - while demo-entered holdings and watchlists now survive into a new account.
- Locked down and self-watching: the research tables are read-only under RLS (they were writable with the public anon key), version bumps are enforced in CI so nothing ships undescribed, a failed scan pages Telegram/Slack and the cron keeps itself alive past GitHub's 60-day auto-disable, and /api/health reports when the scanner last ran.

## [0.11.0] - 2026-07-16

Security hardening: SSRF fences, tenant isolation, founder-gating.

### Changed

- Web Push endpoints are now fenced to the real push services (Chrome, Apple, Firefox, Windows) over https, at both save and send time - a subscription can no longer point the server at an internal address, and failed sends no longer echo the remote response.
- The founder-only insights view is now authorized, not just authenticated: it reads cross-tenant question text, so it is gated to a FOUNDER_EMAILS allowlist and fails closed when unset.
- The paper-account view returns an empty account for an unauthenticated request on a live deploy, instead of ever falling back to the shared in-memory store - no cross-tenant positions can leak.
- The post-login redirect only accepts same-origin paths, closing an open-redirect that could bounce a visitor off the trusted domain.
- All four hardened by an adversarial security audit; the SSRF allowlist and the redirect guard are pinned by tests.

## [0.10.0] - 2026-07-16

AI you can measure: quality evals, a learned recovery model, hybrid retrieval, AI-ops.

### Changed

- Lyra now proves its AI is good, not just safe: a labelled question-and-answer test set scores every answer for whether its numbers are grounded, its citations are real, it covers the facts it should, and it refuses questions it should not answer - so a fabricated or advice-y answer turns the build red.
- A learned, calibrated recovery-probability model sits alongside the deterministic score: trained and backtested out-of-sample (it beats a naive baseline), it attaches a research-only probability band to a setup. It informs, it never decides - the engine still owns the action, and the model card is public.
- Smarter in-app doc answers: retrieval now blends exact keywords with a fuzzy character-level match (so "deploying" finds the deploy doc), measured with real retrieval metrics and gated so it can never get worse - all still offline, no embeddings, no new services.
- Stronger safety: new guards block secrets (API keys, tokens, connection strings) and flag personal data in any answer, plus an adversarial red-team test set (jailbreaks, injection, exfiltration) - and a structural check that no AI screen can reach the model without passing the guards.
- New AI Ops dashboard (/ai-ops) surfaces how the AI layer is behaving: throughput, latency, refusal and guard-block rates, circuit-breaker state, and the model card - plus a public AI System Card (/api/ai/system-card) that reads live from the code.

## [0.9.1] - 2026-07-16

Review hardening: honest copy, fresh fill prices, smarter doc answers.

### Changed

- The BYOK copy now tells the exact truth: your AI key is held by your browser and sent only with your own requests to your own deployment - never stored server-side.
- Logged trade fills are priced fresh: the trade-confirm path bypasses the 60s quote cache, so a recorded fill price can never come from a cached preview.
- In-app doc answers got sharper and safer: natural questions ("what is lyra?", "how much does this cost?", "how do I set this up?") now find the right doc, while market and advice questions can never pull doc examples into the prompt.
- /api/health now verifies the Redis cache with a real PING (reports upstash-unreachable when it is down), and cache writes are awaited so serverless deploys cannot silently drop them.
- Goal-card accessibility: only the visible face is read by screen readers, keyboard focus survives the Setup Companion refresh, all animation respects reduced-motion - and cost badges no longer wrap broken on phones.

## [0.9.0] - 2026-07-16

Continuous intelligence + a robust agent harness.

### Changed

- New Signal Intelligence board on Small Caps: it scans every independent signal across the universe - government backing, big-tech capital, smart money, supply-chain bottlenecks and turning momentum - and ranks the names where several converge at once. Convergence of independent signals is the highest-conviction "look here," and it is scored deterministically, never guessed.
- The government-backing signal is now LIVE, not static: Lyra pulls real US federal contract awards for the small-cap watchlist from USAspending.gov (a free, keyless source), caches them, and shows exactly whether each award is live or an illustrative sample - so official spend, an early pre-consensus read, is continuously fetched rather than hand-curated.
- The AI co-pilot can now reason over that convergence intelligence as a first-class, read-only tool - it finds and cites the most effective data points instead of narrating a single fixed snapshot, while still only explaining what the engine computed.
- A hardened safety layer around every AI answer: one unified guardrails verdict (blocks trade advice, prompt-injection echoes, and ungrounded numbers; flags predictive overclaims) is enforced at the answer boundary, backed by an eval-gate - a safety test set that turns the build red if any guard is ever weakened.
- Under the hood, the AI gateway is more resilient: transient provider failures are retried with backoff, and a concurrency limiter plus spend budget stop a burst of requests from running away. Plus a new roadmap pitch - your private Digital Trading Twin (docs/strategy + README).

## [0.8.0] - 2026-07-16

Setup Companion, agent onboarding, Redis cache + a knowledge layer.

### Changed

- Running /setup now opens a live Setup Companion in your browser - a premium spec of the whole stack (real logos, honest cost badges) plus a stage-by-stage progress board your agent updates as it builds. Also served in-app at /setup-companion.html.
- Six animated "ultimate goal" cards - punchy on the front, tap to flip for the detail - on the companion AND the landing page, alongside the full stack grid with per-technology costs.
- Agents get a front door: AGENT-ONBOARDING.md (mission, setup contract, security ground rules, verification gates) plus ONBOARDING.md, the ledger of every onboarding asset and experience.
- The AI co-pilot now answers questions about Lyra itself with citable sources: a deterministic knowledge layer compiles the reference docs at build time and retrieves the relevant sections into chat - no embeddings, no new services, works in demo mode.
- Optional Redis caching (Upstash REST) for market quotes and hot reads - a pure optimisation with an in-process fallback, so nothing new is ever required. /api/health reports the active cache backend.
- Deploying is agent-friendly: walkthrough 04 and /setup include the full Vercel CLI path (login, link, env, deploy) so an agent can put Lyra online end to end.

## [0.7.0] - 2026-07-16

Replicate it: walkthroughs, /setup agent, Docker/Coolify, full costs.

### Changed

- Share the repo link and anyone can run their own Lyra: six adversarially fact-checked walkthroughs (docs/walkthroughs/) cover what it is, running it in 5 minutes, going live on your own Supabase, deploying, reading the score, and getting alerts on your phone.
- Claude Code users can skip the manual path entirely: run /setup in a fresh clone and the bundled agent playbook (.claude/commands/setup.md) sets everything up end to end, with a verification gate at every stage and costs shown before anything paid.
- Self-hosting is now first-class: a production Dockerfile (Coolify/Docker), a public /api/health probe that reports the running version and mode, and a Coolify deploy runbook (docs/runbooks/coolify-deploy.md).
- COSTS.md itemises every service in the stack with prices verified on provider pages - demo is $0, a fully live always-on setup runs on free tiers, self-hosting is about US$13/mo.
- Setup truth fixes: supabase/migrations/ is documented as the canonical schema (with the one sql/ reconciliation script that follows it), and the README quick start now matches the real dev port.

## [0.6.0] - 2026-06-27

TradingView Copilot + Pine strategy export.

### Changed

- Export any name as a TradingView strategy - click "Pine" on the chart toolbar to copy a backtestable Pine v5 strategy that reproduces Lyra's exact oversold-recovery score. Paste it into TradingView and backtest the same logic that surfaced the setup.
- The generated Pine is a faithful, drift-guarded mirror of the scanner engine (signal_engine.py): same RSI reset band, MACD-histogram recovery, 60-period-low distance, trend and volume rules, capped at 100.
- New TradingView Copilot runbook (docs/tradingview-copilot.md): drive your TradingView Desktop from Claude over the Chrome DevTools Protocol - read the live chart, switch symbol/timeframe, inject + backtest the Lyra strategy, run replay, and screenshot back into a Finding. All local, research only.

## [0.5.1] - 2026-06-20

Brand + UI polish, Find/Graph fixes.

### Changed

- Fixed Find and Graph: push-test and system notifications were showing up as "findings" (and left the graph blank). Those are now filtered out, so Find shows real setups (or the demo set until the scanner surfaces yours) and the graph is never empty.
- Find and Graph moved down the navigation - they were over-promoted to the #2/#3 mobile slots; your daily surfaces (Portfolio, Trades, Watchlist) now come first.
- New Lyra logo - the app-icon arrow (a white up-right arrow on the gradient square) is now the in-app logo, the loading screen and the browser-tab icon, matching your home-screen and email icon.
- The Getting started checklist is now collapsible (and renamed from "Get started").
- The app version and its release date are now visible on the landing page and in the account menu, both linking to this changelog.

## [0.5.0] - 2026-06-20

Dogfooding gap-closers from the functionality audit, plus a visible version number on the landing
page and a version-numbered in-app changelog (`/whats-new`) so what is deployed is always legible.

### Added

- **App version + in-app changelog.** The landing page shows the current version (so you can tell at
  a glance whether the deploy updated), and `/whats-new` leads with a version history. Single source of
  truth: `src/lib/version.ts` (kept in lockstep with this file + `package.json`).
- **Finding lifecycle controls.** The finding drawer now has live promote/dismiss actions (Watchlist
  candidate / Deep research / Paper-bot queue / Review risk, plus "Dismiss as noise") wired to the
  lifecycle API; they appear only on live findings and refresh the feed on save. (Were display-only.)
- **Account currency in onboarding.** The capital step now captures your base currency (defaults AUD)
  and writes it to your profile, so AUD/`.AX` trades log straight away instead of being rejected until
  you visit Account settings.
- **Two-week rating prompt.** After ~2 weeks of use, a compact "Has Lyra helped you trade?" 5-star
  prompt appears once (never on day one); the rating routes through the existing feedback intake.
  "Maybe later" snoozes a week. Preview any time with `?rate=now`.

### Changed

- **`/graph` is now live-wired** - the relationship map builds from your real findings (demo fallback
  when none), and both `/findings` and `/graph` render at request time so per-user data actually shows
  (they were being served from a build-time demo snapshot).

## [0.4.0] - 2026-06-18

Currency-safe trade logging + the Investigation System taken from a single feed to a full
investigation surface (the relationship graph, live data, and AI-generated views). Every change in
this release was put through an adversarial multi-dimension review before merge; the seven defects it
confirmed (including a critical cross-currency one) were fixed in the same pass - that history is
recorded below under "Caught in review." Still research software, no live execution.

### Added

- **Investigation Graph at `/graph`** - one explorable relationship map across every finding.
  Shared nodes collapse, so the map shows what the per-finding drawer cannot: which names sit on the
  same supply-chain bottleneck, theme, or government buyer. Tap any node to open its drawer and walk
  its evidence + connections; the drawer state is URL-persisted (shareable, reload-safe). Deterministic
  layout, deterministic data.
- **Live findings** - `/findings` now projects real `notification_events` (scanner signals, theme
  moves, discoveries, portfolio risk) into the investigable Finding shape via a pure adapter, with a
  lifecycle table (`findings`) for reversible promote/dismiss. Falls back to demo findings when signed
  out or before the scanner has surfaced anything. The projection never invents a number.
- **Generated views in the drawer (GenUI)** - "want to see what this looks like?" composes a compact
  view on the spot: the AI chooses the layout + prose, but every number is engine-owned and pulled
  from the deterministic finding. Guarded so the AI cannot smuggle a figure (digit OR spelled-out) or
  an advice/"Buy" phrase into the view; with no model connected it renders a deterministic default,
  never a blank.
- **Richer entity drawers** - an entity now shows the evidence that touches it, walkable from both the
  feed and the graph.

### Changed

- **Currency-aware trade logging.** Account cash is held in a base currency (owned by your profile).
  A trade priced in a different currency (e.g. an ASX `.AX` name quoted in AUD against a USD account)
  is now rejected with a clear message instead of silently corrupting the cash pool and average cost -
  FX conversion is a later phase. Trade currency is stamped on positions + logs. The chat trade
  preview declines a cross-currency buy up front rather than offering a confirm card that would fail.

### Caught in review (fixed pre-merge)

- **Cross-currency guard read the wrong table.** The base currency is written to `profiles`, but the
  guard read `operator_profiles` (never written -> stuck at the `USD` default). For the default AUD
  user this inverted the guard: it would have rejected valid AUD trades and *allowed* a USD trade to
  corrupt an AUD book - the exact failure the feature exists to prevent. Now both the RPC and the chat
  preview read the base currency from `profiles`. (Known limitation: base currency is set in Account
  settings; until set it defaults to `USD`, so the guard fails safe by rejecting, never by corrupting.)
- **GenUI advice + spelled-out numbers.** The fabrication guard checked digits only, so "strong buy,
  load up" or "doubles to a forty dollar target" passed. Added a lexical advice/quantity filter; a hit
  drops the block to the deterministic default.
- **Live finding scores.** `relevance_score` (DB-defaults to 100) was being shown as the headline
  composite, making non-scanner findings read a false 100/100. It is now kept as confidence only;
  findings with no real composite read "NR" (not rated).
- **Dismiss was permanent.** The lifecycle RPC never cleared `dismissed_at`, so a re-promote was a
  silent no-op. A promote now clears the dismissal.
- **Graph theme nodes overlapped.** Multiple zero-radius (center) theme nodes stacked on the exact
  same point, rendering as one unclickable blob; they now spread on a small inner ring.
- **GenUI breadcrumb** showed the raw finding id instead of "Generated view".

### Ops

- New migrations: `027_trade_currency.sql` (currency columns + currency-aware `log_buy_trade`),
  `028_findings.sql` (findings lifecycle table + `set_finding_lifecycle`). Apply with 026 against the
  live DB.

## [0.3.0] - 2026-06-18

Dogfooding-readiness pass. A deep adversarial audit found the deterministic core was excellent but
the app was "unplugged" - built fast in pieces and never wired end to end (each part passed in
isolation; the seams did not). This release closes that last mile across nine systems and adds the
Investigation surface. Still research software, no live execution.

Design ethos worth recording: Lyra holds a strict dense / compact command-centre standard - small
type scale, hairline dividers, miniaturised stat tiles, no wasted space. Density is a forcing
function. It resists generic, padded "AI slop" layouts and lands on something production-grade far
faster.

### Added

- **Investigation System (Phase 1)** at `/findings` - every surfaced setup is an Opportunity
  Finding you can investigate by peeling back layers: finding -> evidence -> source record ->
  entity -> connected pattern, in a nested drawer stack whose state is persisted in the URL
  (shareable, reload-safe). Every evidence item carries an explicit "what it does not prove."
- **Persistent Trade Log** at `/trades` - a durable view of logged buys with per-row undo, so
  reversal is no longer trapped in an ephemeral chat bubble.
- **Education in context** - jargon defined inline on the Signal Radar, Ticker Detail, and the
  analytical spaces (tooltips + glossary drawers), each linking into the academy.
- Conversational buy logging now previews the live quote (shares, fill price, cash left) before you
  confirm; declarative sell-log requests get an honest "not yet" reply instead of a generic answer.

### Fixed

- **Notifications now actually deliver.** Signal alerts route multi-channel (web push / Telegram /
  WhatsApp) stamped with the user id, not a hardcoded legacy channel; quiet hours are evaluated in
  the user's timezone (was server UTC, which inverted the window); deferred alerts are held and
  released on the next tick (was a digest queue with no drainer - silent loss); the hourly cron now
  passes the dispatch env (was inert in production); chat channels are verified before delivery;
  WhatsApp uses approved templates; push renders the full message (data + why + disclaimer);
  demo_logged no longer counts as delivered.
- **Trade undo can no longer corrupt a position** - undo is now reverse-chronological per symbol
  (the prior absolute-snapshot restore wiped a later buy when an earlier one was undone).
- **Onboarding no longer silently drops your book** - watchlist/portfolio saves check the result
  and surface a retry instead of showing "all set"; typed tickers persist; the push toggle registers
  a real browser subscription; beginner answers reach the AI's constraints.
- **AI correctness** - the default Anthropic model was a retired id (a hard failure for BYO Claude
  users); the fabrication guard is now actually called; education modules feed the AI corpus; the
  run audit trail persists instead of evaporating on cold start.
- **Signal honesty** - StrategyLab unit mismatch fixed (the default strategy showed 0 matches);
  per-component score bars no longer read 0 in the live path; a dead or stale scan now shows an
  amber/red badge instead of a confident green "Live"; fabricated backtest stats relabelled
  illustrative.

### Changed

- **Renamed the strategy from "momentum" to "oversold-recovery"** end to end. The engine rewards an
  RSI reset, an improving-but-still-negative MACD histogram, and price near its 60-day low, so a
  high score means "a beaten-down name turning up," not "breaking out to new highs." The words now
  match the math.
- One shared page-title token for consistent typography; worker dependencies pinned to ranges; dead
  code (GlassMomentumChart) and a dead env flag removed.

### Ops

- Vercel env + GitHub Actions secrets fully wired (the two-store model: app env vs scanner/CI
  secrets, environment-scoped where needed); live DB migrated 022-026 (onboarding capture,
  conversational trade logs, multi-channel push, the undo-order guard).

## [0.2.0] - 2026-06-12

Lyra grows from a momentum scanner into a thematic-intelligence + research platform, with
the security-first foundations a future trading bot would sit on. Still research software,
no live execution.

### Added

- **World Radar** - thematic intelligence that scans the causal chain behind returns: 10
  secular themes (AGI infrastructure, space, power grid, nuclear, semiconductors, critical
  minerals, and more), each with a first-principles supply-chain map, ranked companies, and
  a "what would prove this wrong" falsifier. AGI infrastructure and space are mapped deepest.
- **Small-cap discovery engine** - deterministic opportunity scoring (theme fit, bottleneck
  exposure, evidence, momentum) that sorts under-discovered names into honest buckets,
  including an explicit "avoid - dilution / hype risk" list.
- **Investor Radar** - tracked managers' disclosed 13F moves with first-class delay caveats;
  surfaces which small caps elite money is touching. Research context, never copy-trading.
- **Signal events engine** - deterministic detection of the major timing events: MACD
  crosses, RSI oversold/overbought crossings and the behavioural recovery/rollover, plus
  Bollinger breaks. Each event pins as a static SIGNAL for 24h and is then tracked as a
  story (price/score move since the trigger). Unit-tested for accuracy.
- **Paper trading** - a simulated account with realistic fees + slippage, a trade journal,
  and honest per-strategy readiness gates that say "not ready for automation" until the
  evidence exists.
- **Bot Readiness** - the deterministic pre-trade risk engine (kill switches, position /
  loss / liquidity / staleness checks, fail-closed), shown refusing a demo order. Live
  broker execution is intentionally not implemented; AI never creates orders.
- **Chart studies** - independent Bollinger / RSI / MACD toggles on the Command holdings
  charts and the ticker page, plus a one-tap **Full Setup** button that jumps to a stock
  with all three studies pre-activated.
- **AI-native content layer expansion** - themes, supply-chain nodes, companies, capital
  events, and investors all live in agent-editable JSONL compiled to importable JSON.
- **Security + messaging foundations** - secret-verified Telegram webhook + pairing flow,
  signature-verified WhatsApp architecture, a unified notification router (quiet hours,
  dedupe, safety-critical bypass), and AI guardrails (prompt-injection isolation, tool
  permissions, citation enforcement). Evidence-store + trading Supabase migrations with RLS.
- **Documentation system** - architecture, security (threat model, OWASP LLM mapping,
  webhooks, trading risk controls, incident response), runbooks, testing, product, and the
  broker-adapter spec.

### Changed

- **Living Command** - the executive strip rotates Your Book / Watchlist leaders / losers /
  picks; metric and IPO tiles roll through three faces on a calm cadence; the Daily Brief
  "listens" and injects NEW/HOT lines; the watchlist board explains its two-gate trigger
  mechanic; the market and AU-macro strips became Intel-style ticker tapes with plain-English
  reads and tappable sources (renamed MARKETS / AU MACRO).
- **Collapsible Holdings Momentum** - collapse-all + per-card collapse; compact currency
  chips ($13.1K) that fit one line.
- App-wide one-eye-line density pass across stat grids; nav icons ramp through the Lyra
  palette; education gained a proper beginner/intermediate/advanced learning path.

### Fixed

- TradingView studies now actually apply - switched from the raw embed iframe (which ignored
  the `studies` and toolbar params) to the official advanced-chart widget script.

## [0.1.0] - 2026-06-08

Initial public release. Lyra is a research-first, mobile-dense momentum console for US
technology stocks. Runs on built-in demo data with zero setup.

### Added

- **Momentum engine** - deterministic 0-100 recovery score from RSI, MACD histogram, price
  location, trend context, and volume participation, on an hourly cadence.
- **Command centre** with executive strip, daily brief, holdings momentum board, and signal
  table; **Signal Radar** and **Live Wire** feed.
- **Personal surfaces** - Portfolio, Watchlist, and a **Comparison Lab** with an adaptive
  axis (time-only intraday, day-only over longer windows) and a hover/drag date scrubber.
- **Research surfaces** - Simulation Lab, Strategy Lab, Calculators, Calendar, IPO Radar
  and deep-dive, Intelligence feed, Smart Money, Commodities, and Fundamentals.
- **Learn** - a beginner/intermediate/advanced learning path with inline topic drawers, plus
  a glossary hub.
- **Three run modes** - demo (no keys), live (Supabase + market data + Telegram alerts), and
  an optional AI explanation layer.
- **AI-native content layer** - editorial data (IPOs, smart money, commodities) lives in
  `content/*.jsonl` and compiles to importable JSON, so facts are updated by editing one line.
- **Ultra-compact, mobile-first density** across every stat surface.
- **Product updates timeline** (What's New) - a vertical chain with a colour-coded dot per
  update (feature / improvement / mobile / data / fix), filterable and searchable.
- Project docs: README, LICENSE (MIT), SECURITY, PRIVACY, DISCLAIMER, CONTRIBUTING, and a
  Code of Conduct.

### Fixed

- First-time visitors now land on the marketing page (then step into onboarding) instead of
  being dropped straight into setup.

### Notes

- Research software, not financial advice. See [`DISCLAIMER.md`](DISCLAIMER.md).

[Unreleased]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.37.0...HEAD
[0.37.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.36.0...v0.37.0
[0.36.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.35.0...v0.36.0
[0.35.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.34.0...v0.35.0
[0.34.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.33.0...v0.34.0
[0.33.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.32.0...v0.33.0
[0.32.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.31.0...v0.32.0
[0.31.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.30.0...v0.31.0
[0.30.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.29.0...v0.30.0
[0.29.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.28.0...v0.29.0
[0.28.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.27.0...v0.28.0
[0.27.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.26.0...v0.27.0
[0.26.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.25.0...v0.26.0
[0.25.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.24.0...v0.25.0
[0.24.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.23.0...v0.24.0
[0.23.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.22.0...v0.23.0
[0.22.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.21.0...v0.22.0
[0.21.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.20.0...v0.21.0
[0.20.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.19.1...v0.20.0
[0.19.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.19.0...v0.19.1
[0.19.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.18.0...v0.19.0
[0.18.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.11.2...v0.12.0
[0.11.2]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.11.1...v0.11.2
[0.11.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/releases/tag/v0.1.0
