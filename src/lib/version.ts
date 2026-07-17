/**
 * Single source of truth for the app version + the in-product, version-numbered changelog.
 *
 * To cut a release you edit ONE thing: prepend a new entry to RELEASES below. APP_VERSION and
 * APP_VERSION_DATE derive from RELEASES[0], so they can never drift. Then run `npm run release` to sync
 * package.json + CHANGELOG.md, commit and push. A pre-push git hook (scripts/check-version-bump.mjs)
 * BLOCKS a push that changes shippable code (src / supabase / workers / public) without a version bump,
 * so shipping a change without a version number is no longer possible (bypass: VD_SKIP_VERSION=1).
 *
 * The version is shown on the landing page (with its date) and in the account menu, both linking here.
 */

export interface Release {
  version: string;
  /** ISO date the version shipped (yyyy-mm-dd). */
  date: string;
  /** One-line theme for the version. */
  title: string;
  /** User-facing highlights, most important first. Plain hyphens only - never an em dash. */
  highlights: string[];
}

/** Newest first. The first entry is the current build; APP_VERSION + APP_VERSION_DATE derive from it. */
export const RELEASES: Release[] = [
  {
    version: '0.52.0',
    date: '2026-07-17',
    title: 'The scout loop closes: accepted cards queue a build, and your verdicts teach the machine',
    highlights: [
      'v2 - Draft-a-vertical: accepting a scout card now queues real creation. Set a scout card to Planned and it enters the drafting queue (npm run scout:queue lists it, evidence attached); the /draft-vertical playbook turns it into a reviewable pull request - theme, companies, chain nodes, backing events, and the attach keywords that make the scout start MAPPING that news instead of banking it as unmapped. Agents draft, humans merge - the vertical map never changes without your review.',
      'v3 - Your verdicts stop evaporating. A nightly stamping pass reads every decided card exactly once: accepted cards credit the sources whose evidence backed them, declined cards debit them - an earned source leaderboard now lives on the Scout tab. Declined entities join a stop-list, so a signal you rejected can never re-file or reappear as a drumbeat. All counts, no model opinion.',
      'Shipped verticals get measured, not assumed: the Scout tab\'s theme chips now show attach volume over the trailing 14 nights - whether a vertical is actually attracting news is a number you can watch, and a scout-born vertical that goes quiet shows it.',
      'The full loop, end to end: noticed -> drumbeat -> card -> your verdict -> either a drafted vertical PR (and the news starts attaching) or a stop-listed entity (and the noise never returns) - with every verdict sharpening which sources earn trust.',
    ],
  },
  {
    version: '0.51.0',
    date: '2026-07-17',
    title: 'Track Record: the real numbers, and one score that cannot silently drift',
    highlights: [
      'New Track Record page (in Practice) shows how Lyra\'s signals have ACTUALLY resolved - win rate, average and median forward return at 1, 5, 20 and 60 days - measured from real labelled outcomes, not a backtest and not an estimate. It leads with the sample size and the exact date window, gates any group under 20 resolved signals as "still measuring", and when there is no history it says "not yet measured" rather than showing a decorative number.',
      'This replaces invented statistics. The strategy presets carried hardcoded win rates (the flagship claimed 67%) with a code comment saying they came from simulation - they did not, and the real measured win rate for the high-conviction signal is closer to 44%, with a roughly break-even median. Showing the humbler truth is the whole point of a research tool; the preset numbers are now clearly labelled illustrative everywhere they appear.',
      'Under the hood: the deterministic score now has ONE canonical implementation instead of three near-copies, and a cross-language parity contract (shared golden vectors) makes the TypeScript and Python scorers prove they agree on every commit - if either drifts, its own tests go red. Building the contract already caught and corrected the documented numbers.',
      'Also fixed: the onboarding strategy recommender silently recommended nothing on its main path because it matched by a display name that had been renamed - it now matches by stable ID.',
    ],
  },
  {
    version: '0.50.0',
    date: '2026-07-17',
    title: 'Scout gets its own tab - perception and proposals, cleanly separated',
    highlights: [
      'The What\'s New page now switches between three surfaces: Updates (the changelog), Ideas (the community board, where scout cards land as proposals), and Scout (the perception stream - what the AI scout read, per-vertical counts, and the drumbeats building toward promotion). The feed no longer pushes human ideas below the fold, and it has room to grow.',
      'The tab is named Scout deliberately, not "AI Signals" - in Lyra, "signals" means the deterministic trading signals the engine computes, and that word stays reserved for them. The scout reads news; it never generates trading signals.',
      'A one-line bridge on the Ideas tab ("Scout: 8 signals building toward promotion") keeps the story walkable in one tap - the board explains its own sparseness. Deep-link with ?tab=scout.',
    ],
  },
  {
    version: '0.49.0',
    date: '2026-07-17',
    title: 'One doctrine for the copilot: research that checks your fit, never a trade to place',
    highlights: [
      'Resolved a contradiction that had lived inside Lyra\'s own instructions: when you had a saved profile, the copilot was told to "size every idea" and say how many shares or dollars fit - while the same prompt\'s non-negotiable rule says Lyra never tells you to buy, sell, hold or size a position. Research-only is the line, and it wins.',
      'The copilot now CHECKS ideas against your goal, cash and risk comfort - flagging when a name sits outside your comfort or would breach your max position size - but never prescribes a share count or dollar amount. It describes the fit and leaves the decision with you, which is the whole point of a research tool.',
      'Pinned with a test so the contradiction cannot quietly return.',
    ],
  },
  {
    version: '0.48.0',
    date: '2026-07-17',
    title: 'See what the scout sees - the live feed, self-verifying evidence, and an AI read',
    highlights: [
      'The Ideas board now opens with "What the scout saw": last night\'s read counts per vertical, the freshest items with their sources, and - the best part - the drumbeats still BUILDING toward promotion ("Commonwealth Fusion Systems - 2/3 items, 1/2 sources, needs 1 more independent source"). The bar stays hard; the patience is finally visible instead of looking like an empty board.',
      'Scout cards are self-verifying now: every evidence link names its source and date, and long evidence lists expand in place - "2 independent sources" is something you can check at a glance, not something you have to trust.',
      'Each scout card gains an optional AI read: 2-4 plain sentences on what the evidence collectively suggests, grounded STRICTLY in the attached headlines, guarded against invented facts and advice, and cached so one generation serves everyone. If AI is off or the guard rejects, the deterministic summary simply stands - the card never depends on a model.',
      'Under the hood: the nightly scout writes a run ledger (scout_runs) the product reads, drumbeats are computed by the same Python that promotes ideas so the surface can never drift from the real bar, and this release also carries the cluster-side code the previous two releases referenced.',
    ],
  },
  {
    version: '0.47.0',
    date: '2026-07-17',
    title: 'Honesty hardening: workers that store nothing now go red, and two privacy holes closed',
    highlights: [
      'A full audit found four surviving pockets of the "green step that stored nothing" bug the last wave was meant to kill - and closed every one. The events worker\'s persist failures were being caught by an outer handler that reported success anyway; the intelligence worker had the whole pre-fix shape (swallow the write error, claim success); the fundamentals worker exited cleanly on a total crash because its fatal status was spelled differently from what the exit check looked for; and the scout\'s idea board could never save a card because its upsert key was a partial index Postgres refuses as a conflict target - the same class of bug fixed for two other tables last week, missed on a third.',
      'Each fix ships with a test that reproduces the exact failure and would go red if it ever came back - proven by running them against the old code first. A worker that fetches data and stores none of it now fails loudly instead of decorating a green nightly run.',
      'Closed a cross-user privacy hole: on a fresh install, the setup script re-opened a read leak that a prior migration had fixed, making every user\'s simulated paper trades readable with the public key. The reconcile step now senses the real table shape and keeps owner-only reads - verified closed on production.',
      'Closed a privilege-escalation hole: the community ideas board trusted a role column any signed-in user could write to their own profile, so anyone could self-promote to moderator and rewrite others\' ideas. A database trigger now blocks role changes outside the server - live on production.',
    ],
  },
  {
    version: '0.46.0',
    date: '2026-07-17',
    title: 'The macro fleet: RBA decisions in your channels, a live calendar, CGT radar, and your return in AUD',
    highlights: [
      'Lyra now watches the Reserve Bank. On each of the 8 decision days a year (seeded from the RBA\'s published 2026-27 schedule, verified at the source), a dedicated job fires minutes after the 2:30pm announcement: it reads the official statement, extracts held / cut / raised and the new cash rate from the Board\'s own words, measures the AUD/USD move since just before the announcement, and tells you what that does to your US holdings in AUD terms. If the statement cannot be read, the alert still fires - it just refuses to quote a number it never saw.',
      'Morning companions ride the nightly run: a pre-brief on decision mornings, a note when the Board minutes drop two weeks later, a heads-up when the RBA Chart Pack updates the morning after each meeting, and an FOMC morning-after brief the day the Fed moves overnight.',
      'The calendar is finally alive end to end: 56 seeded macro events (every RBA decision, minutes and Chart Pack date for 2026-27, every 2026 FOMC decision) now flow into the events table nothing had ever written to, and the calendar drawer stops being four bare facts - macro events show what the event is, why it matters, the announcement\'s local time, and a link to the primary source. Earnings for names you hold or watch, and imminent IPO listings, now alert the morning before they land.',
      'The Command page countdown ticks to real instants now - the next RBA decision counts down to 2:30pm Sydney and the FOMC to 2:00pm New York, timezone-correct across daylight saving, fed live from the calendar instead of a hand-curated list.',
      'CGT radar: every position with a purchase date now shows where it sits against the Australian 12-month CGT discount - a quiet held-duration badge that turns amber inside 30 days of the anniversary and green past it - and gains get a notification at 30 and 7 days out. Date math from your records, general information not tax advice.',
      'Your reviews now benchmark honestly: the monthly, quarterly and yearly reviews add a you-vs-S&P-500 line, and the Friday weekly report translates your USD return into AUD terms using the week\'s actual currency move. Both lines are measured from stored market snapshots and are silently omitted until enough history exists - never estimated.',
      'Found and fixed along the way: the hourly market snapshot (regime, VIX, AUD/USD) had been failing to store since the table was created - a NOT NULL column the insert never supplied, swallowed by a catch-all guard. The macro history archive starts accruing for real tonight.',
      'Macro alerts are ON by default from this release (they were silently off) - 8 decision days a year is signal, not noise. One toggle in notification settings turns the whole pillar off.',
    ],
  },
  {
    version: '0.45.0',
    date: '2026-07-17',
    title: 'The harness learns from its own gaps',
    highlights: [
      'The version guard now blocks a release that would move the app version backwards. Two agent sessions can ship from one shared tree, and the version counter they share had no direction check - a real regression this week proved it.',
      'Scout hardening: live and demo mode now share one clustering pipeline (the forked path caused a real crash), the 14-day drumbeat window announces loudly if it ever saturates instead of silently weakening, and scout items older than 90 days are pruned so the table cannot grow without bound.',
      'The lessons behind every gate are now written where people actually read them: a new "How this repo stays honest" section in the README, hard rules in AGENT-ONBOARDING, and two new earned-lesson entries in HARNESS.md.',
    ],
  },
  {
    version: '0.44.1',
    date: '2026-07-17',
    title: 'Scout demo-mode fix, proven by its first production run',
    highlights: [
      'Fixed a crash in the scout worker when running with no database configured (the demo promise): a refactor left the keyless path referencing a value only computed on the live path. Pinned with a test that runs the whole orchestrator keyless.',
      'The scout completed its first production run tonight: 400 broad-signal items read from 36 live feeds, attached across all ten verticals, with 110 unmapped items banked into the 14-day window where emerging-vertical drumbeats accumulate. No idea cards yet - the bar (3 items from 2 independent sources) is deliberately hard to clear on night one.',
    ],
  },
  {
    version: '0.44.0',
    date: '2026-07-17',
    title: 'Your reviews now actually arrive - monthly, quarterly and yearly, with your real return',
    highlights: [
      'The periodic reviews finally have a scheduler. On the last trading day of every month, quarter and year, Lyra now measures your portfolio and sends the review to your channels - and if a run is missed, it self-heals: the review arrives a night late instead of never, and can never double-send.',
      'The performance number is real, not narrated. Your return is measured from the same stored prices the scanner scored: positions you held at the start of the period are measured from the period-open price, and positions you bought during the period are measured from what you actually paid - so nothing is credited or blamed for price action you never held. Positions with no price data are skipped and the skip is counted, never hidden.',
      'Each review names your best and toughest position for the period with its measured move, so you can really see how you did at every zoom level - week, month, quarter, year.',
      'The Friday weekly report now carries your measured weekly portfolio return too, and Slack reviews show the same cash-with-wings performance tiers as Telegram (5% / 10% / 15%), with losses shown honestly in red.',
      'Under the hood the measured number now survives the whole pipeline: it rides the dispatch API, is stored with the event, and is rebuilt correctly when a review held by quiet hours is released later - previously the renderers supported a performance badge that nothing could ever feed.',
    ],
  },
  {
    version: '0.43.0',
    date: '2026-07-17',
    title: 'Deploys verify themselves now - and a fresh clone is proven to build, on every push',
    highlights: [
      'Every push to main now gets a deploy smoke check: a workflow waits for the live site to actually serve the version that was just pushed, then probes the health endpoint, the landing page content, and the sign-in gate - and pages Telegram and Slack if any of it fails. CI proves the build; this finally proves the DEPLOYMENT, which is where six past bugs slipped through behind green tests.',
      'A fresh install is now a guarantee, not a hope: CI builds the ENTIRE database schema from empty on every push - all 43 migrations in order plus the reconcile script, against a throwaway Postgres. The class of bug where a new clone could not build the schema at all (it shipped once) now turns the build red before it merges.',
      'The new gate paid for itself on its first run: it caught a demo seed writing against a constraint that no longer exists and 8 stale indexes referencing columns from pre-multi-user table shapes - all of which would have broken every fresh install following the documented setup path. All repaired, with guards that stay correct on both old and new installs.',
      'Both gates are registered in the harness enforcement map (HARNESS.md) with the one rule every Lyra gate must obey: a green must be able to go red.',
    ],
  },
  {
    version: '0.42.0',
    date: '2026-07-17',
    title: 'A background job that stores nothing now says so, instead of reporting success',
    highlights: [
      'The nightly jobs can no longer claim success while saving nothing. Both the events and fundamentals jobs caught their own database errors, logged a quiet warning, and reported "success" - so for months the dashboards showed a healthy green run while the tables sat completely empty. A job that fetches 21 events and stores none of them has failed, and it now says so loudly enough to trigger an alert.',
      'The per-stock log no longer lies either: it used to print "snapshot + metrics persisted" for every company regardless of whether the write actually succeeded. It now reports the real number stored.',
    ],
  },
  {
    version: '0.41.0',
    date: '2026-07-17',
    title: 'The calendar and fundamentals are storing real data for the first time',
    highlights: [
      'Company events and fundamentals now actually save. The nightly jobs had been reporting success while writing nothing at all: the upsert key was built as a partial index, which Postgres cannot use as a conflict target, so every single write was rejected and the jobs logged a warning and carried on. Both tables were empty. They now hold real rows, which means the market calendar reads live events and fundamentals have somewhere to land.',
      'This was caught by watching a real run persist zero rows rather than by trusting a green tick - the job had been "succeeding" the whole time.',
    ],
  },
  {
    version: '0.40.0',
    date: '2026-07-17',
    title: 'The new reviews could never have been delivered - the API was rejecting them',
    highlights: [
      'Fixed a gap that would have made the weekly, monthly, quarterly and yearly reviews impossible to send. Every renderer supported them, but the endpoint that actually accepts an alert kept its own hand-written list of allowed types - and the reviews were not on it. They would have been turned away as "type is invalid" and never reached you.',
      'Closed the whole class of bug rather than the one instance: the list of valid alert types is now generated from a single source that the compiler forces to stay complete, so adding a new kind of alert can never again leave the door shut behind it.',
    ],
  },
  {
    version: '0.39.0',
    date: '2026-07-17',
    title: 'The AI scout: Lyra now reads the wide world nightly and files evidence-linked ideas on the board',
    highlights: [
      'Lyra can now NOTICE. A nightly scout reads a curated registry of 100 broad-signal sources - 36 open feeds (NASA, DoE, DoD, SpaceNews, SemiAnalysis, World Nuclear News, IEEE Spectrum, mining and quantum trade press) plus the Finnhub general-news firehose - and deterministically attaches every item to the vertical map. All 36 feeds were verified live before shipping.',
      'Signal with NO home vertical is the interesting part: when an unmapped entity recurs across at least 3 items from 2 independent sources inside a 14-day window, the scout files an idea card on the SAME Ideas board humans use - marked Scout, with the evidence links attached and a confidence that is pure breadth math, never a model opinion.',
      'Humans stay in charge by construction: the scout only ever writes cards. It cannot touch the vertical map, and moving a card (planned, in progress, shipped, declined) is maintainer-only, enforced in the database, with one-tap status controls on the board for the maintainer.',
      'The registry also encodes where the scout will grow: 22 crawl targets (pages with high signal but no feed, like the DoD daily contract announcements) light up the moment a Firecrawl key lands, and 41 niche voices on X - from Dylan Patel to fusion and uranium specialists - are registered for when X API access exists. Gated honestly: registered intent, not pretended coverage.',
      'Fully harness-owned from day one: a new /scout-intel skill chain owns the worker, 17 new tests pin the honest behaviours (two-letter tickers never match bare text, one outlet drumbeating is never signal), and the nightly job reports failures loudly instead of green-ticking.',
    ],
  },
  {
    version: '0.38.0',
    date: '2026-07-17',
    title: 'Weekly, monthly, quarterly and yearly reviews - see how you are actually doing',
    highlights: [
      'Lyra can now deliver a weekly, monthly, quarterly or yearly review, so you can finally see how you are doing over a period that matters instead of only what fired in the last hour.',
      'A good period looks good before you read a word: your return rides in the header with a cash badge that escalates as you climb - one at +5%, two at +10%, three at +15% and above.',
      'A bad period is never dressed up. A losing review carries a red marker, not a softer emoji - if the cash badge could show up on a loss it would tell you nothing.',
      'Reviews are written to land a finding, not dump statistics: what changed, what it cost or earned you, and the one habit behind it.',
      'Delivery only for now. Nothing generates these on a schedule yet, and the return figure is not yet computed from your real positions - the jobs that do both are next.',
    ],
  },
  {
    version: '0.37.0',
    date: '2026-07-17',
    title: 'Telegram alerts are readable now: colour-coded relevance, real formatting, no more wall of text',
    highlights: [
      'Telegram alerts have been rebuilt. Slack had a purpose-built layout while Telegram fell back to a plain-text format meant for the wire - one dense paragraph, no formatting, capped at 399 characters on a channel that allows 4096. Alerts now arrive with a proper header, bold title, scannable body and a tappable link.',
      'Your relevance score is now a colour-coded meter you read at a glance - green for a strong 70+, amber in the middle, red below 40 - instead of a number buried in a sentence.',
      'The engine\'s reason for firing now sits in its own quoted block, so the provenance reads as a citation and never gets lost in the narrative.',
      'Your chosen alert personality (Analyst, Coach, Minimal or Narrator) now applies to Telegram too. Previously only Slack honoured it.',
      'An alert can no longer be lost to a formatting bug: if the rich layout ever fails to parse, the message is re-sent as plain text rather than silently dropped.',
    ],
  },
  {
    version: '0.36.0',
    date: '2026-07-17',
    title: 'The Ideas board can actually save your ideas now - four migrations had never reached production',
    highlights: [
      'Your ideas and upvotes now save. The Ideas board shipped without its two database tables ever being created in production, so every suggestion and vote was writing into nothing. The tables are in place now - along with three other database changes that had silently never been applied: your goal target can persist, activation tracking records again, and the digital twin has its consent switch.',
      'Fixed the ordering bug that caused it. A migration that adds columns to the calendar table was numbered to run AFTER the one that indexes those same columns, so setting up a database from scratch failed outright with "column ticker does not exist". The reconcile now runs first, and a fresh clone can build the whole schema in one pass.',
      'The nightly jobs are now writing to a database that matches them: the calendar, fundamentals and event-risk tables all have the columns their jobs have been trying to fill.',
    ],
  },
  {
    version: '0.35.0',
    date: '2026-07-17',
    title: 'The chain explorer: every vertical traced end to end, and the chains are finally deep',
    highlights: [
      'The end-to-end value chain is now an interactive explorer on Small Caps: chip tabs switch between all ten verticals - AGI Infrastructure, Quantum, Robotics, Space, Power Grid, Nuclear, Semiconductors, Critical Minerals, Defence and Cybersecurity - and selecting a shortlist name snaps the explorer to its vertical with the name highlighted where it sits in the chain.',
      'The chains got deep. Nine verticals had only 2-4 supply-chain tiers mapped while AGI had 16 - every vertical now carries 8-12 nodes spanning end demand down to raw materials, with 120 companies and 95 capital events across the map (was 45 companies and 48 events). Every new row passed an adversarial fact-check before landing, and the ones that did not were struck.',
      'Backing integrity held: every small cap on the map now connects to at least one DISCLOSED backing source - 16 real capital events landed (DOE loans, US Navy contracts, NASA agreements, an Nvidia partnership), 5 names were honestly resized out of small-cap (Argan and MYR Group outgrew it), and 6 names with no defensible backing were removed rather than propped up.',
      'The chain is no longer hidden below the fold: a "Trace the full chain" action on every selected name jumps straight to the explorer, the shortlist cards are one-line compact instead of four stacked rows, and a verticals strip in the page header shows all ten focus areas with their tracked small-cap counts.',
      'AGI Infrastructure now wears a robot instead of a brain (a brain read as biotech), and Robotics & Automation takes the mechanical arm - every vertical has a distinct mark.',
    ],
  },
  {
    version: '0.34.0',
    date: '2026-07-17',
    title: 'The nightly jobs were failing silently every night - your digest, calendar and fundamentals are fixed',
    highlights: [
      'Your daily digest is fixed. It had been crashing every single night before a single message went out: a market-wide digest was being filed against a made-up ticker called "MARKET", and the database rejected it outright. A digest is not about one stock, so it is now filed with no ticker - which is the honest answer and what the schema always allowed.',
      'The market calendar reads live events again. The events table had been defined twice with two different shapes, and the version the app actually reads never took effect - so every calendar lookup asked for a date column that was not there. The two definitions are now reconciled into one.',
      'Company fundamentals are being saved again. Every nightly snapshot, for every ticker, was silently rejected because the table was missing thirteen of the columns the job writes - including cash, debt and the P/E ratios. Nothing had been stored.',
      'Event risk actually works now. The nightly job was reading a table that has never existed, so every ticker came back "inactive" and no event risk was ever raised. It also kept the OLDEST reading per stock instead of the newest.',
      'Added a build gate that blocks this whole class of bug: it fails the build if two migrations share a version number or define the same table with different shapes - the exact traps that let all of the above fail quietly for so long.',
    ],
  },
  {
    version: '0.33.0',
    date: '2026-07-17',
    title: 'Product updates and Ideas get the premium glass treatment',
    highlights: [
      'The Product Updates page has been rebuilt around a single glass header with a sliding Product Updates / Ideas switch, replacing the stack of boxed panels that repeated the same sentence three times over.',
      'Releases now read as a proper timeline: one continuous rail threading every version, with the build you are on marked by a lit amber node.',
      'The Ideas board is cleaner and easier to scan - a functional toolbar showing how many ideas there are and how they are sorted, roomier upvote controls, and a friendlier empty state.',
      'Glass surfaces now degrade gracefully: if your browser cannot blur, or you have asked your device to reduce transparency, every panel falls back to a solid, readable fill.',
    ],
  },
  {
    version: '0.32.0',
    date: '2026-07-17',
    title: 'Settings split into three focused pages instead of one long scroll',
    highlights: [
      'Account settings are now three separate pages with a tab switcher at the top: Account (your profile, a device PIN lock, and your data), AI Settings (the model that powers Lyra), and Notifications (push, Telegram, WhatsApp, Slack). No more scrolling one long page to find the setting you want.',
      'Every link that used to jump to a section of the old page - the account menu, the AI prompts in chat, the setup checklist and product tour - now opens the right page directly.',
    ],
  },
  {
    version: '0.31.0',
    date: '2026-07-17',
    title: 'Lyra listens to your onboarding: the copilot now tailors itself to how YOU answered',
    highlights: [
      'The AI copilot now reads your full onboarding profile. If you told us you are new and want step-by-step explanations, a few-months horizon, or just the signal with no lecture, Lyra tailors its depth, tone and framing to exactly that - instead of treating every beginner the same.',
      'Lyra sizes ideas against your own money goal now - suggestions relate to the target you actually set, not a generic milestone.',
      'Hardened the profile read so a not-yet-applied database change can never blank out your whole personalisation. At worst one optional field falls back to a sensible default; the rest of your profile always reaches the AI.',
      'Added a deterministic build gate that proves every onboarding answer is saved, read back, and reaches the AI - so this personalisation can never silently drift if the code changes later.',
    ],
  },
  {
    version: '0.30.0',
    date: '2026-07-17',
    title: 'The floating button gently nudges Feedback into view now and then',
    highlights: [
      'The floating Ask Lyra / Feedback control now brings Feedback forward for a couple of seconds every so often, then slides back - a quiet reminder that the same button is where you tell us what to fix or build, so you never have to go looking for it.',
      'It never interrupts: the nudge is skipped while a panel is open, and it stays completely still if your device is set to reduce motion.',
    ],
  },
  {
    version: '0.29.0',
    date: '2026-07-17',
    title: 'Product Updates gets an Ideas board: suggest features and upvote what we build next',
    highlights: [
      'The Product Updates page now has a two-tone switch - Product Updates (the release history) and a new Ideas board where you can suggest a feature and upvote the ones you want most, so what gets built next is driven by what you vote for.',
      'Each idea shows its date, title and description with a one-tap upvote and a live vote count, ranked most-wanted first. One vote per person per idea - tap again to take your vote back.',
      'The in-app feedback box now links straight to the Ideas board when you pick "Idea", so a suggestion can become something others rally behind.',
      'Fixed a confusing double changelog: the product-updates timeline is now generated from one source of truth (the version log) and is searchable, instead of a version list sitting next to a separate feed that had drifted out of date.',
    ],
  },
  {
    version: '0.28.0',
    date: '2026-07-17',
    title: 'Clearer notifications: an honest per-device push badge, real Telegram and WhatsApp logos, and sharper alert copy',
    highlights: [
      'The push badge now reflects THIS device, not just your account. Before, it showed a green "on" whenever any device you own was subscribed - so an iPhone that had never granted permission still looked done. It is now green only when this device has actually enabled push, and shows an amber "Not on this device" otherwise, so the one tap that matters is obvious.',
      'Telegram and WhatsApp now show their real brand logos beside their fields and save buttons, matching Slack - no more generic placeholder icons. Nothing ships unbranded.',
      'Sharper alert copy: the test push and the service-worker fallback no longer repeat "Lyra" in the headline (your phone already shows the app name), so the title reads as one clean line instead of wrapping onto two. The test message now confirms push is live and previews how a real alert will land.',
    ],
  },
  {
    version: '0.27.0',
    date: '2026-07-17',
    title: 'Make it yours: a customisable bottom bar, a colourful Explore, cleaner type - and an honest goal bar',
    highlights: [
      'Your bottom bar is now yours to arrange. Open Explore, tap Customise, and drag your daily surfaces into any order, remove the ones you never touch, and add any surface from the app - placed wherever you want. Your layout is saved on your device.',
      'The Explore drawer now reads in Lyra colour, grouped by the job it does: amber for Your desk, cyan for Discover, purple for Research, green for Practice, pink for Learn - so the eye finds things by colour instead of scanning a grey wall.',
      'Cleaner bar by default: Portfolio and Watchlist are spelled out in full, and Paper Bot now rides the bar (Trade Plan moves one tap into Explore). The bar also sits a little higher so it clears the phone home indicator.',
      'Fixed a confusing goal reading: the progress bar now runs straight from zero to your target, so "X of Y", the percentage, and the amount to go all agree - no more 6% sitting next to "$26.6k of $50k".',
      'A more premium, consistent typeface across the app (the native Apple system font) with crisper rendering - and the Settings form no longer bounces between monospace and sans: placeholders and fields now read in one clean face.',
    ],
  },
  {
    version: '0.26.0',
    date: '2026-07-17',
    title: 'Error monitoring verified live in production - and the setup scaffolding is removed',
    highlights: [
      'Confirmed Sentry is armed in production: the DSN is inlined in the deployed client bundle, so a real crash - a browser error, a server exception, or a 500 in an API route - is now captured with a stack trace instead of vanishing. It stays optional and privacy-safe: with no DSN set (demo mode, self-hosting, forks of this repo) it sends nothing at all.',
      'Removed the two temporary example routes the Sentry setup wizard created - a public page and API that deliberately throw an error. They existed only to prove reporting worked; with that confirmed, the app no longer exposes any deliberate crash endpoint.',
      'No behaviour change for users: the monitoring runs silently in the background and only ever reports genuine errors, never usage or content.',
    ],
  },
  {
    version: '0.25.0',
    date: '2026-07-17',
    title: 'Error monitoring: Sentry now catches crashes and server errors in production - optional and off by default',
    highlights: [
      'Wired Sentry across all three Next.js runtimes (browser, server, edge) so a real crash - a frontend error, an unhandled server exception, a 500 in an API route - is captured with a stack trace instead of vanishing. Until now the only production signal was /api/health plus the scanner paging on failure.',
      'Optional and privacy-safe by design: it reports only when a Sentry DSN is set in the host environment, so demo mode, self-hosting, and forks of this repo send nothing at all. No session replay, no user data - just errors and a 10% trace sample in production.',
      'The root error boundary now reports the crashes that reach it, and source maps upload on production builds so a real-user stack trace points at real code instead of minified noise.',
    ],
  },
  {
    version: '0.24.0',
    date: '2026-07-17',
    title: 'Your Activity: a private, on-device dashboard of how you use Lyra - time, sessions, AI questions, and a surface heatmap',
    highlights: [
      'A new Your Activity page (in Explore under Learn & set up) shows how you actually use Lyra: total time on the app, number of sessions, active days, average session length, and how many AI questions you have asked.',
      'A surface heatmap shows which parts of Lyra you live in - every surface you visit, tinted brighter the more you use it, with a ranked most-used breakdown (visits, share, and time on each). Click any tile to jump straight there.',
      'Private by design: it is computed entirely from your own browser storage and never leaves your device - no account needed, no server, nothing tracked about you anywhere. A one-click "Clear my activity" wipes it whenever you want.',
      'It also quietly powers the owner-side Vercel analytics that was already wired, so the same navigation now feeds both your personal page and the aggregate dashboard - without double-counting or sending any content.',
    ],
  },
  {
    version: '0.23.0',
    date: '2026-07-17',
    title: 'Global rate limits: the abuse guard now counts across every serverless instance, not per-instance',
    highlights: [
      'The three unauthenticated endpoints (per-symbol signal refresh, ticker lookup, and in-app feedback) now enforce their rate limits across every serverless instance at once, using the shared Upstash counter instead of a separate in-memory bucket per instance. Before, a burst spread across instances could get several times the intended allowance; it is now one exact global budget per IP.',
      'Fail-safe by design: with Upstash unconfigured (demo mode, self-host) or briefly unreachable, the limiter degrades to the in-process guard rather than failing open - it always does something, and the app still runs with zero keys.',
      'Proven, not assumed: a new test clears the in-memory buckets between calls to simulate a request landing on a fresh, cold instance and shows the shared counter still blocks an over-budget request - the exact gap this closes.',
    ],
  },
  {
    version: '0.22.0',
    date: '2026-07-17',
    title: 'One clean rail and an Explore drawer: the daily-drivers up front, the deep research one tap away',
    highlights: [
      'The navigation no longer shows all 34 surfaces at once. The rail (and the mobile bar) now carry just the daily-drivers - Command, Portfolio, Watchlist, Plan - so the goal cockpit owns the screen instead of competing with a wall of icons.',
      'Everything else lives in a new Explore drawer, grouped by the job it does: Your Desk, Discover, Research, Practice, and Learn. One tap opens it, one tap gets you anywhere, and it closes on Escape, a tap outside, or when you navigate.',
      'Nothing was removed - all 34 surfaces are still there, just organised by what you are trying to DO rather than listed flat. The Explore control highlights when you are inside one of its surfaces, so you always know where you are.',
      'On mobile this replaces a 34-item horizontal scroll with five evenly-spaced tabs, so the thing you need is no longer three swipes away.',
    ],
  },
  {
    version: '0.21.0',
    date: '2026-07-17',
    title: 'True orientation: both sides of every name you hold and watch, and a goal target that is your own number',
    highlights: [
      'The cockpit now shows a two-sided orientation across the names you hold AND the names you watch: what is good (opportunities) and what is bad (risks), side by side, from the live news flow. Not just downside and not just holdings - a balanced read of both sides at once, weighted toward the names where your money is on the line.',
      'Bad news on a name you own no longer hides in a feed you have to go find. If something breaks on a holding, it surfaces as a risk right in the cockpit; if something good lands, it shows as an opportunity - each one links straight to the ticker.',
      'Your goal is now YOUR number. Set a target like $50,000 and the whole cockpit re-anchors to it - the progress bar, the amount to go, and the pace all track the goal you actually stated. Leave it unset and it still climbs a sensible milestone ladder so there is always a next number to reach.',
      'The target is saved to your profile (owner-scoped, private to you) and editable inline from the cockpit in one click - no digging through settings.',
      'As always: every read is deterministic and two-sided by design - it shows the good and the bad, and never turns either into a buy or sell instruction.',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-07-17',
    title: 'The goal cockpit: your target, your progress, and the exact moves your money needs - exits first',
    highlights: [
      'The home screen now LEADS with your goal, not a wall of data. A cockpit at the very top shows where you stand - your account value, your return on invested capital, and a progress bar climbing to your next milestone (or your own target) - so you never have to hunt for whether you are winning.',
      'Under it sits "what needs you now": a short, ranked list of the actual moves your book needs, built deterministically from the engine reads on YOUR positions. Protecting capital comes first - a broken thesis or a position through its loss line is the loudest row, ahead of any new idea.',
      'Downside and exits are first-class. It flags when a setup that put a name in your book has invalidated (the get-out signal), when a position is past the loss line for your risk profile, when risk is rising, when a winner is extended enough to bank some, and when one name has grown too large for the book.',
      'It is personalised: your risk comfort widens or tightens the loss and profit lines, your cash and holdings drive the standing, and idle cash and behind-pace nudges only surface when nothing more urgent is competing.',
      'Honest by construction: every read is deterministic math on your own positions and goal - risk framing, never a licensed buy/sell call. The app prompts the decision and points you to size it in the Trade Plan; the trade is yours, placed at your broker.',
    ],
  },
  {
    version: '0.19.1',
    date: '2026-07-17',
    title: 'Landing polish: the alert-channel pills get their own line',
    highlights: [
      'On the landing page, the Telegram / Slack / WhatsApp pills now sit on their own line below the "Alerts, where you live" label instead of wrapping unevenly beside it on narrow screens.',
    ],
  },
  {
    version: '0.19.0',
    date: '2026-07-17',
    title: 'Quantified upside and honest freshness: the high-upside shortlist finally puts a number on the payoff, the live scanner covers the small caps, and stale boards say so',
    highlights: [
      'The emergence shortlist now QUANTIFIES upside instead of only ranking it: each name carries a deterministic bear/base/bull re-rate estimate, a base-case upside %, and an asymmetry ratio (upside vs downside), plus a tier - Asymmetric, Balanced, Limited, or Lottery. It is a model estimate of payoff shape from disclosed factors, clearly labelled as such - never a price target or a promised return.',
      'The live scanner now covers the 14 small-cap emergence names it never touched before. Previously the scan universe was 100% large-cap, so every high-upside name fell back to a neutral momentum reading and the "market is turning" signal was structurally dead for the exact list the app exists to surface - that leg is now wired to real momentum.',
      'Honest catalyst freshness: the Catalyst Radar and the countdown are hand-curated editorial lists, and when every event passes they used to silently render nothing - reading as "all quiet" when it meant "nobody refreshed the list". They now show the curation date and an explicit "refresh due" state so an empty board can never masquerade as a calm calendar.',
      'The position-size calculator now links straight to the Trade Plan, so working out a size flows into sizing it against a real name, your own cash, and the round-trip cost and expectancy - the decision-moment surface is one click from the math.',
      'Every new upside and conviction number ships with the same discipline: it is a deterministic estimate of shape, it says when no measured track record stands behind it, and it never reads as a proven return.',
    ],
  },
  {
    version: '0.18.0',
    date: '2026-07-17',
    title: 'Portfolio-aware, honest about capital: no more fantasy $100k account, real small-account costs, and win rates that never masquerade as a track record',
    highlights: [
      'The paper account no longer starts from a fantasy $100,000 balance: a new account begins from the cash you actually have on file (or a realistic small-account example when none is set), so you practise the position sizes you can really take instead of ones that only work on paper.',
      'Simulated fills now charge a realistic fixed commission floor instead of a flat 0.05% - the cost that most distorts a small account, where a $3 minimum is a real slice of a $500 trade but a rounding error on a $30k one. Your paper track record is now honest about the drag a beginner actually pays.',
      'The Trade Plan is now portfolio-aware, not just single-position: it reads your open positions and flags when adding a name over-deploys the whole account (little dry powder left) or piles too much into one correlated theme - the concentration risks that sink small accounts even when each trade looks fine alone.',
      'Onboarding honesty fix: the strategy picker used to show win rates like "68% win" with no label, reading as a measured fact on the very first screen. Those figures are now clearly marked illustrative - what the strategy aims at, not proof of what it returns.',
      'The signal-intelligence board now says plainly that its conviction score has no measured track record yet: high agreement between signals today is not a proven hit rate. No number in the app should feel more certain than the evidence behind it.',
    ],
  },
  {
    version: '0.17.0',
    date: '2026-07-17',
    title: 'Honest edge and a real trade plan: sizing to your own capital, netting costs against the signal, and never dressing up a guess as history',
    highlights: [
      'A new Trade Plan surface (/plan) sizes one name against YOUR real capital, not a fantasy account: it floors to whole shares, tells a small account when an entry price is simply out of reach, and shows the worst-case dollar loss if the stop is hit - the position-size math finally lives at the moment of decision instead of a separate calculator page.',
      'The plan models the costs that actually hurt a small account: a fixed commission floor (which is a big slice of a $300 trade), the AUD-to-USD FX spread you pay twice on a US ticker, and wider slippage on thin small-caps - then shows the break-even move you need just to cover the round trip.',
      'Every win rate now travels with its expectancy, so a high hit rate on tiny wins and large losses (the classic mean-reversion trap) can no longer read as edge - and the plan flags when friction wipes out an otherwise-positive edge for your account size.',
      'Honesty fix: illustrative outcome numbers are now labelled "illustrative, no measured history yet" wherever they appear, the live signal drawer needs a real 20-sample floor (not 5) before it shows a measured win rate and caveats small samples, and a break-even move no longer counts as a win.',
      'The AI research assistant can now build the same cost-aware, expectancy-aware plan on request (read_trade_plan) - it presents the risk flags honestly and, as always, never turns them into a recommendation to trade.',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-07-16',
    title: 'The calendar tells the truth and every dialog behaves: live events, a real clock, and one shared focus system',
    highlights: [
      'The calendar was frozen in time - a hardcoded "today" of June 3rd meant every countdown in the app was weeks wrong. It now runs on a real clock, reads the nightly-synced event tables when configured (bounded to the 30-day board window so earnings season cannot truncate it), and honestly labels live vs sample data.',
      'IPO listings now appear on the live calendar too: they live in their own table, so the live board synthesizes their entries with importance scaled by valuation - previously flipping to live mode silently deleted the entire IPO event class the sample set had.',
      'The sample calendar can never age out: demo events re-anchor to today on every request (not once at server start), so a self-hosted demo deploy that has been up for a month shows the same fresh month of events as a cold start - pinned by a test.',
      'Every dialog now behaves like a dialog: focus moves in on open and returns on close (screen readers were being stranded behind the backdrop), Tab is contained with hidden elements filtered out, overlapping overlays negotiate via a shared dialog stack instead of fighting over keystrokes, and the feedback sheet joins the same system with Esc-to-close.',
      'Esc in a deep investigation now steps back one level - matching the on-screen Back button - instead of throwing away the whole trail, and the event drawer shares the exact clock and event set as the board that opened it, so the two can never disagree near midnight.',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-07-16',
    title: 'On the move: fresh IPO data, live-refreshing drawers, and a console that respects your thumb',
    highlights: [
      'The IPO radar now serves the live calendar: the nightly Finnhub sync (which was filling a table nothing read) feeds the page hourly, a past-dated "upcoming" IPO can no longer pretend it has not happened, the date sort finally puts the soonest listing on top, and the page says honestly whether you are looking at the live calendar or the sample set.',
      'The signal drawer refreshes itself the moment you open it - current engine numbers for that one symbol instead of the page-load snapshot, a "how setups like this resolved" line from measured outcomes, an optional AI read grounded on exactly the figures shown (server-side, fabrication-guarded), and a shareable link: /radar?signal=NVDA opens straight to the setup.',
      'Drawers behave like drawers now: the page behind stops scrolling on every overlay (the #1 mobile scroll leak), Esc closes the chat sheet, focus moves in and returns on close with proper dialog semantics, content clears the iPhone home indicator, and the IPO drawer rides the same shared shell as everything else.',
      'Mobile screens got their space back: the watchlist no longer renders your entire list twice, the radar caps its card stack with "show more" paging, the nine catalyst cards fold to headline + heat until tapped, the intelligence filter wall collapses behind a Filters toggle, and the home "strongest setups" table - the last one without mobile cards - got them.',
      'Honesty and thumbs: pulsing "Live" badges on last-scan data now say "as of last scan", sample data is labeled as sample, and the primary controls (IPO filters, panel pickers, chart toggles, refresh) meet the 44px touch floor on small screens.',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-07-16',
    title: 'Signature onboarding: a branded terminal splash, gate micro-delight, a private commissioning card, and a live nervous-system map',
    highlights: [
      'npm run dev now opens with a branded first-run splash - the Lyra wordmark in the tri-gradient with "by Vivacity.ai" - printed right before the localhost URL. Truecolor, gracefully plain on a non-TTY, and it can never block the dev server.',
      'The Setup Companion celebrates progress: the moment a stage clears, its card gets a one-shot tri-gradient shine sweep, plus an opt-in soft tone. Transitions are baseline-seeded so opening the page mid-setup never bursts, and prefers-reduced-motion is fully respected.',
      'A private commissioning card: once a fresh clone reaches a healthy deploy, npm run commission writes a branded receipt (commission/card.svg + COMMISSIONED.md) into the clone - a local keepsake, read from /api/health, gitignored and never shared anywhere.',
      'A new nervous-system map at /harness-map.html renders SKILL-CHAIN.md + HARNESS.md as one interactive page - click a chain to focus the sections it owns, filter by path, and see every deterministic gate. Generated on the content pipeline so it can never drift from the rails it describes.',
      'The README now spells out how to share Lyra by audience - a live link for humans, a fork for builders, AGENT-ONBOARDING.md for agents - and the onboarding ledger records every new asset.',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-07-16',
    title: 'Your digital trading twin: Lyra now learns your interests, habits, and risk posture - and reflects them back',
    highlights: [
      'New "Your Twin" surface (/twin): a private, research-only mirror of how you actually trade - your top themes, the signal kinds you trust, your stage lean, and the gap between the risk posture you stated at onboarding and the one your paper trades reveal. A mirror, never advice - the deterministic engine still owns every signal.',
      'A real deterministic preference model computes your affinities and revealed-risk stats (average position size vs your stated cap, sizing up after a losing close, late-stage chase, theme concentration) from data Lyra already holds - no LLM, fully unit-tested.',
      'Opt-in, inspectable, portable, deletable: a consent switch gates all behavioural capture (default off), with server-side inspect (GET /api/account), export (a versioned JSON snapshot of your profile + twin), and true delete (wipes every server row) - and the old "nothing is uploaded" copy is now honest.',
      'The copilot can cite your twin (a read-only read_trading_twin tool) and remembers you across sessions (opt-in conversational memory), and the command centre now surfaces equally-scored names you care about first - with an enforced anti-bubble duty so risk is never hidden.',
      'Row-level-security hardening: tightened the read policies on the paper-trading tables so your simulated trades are strictly owner-only, plus a migration-scanning test that fails the build if a future change ever re-opens them.',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-07-16',
    title: 'The agent harness: every section of the codebase now has an owning maintenance chain, enforced in CI',
    highlights: [
      'New HARNESS.md maps the full enforcement system - deterministic gates (scripts/check-*.mjs), git hooks, CI jobs, the test harness, runtime guards, and scheduled loops - so any agent (or human) can see exactly what keeps this repo honest and how to work inside it.',
      'New SKILL-CHAIN.md registry assigns every code section an owning skill chain via a machine-checked coverage map: 254 sections, 12 chains, zero orphans - an unowned section now fails CI (npm run check:chains).',
      'Seven new skill chains join setup, production-keeper, feedback-loop, onboarding-parity, and logs-to-genui: /signal-quality (evidence-backed scoring), /ai-quality (evals + guardrails + system card), /notification-health (delivery + template completeness), /onboarding-funnel (activation drop-offs + the demo promise), /data-integrity (migrations, RLS, demo parity), /security-sweep (secrets, fail-closed authz, abuse limits), and /ux-surface (one surface to premium per loop).',
      'Every chain carries the same contract: staged gates, execution over advice, and explainability - each run ends with shipped, verified work and a plain-language report backed by engine-owned numbers.',
      'The harness is wired into onboarding: AGENT-ONBOARDING.md, the ONBOARDING.md ledger, CLAUDE.md, and the /setup wrap-up all route new agents through HARNESS.md and the coverage map.',
    ],
  },
  {
    version: '0.11.2',
    date: '2026-07-16',
    title: 'Onboarding stays honest: a parity gate + skill chain across the human, in-app, and agent surfaces',
    highlights: [
      'The three onboarding surfaces - the human walkthroughs, the in-app Setup Companion, and the agent front door - now have a deterministic parity gate (npm run check:onboarding) that runs in CI, so they cannot silently drift from the stack, costs, routes, or walkthroughs the code actually ships.',
      'A new /onboarding-parity skill chain (with per-surface skills for human, companion, and agent docs) restores parity in one pass and proves it with the gate.',
      'The in-app Setup Companion copy is now generated from its source at build time, so the served page can never fall behind the authored one.',
    ],
  },
  {
    version: '0.11.1',
    date: '2026-07-16',
    title: 'The loop closes: measured outcomes, real digests, follow-up coaching + a console that cannot silently fail',
    highlights: [
      'Every setup now gets its outcome measured: a nightly job computes forward returns (1d/5d/20d/60d, max upside, max drawdown) from the same stored candles that scored the signal, and once the 5-day horizon resolves you get a follow-up alert - "your NVDA setup from Jul 9 is +8.2% after 5 days, cohort median +3.2%" - so the scanner finally answers whether its signals work.',
      'The daily digest is real: an end-of-session summary (setups found, top scores, alerts sent) lands on your channels every trading night, with a weekly report on Fridays. Quiet-hours alerts are held and released when your window ends - never dropped - and a failed delivery retries once instead of dying silently.',
      'Published scores can no longer repaint: the in-progress hourly bar is discarded before scoring, so every number an alert cites stays reproducible forever. The three dormant data workers (events + IPOs, fundamentals, intelligence) now actually run nightly, and provider hiccups retry with backoff.',
      'Console you can trust: the side rail scrolls with visible groups (nothing clipped at 1080p any more), branded error and 404 pages replace the white crash screen, every tab carries its own title, the What\'s New dot only lights for releases you have not seen, and "Explore the demo first" walks a visitor through the real console read-only before sign-up - while demo-entered holdings and watchlists now survive into a new account.',
      'Locked down and self-watching: the research tables are read-only under RLS (they were writable with the public anon key), version bumps are enforced in CI so nothing ships undescribed, a failed scan pages Telegram/Slack and the cron keeps itself alive past GitHub\'s 60-day auto-disable, and /api/health reports when the scanner last ran.',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-07-16',
    title: 'Security hardening: SSRF fences, tenant isolation, founder-gating',
    highlights: [
      'Web Push endpoints are now fenced to the real push services (Chrome, Apple, Firefox, Windows) over https, at both save and send time - a subscription can no longer point the server at an internal address, and failed sends no longer echo the remote response.',
      'The founder-only insights view is now authorized, not just authenticated: it reads cross-tenant question text, so it is gated to a FOUNDER_EMAILS allowlist and fails closed when unset.',
      'The paper-account view returns an empty account for an unauthenticated request on a live deploy, instead of ever falling back to the shared in-memory store - no cross-tenant positions can leak.',
      'The post-login redirect only accepts same-origin paths, closing an open-redirect that could bounce a visitor off the trusted domain.',
      'All four hardened by an adversarial security audit; the SSRF allowlist and the redirect guard are pinned by tests.',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-07-16',
    title: 'AI you can measure: quality evals, a learned recovery model, hybrid retrieval, AI-ops',
    highlights: [
      'Lyra now proves its AI is good, not just safe: a labelled question-and-answer test set scores every answer for whether its numbers are grounded, its citations are real, it covers the facts it should, and it refuses questions it should not answer - so a fabricated or advice-y answer turns the build red.',
      'A learned, calibrated recovery-probability model sits alongside the deterministic score: trained and backtested out-of-sample (it beats a naive baseline), it attaches a research-only probability band to a setup. It informs, it never decides - the engine still owns the action, and the model card is public.',
      'Smarter in-app doc answers: retrieval now blends exact keywords with a fuzzy character-level match (so "deploying" finds the deploy doc), measured with real retrieval metrics and gated so it can never get worse - all still offline, no embeddings, no new services.',
      'Stronger safety: new guards block secrets (API keys, tokens, connection strings) and flag personal data in any answer, plus an adversarial red-team test set (jailbreaks, injection, exfiltration) - and a structural check that no AI screen can reach the model without passing the guards.',
      'New AI Ops dashboard (/ai-ops) surfaces how the AI layer is behaving: throughput, latency, refusal and guard-block rates, circuit-breaker state, and the model card - plus a public AI System Card (/api/ai/system-card) that reads live from the code.',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-07-16',
    title: 'Review hardening: honest copy, fresh fill prices, smarter doc answers',
    highlights: [
      'The BYOK copy now tells the exact truth: your AI key is held by your browser and sent only with your own requests to your own deployment - never stored server-side.',
      'Logged trade fills are priced fresh: the trade-confirm path bypasses the 60s quote cache, so a recorded fill price can never come from a cached preview.',
      'In-app doc answers got sharper and safer: natural questions ("what is lyra?", "how much does this cost?", "how do I set this up?") now find the right doc, while market and advice questions can never pull doc examples into the prompt.',
      '/api/health now verifies the Redis cache with a real PING (reports upstash-unreachable when it is down), and cache writes are awaited so serverless deploys cannot silently drop them.',
      'Goal-card accessibility: only the visible face is read by screen readers, keyboard focus survives the Setup Companion refresh, all animation respects reduced-motion - and cost badges no longer wrap broken on phones.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-07-16',
    title: 'Continuous intelligence + a robust agent harness',
    highlights: [
      'New Signal Intelligence board on Small Caps: it scans every independent signal across the universe - government backing, big-tech capital, smart money, supply-chain bottlenecks and turning momentum - and ranks the names where several converge at once. Convergence of independent signals is the highest-conviction "look here," and it is scored deterministically, never guessed.',
      'The government-backing signal is now LIVE, not static: Lyra pulls real US federal contract awards for the small-cap watchlist from USAspending.gov (a free, keyless source), caches them, and shows exactly whether each award is live or an illustrative sample - so official spend, an early pre-consensus read, is continuously fetched rather than hand-curated.',
      'The AI co-pilot can now reason over that convergence intelligence as a first-class, read-only tool - it finds and cites the most effective data points instead of narrating a single fixed snapshot, while still only explaining what the engine computed.',
      'A hardened safety layer around every AI answer: one unified guardrails verdict (blocks trade advice, prompt-injection echoes, and ungrounded numbers; flags predictive overclaims) is enforced at the answer boundary, backed by an eval-gate - a safety test set that turns the build red if any guard is ever weakened.',
      'Under the hood, the AI gateway is more resilient: transient provider failures are retried with backoff, and a concurrency limiter plus spend budget stop a burst of requests from running away. Plus a new roadmap pitch - your private Digital Trading Twin (docs/strategy + README).',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-07-16',
    title: 'Setup Companion, agent onboarding, Redis cache + a knowledge layer',
    highlights: [
      'Running /setup now opens a live Setup Companion in your browser - a premium spec of the whole stack (real logos, honest cost badges) plus a stage-by-stage progress board your agent updates as it builds. Also served in-app at /setup-companion.html.',
      'Six animated "ultimate goal" cards - punchy on the front, tap to flip for the detail - on the companion AND the landing page, alongside the full stack grid with per-technology costs.',
      'Agents get a front door: AGENT-ONBOARDING.md (mission, setup contract, security ground rules, verification gates) plus ONBOARDING.md, the ledger of every onboarding asset and experience.',
      'The AI co-pilot now answers questions about Lyra itself with citable sources: a deterministic knowledge layer compiles the reference docs at build time and retrieves the relevant sections into chat - no embeddings, no new services, works in demo mode.',
      'Optional Redis caching (Upstash REST) for market quotes and hot reads - a pure optimisation with an in-process fallback, so nothing new is ever required. /api/health reports the active cache backend.',
      'Deploying is agent-friendly: walkthrough 04 and /setup include the full Vercel CLI path (login, link, env, deploy) so an agent can put Lyra online end to end.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-07-16',
    title: 'Replicate it: walkthroughs, /setup agent, Docker/Coolify, full costs',
    highlights: [
      'Share the repo link and anyone can run their own Lyra: six adversarially fact-checked walkthroughs (docs/walkthroughs/) cover what it is, running it in 5 minutes, going live on your own Supabase, deploying, reading the score, and getting alerts on your phone.',
      'Claude Code users can skip the manual path entirely: run /setup in a fresh clone and the bundled agent playbook (.claude/commands/setup.md) sets everything up end to end, with a verification gate at every stage and costs shown before anything paid.',
      'Self-hosting is now first-class: a production Dockerfile (Coolify/Docker), a public /api/health probe that reports the running version and mode, and a Coolify deploy runbook (docs/runbooks/coolify-deploy.md).',
      'COSTS.md itemises every service in the stack with prices verified on provider pages - demo is $0, a fully live always-on setup runs on free tiers, self-hosting is about US$13/mo.',
      'Setup truth fixes: supabase/migrations/ is documented as the canonical schema (with the one sql/ reconciliation script that follows it), and the README quick start now matches the real dev port.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-06-27',
    title: 'TradingView Copilot + Pine strategy export',
    highlights: [
      'Export any name as a TradingView strategy - click "Pine" on the chart toolbar to copy a backtestable Pine v5 strategy that reproduces Lyra\'s exact oversold-recovery score. Paste it into TradingView and backtest the same logic that surfaced the setup.',
      'The generated Pine is a faithful, drift-guarded mirror of the scanner engine (signal_engine.py): same RSI reset band, MACD-histogram recovery, 60-period-low distance, trend and volume rules, capped at 100.',
      'New TradingView Copilot runbook (docs/tradingview-copilot.md): drive your TradingView Desktop from Claude over the Chrome DevTools Protocol - read the live chart, switch symbol/timeframe, inject + backtest the Lyra strategy, run replay, and screenshot back into a Finding. All local, research only.',
    ],
  },
  {
    version: '0.5.1',
    date: '2026-06-20',
    title: 'Brand + UI polish, Find/Graph fixes',
    highlights: [
      'Fixed Find and Graph: push-test and system notifications were showing up as "findings" (and left the graph blank). Those are now filtered out, so Find shows real setups (or the demo set until the scanner surfaces yours) and the graph is never empty.',
      'Find and Graph moved down the navigation - they were over-promoted to the #2/#3 mobile slots; your daily surfaces (Portfolio, Trades, Watchlist) now come first.',
      'New Lyra logo - the app-icon arrow (a white up-right arrow on the gradient square) is now the in-app logo, the loading screen and the browser-tab icon, matching your home-screen and email icon.',
      'The Getting started checklist is now collapsible (and renamed from "Get started").',
      'The app version and its release date are now visible on the landing page and in the account menu, both linking to this changelog.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-06-20',
    title: 'Dogfooding gap-closers',
    highlights: [
      'Investigation Graph at /graph now builds from your live findings (demo map until the scanner surfaces setups).',
      'Findings now have promote / dismiss lifecycle controls - move a finding to Watchlist, Deep research, Paper-bot queue or Review risk, or dismiss it as noise.',
      'Your account currency is captured in onboarding (defaults AUD), so AUD and .AX trades log immediately instead of being rejected.',
      'A two-week "Has Lyra helped you trade?" rating prompt, so feedback shapes what gets built next.',
      '/findings and /graph now render your per-user data at request time, not a build-time snapshot.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-06-18',
    title: 'Currency-safe trades + the Investigation System',
    highlights: [
      'Currency-aware trade logging: a cross-currency trade is rejected with a clear message instead of silently corrupting your cash pool and average cost.',
      'The Investigation System at /findings - every surfaced setup is an Opportunity Finding you can peel back: finding -> evidence -> source record -> entity -> connected pattern, with "what it does not prove" on every piece of evidence.',
      'Investigation Graph relationship map at /graph - shared bottlenecks, themes and buyers across findings on one map.',
      'Live findings projected from your own alerts.',
      'Generated views in the drawer - the AI composes the layout, every number stays owned by the deterministic engine.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-06-18',
    title: 'Dogfooding-readiness pass',
    highlights: [
      'Notifications actually deliver now - web push / Telegram / WhatsApp, with quiet hours evaluated in your timezone.',
      'Persistent Trade Log with per-row undo at /trades.',
      'Conversational buy logging previews the live quote - shares, fill price, cash left - before you confirm.',
      'Jargon defined in context across the analytical surfaces, linked into the academy.',
      'The strategy was renamed momentum -> oversold-recovery end to end, so the words match the math.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-06-12',
    title: 'Thematic intelligence + research platform',
    highlights: [
      'World Radar - 10 secular themes, each with a first-principles supply-chain map and ranked companies.',
      'Small-cap discovery engine, Investor Radar (tracked 13F moves), and a deterministic signal-events engine.',
      'Paper trading with realistic fees + slippage, and Bot Readiness - the pre-trade risk engine that refuses unsafe orders.',
      'Independent Bollinger / RSI / MACD chart studies, plus security + messaging foundations.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-06-08',
    title: 'Initial release',
    highlights: [
      'Deterministic 0-100 oversold-recovery score from RSI, MACD, price location, trend and volume, on an hourly cadence.',
      'Command centre, Signal Radar and Live Wire.',
      'Portfolio, Watchlist and a Comparison Lab.',
      'Research surfaces, a beginner-to-advanced Learn path, and three run modes (demo / live / AI).',
    ],
  },
];

/** Current version + its release date, derived from the newest release so they can never drift. */
export const APP_VERSION = RELEASES[0].version;
export const APP_VERSION_DATE = RELEASES[0].date;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format an ISO date (yyyy-mm-dd) as "20 Jun 2026" without Date()/timezone drift. */
export function formatVersionDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
