# Changelog

All notable changes to Lyra are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.99.0] - 2026-08-01

Run a model - pick an outcome, narrow the market, and rank your tracked universe.

### Changed

- The Models page now opens with a "Run a model" panel. You pick what you want to predict, optionally narrow by market segment and the tickers you care about, and hit Run - it ranks Lyra's tracked universe on the spot. No wall of static cards before you can do anything.
- Every outcome wears its true stage, so you always know how real the answer is. The oversold-recovery score is Live and returns real deterministic numbers with the full five-driver breakdown (RSI, MACD, price location, trend, volume). Emerging-winner resemblance is Shadow-live and ranks the illustrative reference queue, loudly labelled "not trained on real winners yet".
- "Segment of the market" adapts to what you are running: it filters by sector for the oversold-recovery radar, and by winner archetype for the Emerging Winner stack.
- It refuses to fabricate. Pick a model that is only built-on-synthetic-fixtures or designed-not-built, and Run is disabled with a plain explanation of why there is nothing honest to score yet - never an invented number.

## [0.98.0] - 2026-07-31

Emerging Winners is now list-first, plain-English, and honest about what it is.

### Changed

- Every Emerging Winner is now a scannable row you tap to expand - no more one-dense-card-per-screen. Start simple (symbol, resemblance, risk, data completeness), then open it up section by section into drivers, the full 10-domain scorecard, the modelled outlook, resemblances and risks.
- The jargon is decoded. "P(2x·24m)" now reads "Doubles (2x) within 24 months"; "winner similarity" is a labelled 0-100 resemblance score; "(ref)" is explained as an illustrative reference archetype, not a real company. Every term has a tap-to-explain "?" with the exact plain-English definition one tap away.
- Provenance is loud, before the score. Each card says what it is at the very top - "Illustrative example" or "Shadow-live", and "not trained on real winners yet" - so you always know where the numbers came from before you read them.
- A new "What is this model trained on?" panel tells the truth plainly: today the engine scores against a reproducible synthetic reference set, not real historical companies; you can inspect the deterministic driver math yourself; and a real point-in-time dataset (with delisted names and SEC filings) is what would make it real. It cross-links to the model registry so Emerging Winners (the output) and Models (the explainer) are one clear home.

## [0.97.0] - 2026-07-31

The signal detail view now has the chart in it - inspect a setup without leaving the drawer.

### Changed

- Tap into a setup and the chart is right there: the signal detail drawer now embeds the full setup chart (candles with Bollinger Bands, RSI and MACD - the same studies the full-setup view opens with), so you can inspect the price action that drives the read without navigating away.
- The quick actions (Full setup chart, Open ticker) now sit at the TOP of the drawer as well as beside the embedded chart at the bottom, so a strong setup opens straight into what you want to look at first.

## [0.96.0] - 2026-07-31

AI-written answers are now labelled as AI-generated, everywhere the AI writes.

### Changed

- Every AI-written narration - the Daily Brief phrasing, the signal explainer, and the Ask Lyra chat - now carries an explicit "AI-generated" label, so it is always clear which words came from an AI model and which are the deterministic engine's own numbers. The engine still owns every number; the AI only phrases them.
- The Ask Lyra chat identifies itself as an AI copilot and marks its answers as AI-generated research, not financial advice.
- This makes the AI-transparency disclosure explicit for the EU AI Act Article 50 obligation that takes effect on 2 August 2026. The substance was already there - Lyra explains, it never advises or trades - this makes the labelling unmistakable.

## [0.95.0] - 2026-07-31

The winner label learns from the evidence: durable-emergence definition, honest domain provenance.

### Changed

- The training label migrates to its quality-winner definition (Decision B option 4): a winner is now a name that not only doubled but also survived and grew its liquidity - not just any +100% first-touch spike. The published finance research is explicit that bare "biggest move" labels reward pump-and-dumps and lottery-like names that are subsequently priced DOWN (the MAX effect, Bali/Cakici/Whitelaw JFE 2011), so the model should learn durable emergence instead. Doing this now, before real labels exist, costs nothing; doing it later would mean a relabel and retrain.
- The change is an inert seam today and proven so: the reproducible bootstrap does not use this labeler, and live outcome rows do not yet carry the survival/liquidity fields, so the shipped weights, metrics and drift fixtures are byte-identical (ROC-AUC 0.828 unchanged, drift guard still exact to 1e-8). The label tightens automatically the moment the maturation job writes those fields.
- The domain weights now carry honest evidence provenance: capital/dilution is flagged as the one weight backed by a robust, internationally-replicated anomaly (and best used as a risk gate), theme is labelled as a deliberate bet on differentiation rather than dressed as established fact, and technical is flagged as a timing signal rather than an archetype trait. Bets read as bets. Full reasoning in lyra-modelling/MODEL-SELECTION-AND-OSS-STACK.md.

## [0.94.0] - 2026-07-31

The Emerging Winner model gets honest: leak-proof validation, per-cohort scoring, a floor gate, and a truthful headline.

### Changed

- The training validation is now leak-proof: a purged and embargoed walk-forward means a name's 12-month outcome window can never bleed across the train/test boundary and flatter the score - the canonical financial-ML fix (Lopez de Prado, AFML Ch. 7). On the reproducible bootstrap this correctly changes nothing (its rows have no timeline, so there is nothing to purge); on real point-in-time ledger data it will.
- It now reports the numbers that actually decide whether to trust a pick: average precision (PR-AUC) as the primary metric instead of a flattering ROC-AUC, precision among the top picks measured per quarter with the worst quarter surfaced (not a pooled average that hides a bad regime), and an adaptive equal-mass calibration error that does not understate error at a rare base rate.
- A bad retrain can no longer ship silently: a pre-publish floor gate refuses to overwrite the deployed champion unless the new model clears a floor and does not regress against the current one - a deliberate override stays possible, but never accidental.
- The drift guard is hardened with engineered boundary fixtures (all-missing, all-floor, all-ceiling, coverage-transition corners) on top of the random ones, so the frozen model and the served model are proven identical (to 1e-8) at the edges where a future tree-based model would be most likely to diverge.
- The headline is honest: the bootstrap result is labelled a machinery proof - it draws its labels from a logistic and recovers them with a logistic - and explicitly not evidence about real winners. The model stays shadow-live until real matured outcomes and live calibration earn surfacing (founder-gated). Full research + runbook in lyra-modelling/TRAINING-PIPELINE.md and MODEL-BUILD-TRAIN-HOST.md.

## [0.93.0] - 2026-07-31

The Emerging Winner model earns its way: a full training + deployment + monitoring lifecycle.

### Changed

- The Emerging Winner classifier is now a real model lifecycle, not a static heuristic: a training-ready dataset, a trainer that learns and backtests out-of-sample, a frozen deployed model, a nightly monitor, and inference that serves it - all shadow-live, all research-not-advice, no number invented.
- The dataset is honest by design: the immutable shadow-live ledger IS the point-in-time feature store - each prediction records the exact domain state before its outcome exists - and a first-touch +100%/12-month labeler turns matured price paths into winner labels. Until real outcomes mature it trains on a reproducible reference dataset that encodes the winner hypothesis, and it upgrades itself to real ledger rows automatically.
- The trained model learns and generalises: walk-forward backtesting (out-of-sample) reports the metrics that matter for a rare winner - precision among the top picks, lift over the base rate, and calibration - not a single vanity number. The current reference training run surfaces winners at nearly 5x the base rate out-of-sample.
- It cannot silently drift: the frozen model ships drift fixtures the deployed inference must reproduce exactly (proven to 1e-8), and a nightly monitor reports the live model health and keeps every prediction behind the shadow gate until calibration and lift honestly earn surfacing (founder-gated).
- Built to swap: the estimator is a transparent, dependency-free logistic today; the deck's CatBoost/LightGBM ordinal classifier is a drop-in that keeps the exact dataset, export, deploy, monitor and inference contract. Full runbook in lyra-modelling/TRAINING-PIPELINE.md; the loop is documented in LOOPS.md (loop 13).

## [0.92.0] - 2026-07-31

The modelling stack steps into the light: intro scene, landing section, README gallery.

### Changed

- The activation primer before onboarding grew a sixth scene, "Models that earn their way": the six-model pipeline animates in, a real candidate scorecard fills its domain bars, the risk gates pass one name and block a pump, and the shadow-live promise is stated plainly - all using the engine's own demo numbers, nothing invented.
- The landing page now shows the modelling stack: six model tiles in the light brand surface, the honest shadow-live framing, and a straight path into the in-app /models catalogue - the landing never promises more than the app states.
- The README gained section 6, The Modelling Stack: the full six-model deck, the five designed event-model families, and both end-to-end architecture posters, with the same research-not-advice framing as everywhere else.
- Under the hood: the primer scene data is now test-pinned (contiguous steps, agreeing totals, the models scene cannot silently fall out) and the landing section render is pinned to all six models and the /models route.
- The copilot's knowledge layer learned the modelling stack (the new README section is in its grounded corpus, with a labelled eval case to match) - and this surfaced a real ranking bug, now fixed: the hybrid retriever rounded scores before sorting, so near-ties fell to an alphabetical tiebreak that could demote the genuinely best doc.

## [0.91.0] - 2026-07-30

A Models page: every model in Lyra, with its honest status, in one place.

### Changed

- A new Models surface (Learn & set up drawer) cataloguing the whole modelling stack: the always-on deterministic backbone, the six-model Emerging Winner Engine, and the five designed event-model families - each card stating what the model answers, how far it has actually shipped (Live / Shadow-live / Built / Designed), and exactly where its numbers come from.
- Honesty is the design: the stage chip and the provenance line render together on every card, so a reference heuristic can never pass itself off as a trained model, and models with no surface yet say "no surface yet" rather than pretending. Tests pin the registry - complete fields, resolvable links, and zero advice language.
- The Emerging Winner Engine roadmap (phases 0-6) is shown plainly, including the gate: until the point-in-time winner dataset exists, the learned models stay reference v1.

## [0.90.0] - 2026-07-29

The Emerging Winner Engine goes shadow-live: a research queue for small caps that resemble past winners.

### Changed

- A new Emerging Winners research surface: small caps scored end to end by a six-model pipeline - a 10-domain scorecard, a winner classifier, historical winner/failure analogues, an archetype classifier, a learning-to-rank queue, and a five-gate risk stack - then ranked for research. Research only: it shows a resemblance score and what is missing, never a buy call and never a price target.
- Shadow-live and honest by design: every prediction is logged to a new immutable, append-only ledger (it can never be quietly rewritten), and the surface says plainly that the engine is reference-v1 - not yet trained on a real point-in-time winner dataset - so nothing is presented as truth before it is earned.
- The risk gates do real work: a speculative pump with a tiny float, heavy dilution and thin liquidity is caught and excluded from the queue, with a modelled downside shown honestly rather than smoothed away. A domain with no data is marked "not yet assessed", never counted as a weak trait.
- The sixth model, Timing & Network Intelligence, runs as a strict shadow challenger: it annotates each finding with a timing read (dormant, accumulating, confirming, or crowded) and a network read (insider buying, institutional flows, supply-chain centrality, government links) but by design contributes nothing to the ranking - and when attention runs ahead of evidence, it says plainly that the crowd likely arrived first.
- Under the hood: a new Python worker scores the universe nightly, a new Supabase schema (migration 056) stores the runs, predictions and outcomes, and 41 new tests pin the classifier, analogues, risk gates, timing challenger and the full pipeline.

## [0.89.0] - 2026-07-28

Audit remediation wave 7: the last three verticals cleared - save safety, gate self-checks, and a fully accessible landing.

### Changed

- The onboarding "Finish" step is now proven to never fake success: the exact rule that decides a save really landed (a 401 or server error must keep your entries and let you retry, never show "You're all set" on a dropped book) is pinned by tests, alongside the flow-navigation logic.
- The database schema-drift check now catches a column whose live TYPE has diverged from the migration (on top of the missing-column and NOT-NULL checks), and its own new detection logic is now self-tested - conservatively, so it never false-alarms on a custom type.
- The landing page fine print now clears accessibility contrast everywhere (a few sibling captions were missed last pass), and the stack section is now covered by a render test that proves the account-only tools are correctly hidden in the no-account Solo build.
- Under the hood: the shared quality-gate logic gained tests for its version, migration, and schema parsers, so a gate can never silently rot into always-passing.

## [0.88.0] - 2026-07-28

Audit remediation wave 6: the onboarding flow logic is pinned, and the quality gates now guard themselves.

### Changed

- The onboarding navigation and completeness logic - which beats you see, the never-traded skip, the 0-to-100% progress math, and how your alert choices map to a mode - is now covered by tests, so a regression that dropped a step or swallowed your preferences would be caught before it shipped.
- The quality gates that keep the app honest now have their own tests: they prove the version guard catches an unversioned or backwards release, and the migration guard catches a duplicate version or a table redefined with clashing columns - so a gate can never quietly rot into always-passing.
- The schema-drift check got two new eyes: it now catches a column the migrations require to be filled but the live database left optional (the exact bug that silently broke an hourly job), and it now guards user-owned tables whose owner column is not literally named user_id.
- Post-deploy smoke checks now also run when a change touches only the workers, content, database setup or notification contracts - shippable areas that previously deployed with no live verification.

## [0.87.0] - 2026-07-28

Audit remediation wave 5: the radar is honest about its timeframe, and the numbers behind it are finally pinned.

### Changed

- The Signal Radar now says plainly that its scores are computed on daily bars - so if you get an intraday alert and open the radar to a slightly different number, you know why, instead of seeing two figures that seem to disagree.
- The math that produces every number on the shipped scanner (RSI, moving averages, distance-from-low) is now covered by tests that pin it to its definitions, so a silent bug in the display path would turn the board red instead of shipping wrong figures.
- The paper-trading benchmark chart no longer implies a head-to-head return: your live session line and the 30-day market lines share a shape, not a calendar, and the caption now says so.
- The full paper-trade path - propose, approve, fill - is now driven end to end by a test through the real deterministic engine, and the Explain, Approve, Submit and tour controls are all a comfortable 44px.

## [0.86.0] - 2026-07-28

Audit remediation wave 4: your data fence is now provably closed, and the AI can't dress a score up as a return.

### Changed

- The privacy fence that keeps your portfolio, watchlist and paper trades visible only to you is now proven by an automated test on every build: it seeds two users and confirms one can never read the other's rows, so the leak class we fixed before can never quietly come back.
- The AI copilot's number guard got sharper: a made-up figure like "up 82%" is no longer waved through just because 82 happens to appear elsewhere as a score - a percentage or multiple now has to be genuinely in the evidence, closing a subtle way an invented number could slip past.
- The iOS app's offline screen now has a Retry button, so a brief drop-out recovers with one tap instead of a force-quit - and the app's shell config is now guarded by a test so it can't silently ship pointed at the wrong place.
- The landing page fine print now meets accessibility contrast, its footer links are a full tap target, and the chat composer, send button and quick add-holding inputs are all a comfortable 44px.

## [0.85.0] - 2026-07-28

Bigger tap targets on mobile + a hardened, tested nav bar.

### Changed

- The Live Wire and What's New buttons in the top bar are now a full-size 44px tap target on phones (they were a cramped 36px), so they are easier to hit without a mis-tap - unchanged on desktop.
- Your customised bottom nav bar is now hardened and tested: a corrupted or over-long saved bar can never render an unknown link, repeat a shortcut, or overflow the rail. Under-the-hood robustness, no change to your setup.

## [0.84.0] - 2026-07-28

Second remediation wave: more truthful defaults, hardened layout, deeper test coverage.

### Changed

- A watch rule you add with just a ticker is now proven at the engine level to wait for a real strong setup, not fire on every scan - the safeguard is pinned by tests so it cannot silently regress.
- Your saved command-centre layout is now hardened: a corrupted or duplicated saved order can never render the same card twice or lose a newly-added one.
- A notification-relevance setting now falls back to the correct default (40) instead of a stray 75 when cleared, so what you set is what you get.
- Added another batch of behavioural tests covering the live news mapping, the layout engine, the watch-rule floor, and the AI "add your key / allowance used up" messages, and corrected a stale scanner-schedule comment. Under-the-hood quality, no change to how the app looks.

## [0.83.0] - 2026-07-28

Honesty + polish pass: real search, truthful data labels, and controls that actually work.

### Changed

- The header search is now a real ticker search - type a name and jump straight to it. A ticker Lyra has not scanned lands on an honest "not in the current scan" page with the names it does cover, instead of a dead end.
- Market data is now clearly labelled live vs sample everywhere. The news feed, hype meter, fundamentals and government-awards pages tell you when you are looking at illustrative samples versus a real feed, and the awards page now surfaces live federal-contract data when available.
- Watchlist rules no longer show a false "triggered": a rule you add with just a ticker now waits for a genuine strong setup (score 60+) instead of firing on every scan.
- Portfolio: you can now remove a holding straight from the portfolio page, Solo profit/loss includes your brokerage fee to match the real cost basis, and Solo positions now surface the same protect-capital exit prompts the account-backed view does.
- Notifications: the Custom quiet-hours you set now actually apply to delivery (they used to save only on your device), and dead frequency/scope dropdowns that did nothing were removed.
- New public AI transparency page (the System Card) - a plain readout of what Lyra's AI may and may never do, its guardrails, and live evaluation results.
- Dozens of smaller honesty fixes: the momentum lead-in chart is now labelled as an illustrative reconstruction, the landing page states plainly that Lyra finds beaten-down names turning up (not breakouts), and the paper-bot tour uses a realistic $5k balance instead of a $100k fantasy.

## [0.82.0] - 2026-07-27

A clear heads-up when you land: your first 2 weeks of AI are on us.

### Changed

- New accounts now get a one-time welcome in the command centre that spells out the deal up front: Lyra's AI is free for your first 2 weeks, then it switches to your own key (bring-your-own-key). It shows exactly how many days are left, so there are no surprises.
- When the trial ends, a one-time nudge points you to add your key - and reassures you that the scanner, portfolio, watchlist and notifications keep working regardless. Only the AI chat needs a key.
- Shown once each and never nags. Accounts granted hosted AI, and the Solo build, never see it.

## [0.81.1] - 2026-07-26

An always-there way back: keep your demo setup with a free account.

### Changed

- While you explore the demo, the command centre now carries a persistent "keep what you build" prompt - so if you wander deep into the console you always have the one-tap path to create a free account in front of you, instead of having to find your way back to sign-up.
- It shows only during the accountless demo and disappears the moment you have an account, and because your whole setup carries over on sign-up, keeping it costs you nothing.

## [0.81.0] - 2026-07-26

Explore the demo, then keep it - your whole setup now follows you into an account.

### Changed

- If you try Lyra from the read-only demo and then create an account, the ENTIRE setup you built - strategy, watchlist, holdings, capital and alert preferences - now comes with you. You land on a one-tap "Welcome back, save your setup" screen instead of replaying the whole questionnaire. Previously only holdings and the watchlist carried across; everything else had to be re-entered.
- Fixed a trap in that handoff: the demo-tour cookie is set for a week and used to linger after sign-up, which could make a brand-new account look like a demo session - skipping every cloud save and looping you back into onboarding. Signing in now clears it immediately, so your first save always lands.
- You can still change anything before saving - "Review & edit" drops you into the normal setup steps, fully pre-filled.

## [0.80.1] - 2026-07-26

A one-image "How Lyra Works" explainer, for sharing at a glance.

### Changed

- Added a single-image explainer (assets/how-lyra-works.png) that puts Solo and Full account side by side - what each one is, how each one gets its data, and what they share - so you can send one picture instead of a paragraph.
- Linked from SHARE.md and the top of the README so the graphic travels with the two-link share kit.

## [0.80.0] - 2026-07-26

Two ways to try Lyra, made official - Solo now points you to a Full account when you need one.

### Changed

- Solo (the no-account build) now offers a one-tap path to create a Full account at the exact moments it has to say "not here" - background notifications and hosted AI. It only ever shows on the accountless build; the full app, which already has accounts, never sees it.
- New share kit. SHARE.md carries the ready-to-send two-link blurb (Solo vs Full account), and DATA-FLOW.md explains, with a file-and-line citation behind every step, exactly where each side gets its numbers: Solo recomputes signals live from Yahoo on the spot for a curated list, while the Full account reads an hourly-scanned, stored universe with a live overlay and your own portfolio and watchlist layered on top.
- The README now leads with the two live links and what each one is for, so sharing Lyra is a copy-paste, not an explanation.

## [0.79.0] - 2026-07-26

AI is now free for your first two weeks, then it is your own key - and the whole app works either way.

### Changed

- New accounts get Lyra's hosted AI included free for 14 days. After the trial, AI switches to bring-your-own-key - you add a provider key in AI Settings and nothing else changes. The countdown shows in AI Settings so it is never a surprise.
- This is now a per-user decision, not a whole-deployment one: the hosted key is handed only to users inside their trial (or a standing grant), so we never pay for AI for someone who is past their trial. The scanner, portfolio and notifications never use AI, so a lapsed trial costs you nothing but the chat.
- Under the hood it is enforced at the one credential chokepoint every AI route already passes through, pinned by tests: an anonymous caller, and now a signed-in-but-lapsed caller, can never reach the house key.

## [0.78.0] - 2026-07-26

A "How Lyra Works" page in Settings - see the decision process for yourself.

### Changed

- New Settings tab, How it works: a plain-English walk through exactly how Lyra decides - how a stock is scored 0-100 from five indicator blocks, how alerts are ranked by relevance (with your own holdings weighted highest), why the ranking is auditable (every number is measured against its real forward outcome), and precisely where AI is allowed (explaining) and forbidden (scoring, ranking, orders, notifications).
- It is grounded in the code, not a pitch: a companion root document HOW-LYRA-WORKS.md carries the same explanation with a file-and-line citation behind every claim, plus Mermaid diagrams of all nine subsystems, so anything stated can be traced to source.
- Also sketches the roadmap: telling Lyra your goal in plain words to reshape what it surfaces - the AI authoring a ranking policy the deterministic engine then runs for free on every brief.

## [0.77.0] - 2026-07-26

The Ideas board now records where each idea came from - Solo or Community.

### Changed

- Every new idea is tagged with the deployment it was posted from - Solo (the accountless build), Community (production), or other (a self-host) - so we can see how much of the board is driven by free Solo users versus signed-in ones.
- It reads the request origin server-side, which cleanly tells Solo (cross-origin) from Community (same-origin); it is provenance for us, never shown on the public board and never tied to a person.
- Safe either way: the tag writes best-effort, so an idea still posts fine whether or not the new column has been applied yet. Existing ideas stay honestly unlabelled rather than back-guessed.

## [0.76.0] - 2026-07-26

AI Settings tell the truth about hosted vs your-own-key on every deployment.

### Changed

- The AI copy now keys off whether a hosted key actually exists on this deployment - not off whether you have an account. So a build with full accounts, cloud sync and notifications but no hosted AI key correctly says "add your own key to switch AI on" instead of promising a hosted model that is not there.
- This makes a clean third shape first-class: the whole product (accounts, database, notifications) with AI as bring-your-own-key only - run your own Lyra without anyone footing your AI bill.
- The setting page, the model picker labels and the "Turn on your AI copilot" card all read from the same honest signal the chat already uses (GET /api/ai/status). BYOK keys stay in your browser, never server-side.

## [0.75.0] - 2026-07-26

A Solo-to-account upgrade path, built behind a control and held dark.

### Changed

- Groundwork for the Solo upgrade path: at the moment a Solo user goes looking for notifications - which Solo cannot deliver on its own - a one-tap prompt can offer a free Community account (push, Telegram, WhatsApp, scheduled digests, plus cloud sync across devices), deep-linking to signup on the accounted deployment.
- It ships behind a control (NEXT_PUBLIC_SOLO_UPGRADE_CTA) that is OFF by default, so nothing is visible yet - the prompt is built and tested, ready to switch on per-deployment when we choose to.
- Honest by construction: the prompt only ever appears on Solo, only for the capabilities that genuinely need an account (never for AI, which Solo already runs on your own key), and the accounted build never shows it.

## [0.74.1] - 2026-07-26

A features-per-build table in the README, generated so it can never drift.

### Changed

- The README now carries a "features per build" table - every shipped build and its headline theme, newest first - generated straight from this version log on every build, so it can never fall out of step with what actually shipped. The full per-build highlights still live in CHANGELOG.md and in-app at /whats-new.

## [0.74.0] - 2026-07-26

One codebase again - the Ideas board reaches Solo, and Solo's device-local polish reaches everyone.

### Changed

- The Ideas tab is now purely community ideas: what you want built inside Lyra. The AI scout's external signals (news themes, funding drumbeats) moved to the Scout tab as "Scout proposals" - the two questions never mix again.
- Post and vote without an account: ideas and votes work signed-out and in Lyra Solo, keyed to your device. One shared board for everyone - a Solo user sees and votes on the same list as a signed-in one.
- Two standing example ideas seed the board - deliberately things we may never build - so you can see what an idea looks like before adding your own.
- Scout proposals keep everything they had: evidence links, AI reads, confidence, votes, and the maintainer promotion flow - just on the tab where perception belongs.
- Solo and the accounted app are now one branch and one codebase again, switched only by deployment env - so every fix ships to both.

## [0.73.2] - 2026-07-24

Solo now behaves like one truthful device-local product from first run onward.

### Changed

- A completed Solo setup is now a one-time journey: returning users enter their console directly, and even a stray onboarding URL redirects home unless an explicit replay was requested.
- Every personal board now uses only this browser’s saved watchlist, holdings and cash. Seeded demo portfolios, alerts and overlay counts can no longer impersonate the user on charts, radar, simulation or planning surfaces.
- Solo trade logging is now one atomic local transaction across the trade log, holdings and saved cash balance. A failed write rolls the whole action back, and Undo restores all three.
- The Solo/Community boundary is explicit throughout setup and settings: no sign-in, hosted AI or background-delivery claims in Solo; BYOK remains optional and device-held.
- AI provider failures now produce actionable user messages plus bounded, secret-free operations codes. Successful and failed runs emit hash-only structured telemetry with provider, model, latency, usage and cost.
- Alert worker deduplication no longer stores skipped attempts as sent alerts, preventing false cooldowns and unbounded alert-table growth.

## [0.73.1] - 2026-07-24

Solo BYOK credentials can be removed without wiping the console.

### Changed

- AI Settings now has a dedicated Remove key action whenever a browser-held provider key exists, so a Solo user can revoke that credential without deleting their watchlist, portfolio, trade log or other device settings.
- Returning Solo users who revisit the welcome page now see Open my console and go straight to their existing console instead of accidentally restarting the first-run setup.

## [0.73.0] - 2026-07-24

Solo first-run, install and BYOK grounding now tell one consistent truth.

### Changed

- Solo now has one clear front door: Enter my console, no sign-in action, an explicit SOLO status in the app, and account-free Home Screen instructions.
- Installability is fixed for first-time visitors: the web manifest and service worker bypass the onboarding gate and return as real PWA assets instead of redirecting to the welcome page.
- Bring-your-own-key chat now receives a validated, transient snapshot of the holdings, watchlist and operating context stored on this device, so sample portfolio data can no longer impersonate the Solo user. Anonymous questions are excluded from raw question-signal capture; AI audit metadata remains hash-only.
- Solo portfolio and trade-log behavior is truthful at the edges: an empty local book stays empty instead of restoring sample holdings, and fractional shares are displayed instead of rounding a real position down to zero.

## [0.72.0] - 2026-07-20

Lyra Solo - the no-account, bring-your-own-key mode is now first-class.

### Changed

- Solo deployments (no Supabase configured) no longer lose your work: the add-watch-rule form and quick actions save to a browser-local watchlist, and a new "Your watch rules - on this device" panel on the Watchlist page shows them back to you.
- Trades you log in chat now persist on this device in Solo mode, with real fill prices from the live quote lookup, holdings that actually move, and undo that unwinds in reverse order per symbol - exactly the server contract, browser-local. The Trade Log page reads and undoes the same store.
- Refusals are honest: a trade with no live quote or no amount is refused rather than logged with a made-up price.
- Copy now tells the truth about where you are: Solo mode says "no accounts here, your data stays in this browser" instead of asking you to sign in to accounts that do not exist, and the AI settings say plainly that Solo has no hosted key - bring your own to turn AI on.
- The welcome page states the Solo promise up front: no account, no cloud, AI on your own key.

## [0.71.0] - 2026-07-20

Support and Terms pages, reachable without signing in.

### Changed

- Added a Support page with contact details, how to report a problem, common questions, and how to get your data deleted.
- Added a Terms of Service page stating plainly that Lyra is research software, not financial advice, and is not connected to any brokerage.
- Fixed the real defect behind both: /support and /terms were not in the middleware public list, so every visit was redirected to /welcome. A legal page behind a sign-in is the same as no legal page, and App Store Connect requires a working support URL.

## [0.70.2] - 2026-07-18

Notch fix, without double-padding the ears.

### Changed

- The welcome screen no longer pads the landscape notch ears twice - the page owns the top and bottom insets, the document body owns the left and right ones.

## [0.70.1] - 2026-07-18

Welcome screen clears the notch.

### Changed

- The signed-out welcome screen now respects the iPhone safe areas - the Lyra header no longer collides with the status bar clock inside the iOS app (and landscape ears are padded too).

## [0.70.0] - 2026-07-18

First-class inside the iOS app.

### Changed

- The site now knows when it is running inside the Lyra iOS app (one shell-detection module, invisible to browsers) and adapts: external links open in Safari instead of trapping you in the app, and the onboarding Home-Screen step becomes a simple confirmation.
- Edge-to-edge safe areas: headers, drawers, sheets, the tour card, and the launchers all clear the iPhone notch and home indicator - in the app, the installed web app, and Safari landscape.
- New Share button on ticker pages and the Track Record page - opens the system share sheet where the browser supports it, with a copy-link fallback.
- Phase 2 native push (APNs) is designed and documented in docs/product/native-app.md - web push cannot reach the app shell, so alerts there stay on Telegram/Slack/WhatsApp until it ships.

## [0.69.1] - 2026-07-18

Home-Screen walkthrough polish.

### Changed

- The Safari-menu screenshot in step 1 is now compact and centered instead of full-width, and the Lyra icon in the final payoff shot is dead-centered. Reviewed live on the iOS simulator.

## [0.69.0] - 2026-07-18

Your phone stops buzzing: a real rate cap, and Quiet mode that means it.

### Changed

- Alerts are now capped at 6 per hour (adjustable, 0-60). Anything over the cap is held and delivered later as the window frees - late beats lost - so a fresh watchlist plus an hourly scan can never again fire one notification per minute. Approval requests, kill-switch notices and your scheduled digests are never rate-limited.
- Quiet mode is now enforced on the server, not just painted in the menu. Switching to Quiet really does mean only portfolio risk, strong setups and your digests get through - everything else stays silent. (It used to live only in your browser while the server kept sending everything.)
- The Add-to-Home-Screen step no longer skips silently when you are already running the installed app - it shows a short "already on your Home Screen" confirmation instead, so the journey never feels like it lost a step. Plus a heads-up that the installed app runs its own session: create your account first and everything carries over.
- Review tools: /onboarding?beat=homescreen deep-links straight to the Home-Screen step.

## [0.68.1] - 2026-07-18

A replay switch for the onboarding journey.

### Changed

- Visit /api/demo?fresh=1 to replay the full onboarding journey from the very first beat - it clears the toured stamps and the resume checkpoint, so the reveal, primer, questionnaire and Home-Screen walkthrough all play again. For reviewing the flow, showing it off, or taking screenshots - repeatable forever.

## [0.68.0] - 2026-07-18

Onboarding now teaches you to put Lyra on your Home Screen.

### Changed

- A new final beat in onboarding walks you through installing Lyra on your phone - on iPhone with a real four-step screenshot walkthrough (menu -> Share -> Add to Home Screen -> done, with the Lyra icon on your Home Screen as the payoff), on Android with the Chrome steps. This is functional, not cosmetic: on iPhone, the alerts you just configured can only reach your phone once Lyra is installed to the Home Screen.
- Smart about context: if you are already running Lyra from your Home Screen the step skips itself, and on a computer it points you to open Lyra on your phone. Skippable either way - it never blocks the console.

## [0.67.1] - 2026-07-18

Demo journey unblocked for everyone who tried the demo before.

### Changed

- Anyone who tapped "Explore the demo first" before today carried a leftover cookie that made the app think they had already completed the new onboarding journey - so it skipped them straight to the console. The "already toured" check now keys on a marker that only finishing the journey can set, so earlier demo visitors (and your own phone) get the full experience on their next tap.

## [0.67.0] - 2026-07-18

The demo now takes you through the full onboarding journey.

### Changed

- "Explore the demo first" no longer teleports you into a dense dashboard. A first-time visitor now gets the complete experience: the Lyra reveal, the feature primer, and the full setup questionnaire - strategy, watchlist, portfolio, capital and alert preferences - before landing in a command centre personalised by their answers. Everything persists locally in the read-only tour; nothing needs an account.
- Fixed alongside it: a demo visitor who reached onboarding could never actually FINISH it - every cloud save requires a sign-in, so the finish button surfaced a permanent retry error. The tour now skips cloud writes cleanly and completes.
- Returning demo visitors who already finished the tour skip straight to the console - tapping the demo button twice never repeats the questionnaire.

## [0.66.0] - 2026-07-18

Paper Bot page rebuilt from panels - same surface, half the moving parts.

### Changed

- Under-the-hood: the Paper Bot page was one 970-line component; it is now a small orchestrator composing four focused panels (how-it-works, paper account, alerts feed, command line) with shared types in one place. Nothing changed visually or behaviourally - every class and interaction is byte-for-byte - but each panel can now be read, reviewed, and changed on its own.

## [0.65.0] - 2026-07-18

The motion map - every loop, mapped and measured.

### Added

- LOOPS.md: all 12 loops in the system mapped end to end with ASCII diagrams - trigger, ledger, who reads it back, what closes each loop, and the gate that keeps it honest. Adversarially verified against the code.
- DATA-ECONOMICS.md section 6: audited retention benefit horizons for every growing table (candles 380d, alerts 31d, indicators read-by-nothing, learning tables keep-forever) plus the free-forever plateau math.
- Nightly gate `npm run check:data-economics`: DB size vs tripwires, per-table budgets, sunk rows past each benefit horizon. Reports and pages, never deletes.

### Changed

- Harness map regenerated with the data-economics gate; README, CLAUDE.md and AGENT-ONBOARDING.md now index the three-legged doc set: ARCHITECTURE (structure), HARNESS (enforcement), LOOPS (motion).

## [0.64.0] - 2026-07-18

Thumb-sized tap targets everywhere, and the alert API contract is pinned.

### Changed

- Every remaining small control now meets the 44px mobile touch floor: settings toggles, modal close buttons, the product-tour skip, table filters, and the community feed actions. Desktop keeps its dense look - the tap target grows only where fingers need it.
- The notification API is now contract-tested: the mute settings you save are proven to land in the database (with symbols normalised and a bad snooze timestamp failing open, never muting you forever), and the dispatch route's authorization boundary - who may send alerts to whom - is pinned so it can never silently regress.

## [0.63.0] - 2026-07-18

Mute genuinely mutes, alerts never double-send, and reviews read right on WhatsApp.

### Changed

- The Mute button is now real. The "Muted" mode and timed snoozes ("Mute 1h/4h/tomorrow") used to live only in your browser - the server kept sending to Slack, Telegram, WhatsApp and push regardless. Mutes now sync to the server and every delivery path honors them, including per-symbol and per-theme mutes. One deliberate exception: an approval request or kill-switch notice still gets through - a mute asks for silence, not for a decision to stall.
- The same alert can no longer arrive twice. Two background schedulers could overlap and both deliver a held or retried notification; each delivery is now claimed atomically before sending (backed by a database unique index), so exactly one sender wins - and if a claimer crashes mid-flight, the nightly sweep recovers the alert instead of losing it.
- Monthly, quarterly and yearly reviews on WhatsApp now carry their actual content - portfolio return, best and toughest movers, benchmark comparison. They were being squeezed into the signal-alert template, which dropped the entire review body and dressed it up as a score. Macro and CGT notices had the same bug; all fixed.
- Turning off the weekly digest now actually turns it off. The Friday weekly report was gated on a preference column that never existed, so the opt-out was silently ignored and the report fired for everyone.

## [0.62.0] - 2026-07-18

Every AI call now shows its token cost.

### Changed

- The AI Ops dashboard now shows what the AI actually costs: total estimated spend, average $ per run, and tokens in/out. Token counts come straight from each provider (real, not estimated); the dollar figure is calculated at list price and clearly labelled as an estimate.
- Honest by design: a call where the provider did not report usage, or a model with no price on file, is counted as "unpriced" and left out of the total - never guessed into a wrong number. Priced and unpriced runs are shown side by side so the figure you see is trustworthy.
- This closes the last cost gap in the AI posture scorecard: resilience/cost moves from A++* to a clean A++.

## [0.61.0] - 2026-07-18

Paper-bot approvals are tamper-proof, and your bot feed is private.

### Changed

- The paper trading approval gate is now a signed, server-verified capability. Before, the approve and execute steps trusted whatever the browser sent - so a crafted request could have skipped the AI-evidence and risk checks and booked a paper fill outright. Every step is now cryptographically bound to you and to the exact order, so a fabricated, tampered, or replayed approval is refused. Paper only, as always - no real money is ever involved.
- Your paper-bot notification feed - approvals, fills, position moves - is now private to you. It used to be one shared feed, so on a multi-user deployment one signed-in person could see (and clear) another's bot activity. Flags are now scoped per user and can only ever be read or marked read by their owner.
- Under the hood: the capability is stateless (it survives serverless restarts) and portable - a clean pattern any request/response API can reuse to make a multi-step approval unforgeable without server-side session storage.

## [0.60.0] - 2026-07-18

Retrieval quality: the right doc wins again.

### Changed

- Fixed a measured retrieval regression: asking about going live with Supabase could rank a "where to next" pointer from another walkthrough above the actual go-live guide. The semantic reranker now also weighs which doc a section belongs to, so the doc that covers your topic beats a doc that merely links to it.
- The retrieval quality gate (recall@1/@3/MRR vs the lexical baseline) is green again - the hybrid reranker measurably beats or matches lexical on every labelled question.

## [0.59.0] - 2026-07-18

The accumulator wave: five loops that store learnings and compound.

### Changed

- Alerts finally learn from you: every alert deep link is now tagged, and opening one records an engagement - the first behavioral signal the notification layer has ever kept. Over time Lyra can show which alert types YOU actually act on, and whether relevance scores predict behavior instead of just claiming to.
- The scoring engine gains its evidence ledger: every night, each score component's values are joined to the real labeled outcomes and rebuilt into a component-efficacy table (win rate and average return per component band at 5 and 20 days). The engine stays deterministic - the ledger arms the humans who retune it.
- The copilot's unanswered questions become the content backlog: recurring topics asked by multiple users that match nothing in the vertical map are filed as content-gap cards on the Ideas board - aggregate counts only, never a quote, never an identity.
- Scout mis-attaches are correctable now: a maintainer-recorded exception (that tritium wastewater story is not fusion news) is enforced on every future run - the same accumulate-and-enforce shape as the verdict stop-list.
- The repo itself keeps ledgers too: every incident that earned a gate lives machine-readable in harness-incidents.jsonl, and every rule the adversarial verifiers learned drafting content lives in a content-rules ledger that seeds future drafts - both gate-checked so a ledger that stops parsing goes red.

## [0.58.0] - 2026-07-18

Prompt-injection fence on live news, resilient middleware pinned, honest copy.

### Changed

- The live "smart money" feature reads market news headlines and asks the AI to extract backing events. Those headlines are untrusted outside text, so a hostile headline could try to smuggle instructions into the model. They now pass through the same injection fence the chat uses - stripped of known injection patterns and wrapped as data, never instructions.
- The resilience fix that ended last session's outage (middleware fails safe instead of crashing the whole site) is now locked in by tests, so it can never silently regress.
- Copy cleanup: replaced em dashes with plain hyphens across the interface to match house style, and corrected the site description that implied a market-timing edge ("before the crowd catches on") - Lyra is research, not a promise to beat the market.

## [0.57.0] - 2026-07-18

The copilot can finally answer the macro questions it suggests.

### Changed

- The AI chat is now grounded in the live market snapshot: regime, VIX, Fear & Greed, yields and index moves flow into its context, so "what regime are we in?" - a question the UI itself proposes - gets answered from measured data instead of inviting a guess.
- The honesty carries through: when only sample values are available the grounding says so explicitly and instructs the model to disclose it, so demo numbers can never be presented as today's market.

## [0.56.0] - 2026-07-18

Fabricated demo data can no longer masquerade as real.

### Changed

- Closed a data-honesty gap in the nightly workers: when a data source was unavailable (no market-events API key, or every scout feed down), the worker fell back to built-in SAMPLE data - and then wrote that sample data into the live tables the product reads. So demo earnings, demo IPOs and demo story cards could appear in the calendar and on the community board as if they were real. They no longer do: a source is either live or demo, and demo output runs the loop for shape and logging but is never persisted.
- Pinned with tests that assert nothing is written on a demo/fallback night, and that a real source with a rejected write still fails loudly (the two are now correctly distinguished, where before they were conflated).

## [0.55.0] - 2026-07-17

The middleware can no longer take down the whole site.

### Changed

- Hardened the auth middleware so a single failed network call can never 500 the entire app again. It checks your session on every request; that check used to run with no safety net, so if the auth service blipped or the edge could not reach it, every page and API returned a server error at once - a total outage from one throw. It now fails SAFE: if auth is momentarily unavailable, public pages and APIs pass straight through (they enforce their own auth) and app pages fall back to the signed-out landing, never a crash.
- This is the kind of resilience a gate should have: it degrades to the safe, signed-out experience instead of taking everything down, and it never serves protected content when it cannot verify you.

## [0.54.0] - 2026-07-17

The news intelligence layer can finally save, and the macro tapes stop showing frozen numbers.

### Changed

- Diagnosed the nightly "fetched 25 news items but persisted 0" failure to its roots: the database tables for news, ticker-news mapping and hype scores were built in a different shape than the worker writes - one table did not even exist on a fresh install. Migration 049 aligns all three (apply it in the Supabase SQL editor; the nightly schema-drift check will remind you until you do), and 8 new drift tests pin the worker and the schema together so they can never silently split again.
- The Markets tape now tells the truth: the risk regime appears as a word next to the dot, and a Sample badge shows whenever the numbers are the bundled demo rather than the live hourly snapshot - which the app can now actually read, for the first time, from the archive the worker builds every hour.
- The AU Macro tape - the only sample surface in the app that never admitted it - gets the same honesty chip, and AUD/USD and the ASX 200 now display live from the hourly snapshot while the seeded rows (cash rate, CPI, jobs) say so plainly until their RBA/ABS feeds land.
- The Daily Brief stops narrating a fabricated market regime: it reads the same live snapshot as the tape, so what it says about the day is what the engine actually measured.
- Small honesty fix: the calendar drawer no longer claims an unknown ticker trades on NASDAQ - it says "US listing" unless it actually knows.

## [0.53.0] - 2026-07-17

AI spend controls that actually hold on serverless.

### Changed

- The guardrails that stop the shared AI key being run up - the per-caller rate limit and the daily token budget - now live in one shared store (Redis) instead of each serverless instance keeping its own count. On Vercel every request can land on a different instance, so the old in-memory limits reset constantly and were mostly decorative; now the ceiling is a single counter that holds across the whole fleet, and it falls back to in-memory locally without ever failing a call open.
- Three AI paths that were skipping the budget entirely - the GenUI composer, the research agent, and the paper-bot command - now charge the house budget like the chat does. An oversized single call is blocked before it spends anything, and a blocked call is rolled back so it is never double-counted. BYOK requests keep spending only the user's own key, untouched.
- All of it pinned with tests, including the fail-safe: if the shared store is unreachable, the budget still enforces via the in-memory path rather than waving calls through.

## [0.52.0] - 2026-07-17

The scout loop closes: accepted cards queue a build, and your verdicts teach the machine.

### Changed

- v2 - Draft-a-vertical: accepting a scout card now queues real creation. Set a scout card to Planned and it enters the drafting queue (npm run scout:queue lists it, evidence attached); the /draft-vertical playbook turns it into a reviewable pull request - theme, companies, chain nodes, backing events, and the attach keywords that make the scout start MAPPING that news instead of banking it as unmapped. Agents draft, humans merge - the vertical map never changes without your review.
- v3 - Your verdicts stop evaporating. A nightly stamping pass reads every decided card exactly once: accepted cards credit the sources whose evidence backed them, declined cards debit them - an earned source leaderboard now lives on the Scout tab. Declined entities join a stop-list, so a signal you rejected can never re-file or reappear as a drumbeat. All counts, no model opinion.
- Shipped verticals get measured, not assumed: the Scout tab's theme chips now show attach volume over the trailing 14 nights - whether a vertical is actually attracting news is a number you can watch, and a scout-born vertical that goes quiet shows it.
- The full loop, end to end: noticed -> drumbeat -> card -> your verdict -> either a drafted vertical PR (and the news starts attaching) or a stop-listed entity (and the noise never returns) - with every verdict sharpening which sources earn trust.

## [0.51.0] - 2026-07-17

Track Record: the real numbers, and one score that cannot silently drift.

### Changed

- New Track Record page (in Practice) shows how Lyra's signals have ACTUALLY resolved - win rate, average and median forward return at 1, 5, 20 and 60 days - measured from real labelled outcomes, not a backtest and not an estimate. It leads with the sample size and the exact date window, gates any group under 20 resolved signals as "still measuring", and when there is no history it says "not yet measured" rather than showing a decorative number.
- This replaces invented statistics. The strategy presets carried hardcoded win rates (the flagship claimed 67%) with a code comment saying they came from simulation - they did not, and the real measured win rate for the high-conviction signal is closer to 44%, with a roughly break-even median. Showing the humbler truth is the whole point of a research tool; the preset numbers are now clearly labelled illustrative everywhere they appear.
- Under the hood: the deterministic score now has ONE canonical implementation instead of three near-copies, and a cross-language parity contract (shared golden vectors) makes the TypeScript and Python scorers prove they agree on every commit - if either drifts, its own tests go red. Building the contract already caught and corrected the documented numbers.
- Also fixed: the onboarding strategy recommender silently recommended nothing on its main path because it matched by a display name that had been renamed - it now matches by stable ID.

## [0.50.0] - 2026-07-17

Scout gets its own tab - perception and proposals, cleanly separated.

### Changed

- The What's New page now switches between three surfaces: Updates (the changelog), Ideas (the community board, where scout cards land as proposals), and Scout (the perception stream - what the AI scout read, per-vertical counts, and the drumbeats building toward promotion). The feed no longer pushes human ideas below the fold, and it has room to grow.
- The tab is named Scout deliberately, not "AI Signals" - in Lyra, "signals" means the deterministic trading signals the engine computes, and that word stays reserved for them. The scout reads news; it never generates trading signals.
- A one-line bridge on the Ideas tab ("Scout: 8 signals building toward promotion") keeps the story walkable in one tap - the board explains its own sparseness. Deep-link with ?tab=scout.

## [0.49.0] - 2026-07-17

One doctrine for the copilot: research that checks your fit, never a trade to place.

### Changed

- Resolved a contradiction that had lived inside Lyra's own instructions: when you had a saved profile, the copilot was told to "size every idea" and say how many shares or dollars fit - while the same prompt's non-negotiable rule says Lyra never tells you to buy, sell, hold or size a position. Research-only is the line, and it wins.
- The copilot now CHECKS ideas against your goal, cash and risk comfort - flagging when a name sits outside your comfort or would breach your max position size - but never prescribes a share count or dollar amount. It describes the fit and leaves the decision with you, which is the whole point of a research tool.
- Pinned with a test so the contradiction cannot quietly return.

## [0.48.0] - 2026-07-17

See what the scout sees - the live feed, self-verifying evidence, and an AI read.

### Changed

- The Ideas board now opens with "What the scout saw": last night's read counts per vertical, the freshest items with their sources, and - the best part - the drumbeats still BUILDING toward promotion ("Commonwealth Fusion Systems - 2/3 items, 1/2 sources, needs 1 more independent source"). The bar stays hard; the patience is finally visible instead of looking like an empty board.
- Scout cards are self-verifying now: every evidence link names its source and date, and long evidence lists expand in place - "2 independent sources" is something you can check at a glance, not something you have to trust.
- Each scout card gains an optional AI read: 2-4 plain sentences on what the evidence collectively suggests, grounded STRICTLY in the attached headlines, guarded against invented facts and advice, and cached so one generation serves everyone. If AI is off or the guard rejects, the deterministic summary simply stands - the card never depends on a model.
- Under the hood: the nightly scout writes a run ledger (scout_runs) the product reads, drumbeats are computed by the same Python that promotes ideas so the surface can never drift from the real bar, and this release also carries the cluster-side code the previous two releases referenced.

## [0.47.0] - 2026-07-17

Honesty hardening: workers that store nothing now go red, and two privacy holes closed.

### Changed

- A full audit found four surviving pockets of the "green step that stored nothing" bug the last wave was meant to kill - and closed every one. The events worker's persist failures were being caught by an outer handler that reported success anyway; the intelligence worker had the whole pre-fix shape (swallow the write error, claim success); the fundamentals worker exited cleanly on a total crash because its fatal status was spelled differently from what the exit check looked for; and the scout's idea board could never save a card because its upsert key was a partial index Postgres refuses as a conflict target - the same class of bug fixed for two other tables last week, missed on a third.
- Each fix ships with a test that reproduces the exact failure and would go red if it ever came back - proven by running them against the old code first. A worker that fetches data and stores none of it now fails loudly instead of decorating a green nightly run.
- Closed a cross-user privacy hole: on a fresh install, the setup script re-opened a read leak that a prior migration had fixed, making every user's simulated paper trades readable with the public key. The reconcile step now senses the real table shape and keeps owner-only reads - verified closed on production.
- Closed a privilege-escalation hole: the community ideas board trusted a role column any signed-in user could write to their own profile, so anyone could self-promote to moderator and rewrite others' ideas. A database trigger now blocks role changes outside the server - live on production.

## [0.46.0] - 2026-07-17

The macro fleet: RBA decisions in your channels, a live calendar, CGT radar, and your return in AUD.

### Changed

- Lyra now watches the Reserve Bank. On each of the 8 decision days a year (seeded from the RBA's published 2026-27 schedule, verified at the source), a dedicated job fires minutes after the 2:30pm announcement: it reads the official statement, extracts held / cut / raised and the new cash rate from the Board's own words, measures the AUD/USD move since just before the announcement, and tells you what that does to your US holdings in AUD terms. If the statement cannot be read, the alert still fires - it just refuses to quote a number it never saw.
- Morning companions ride the nightly run: a pre-brief on decision mornings, a note when the Board minutes drop two weeks later, a heads-up when the RBA Chart Pack updates the morning after each meeting, and an FOMC morning-after brief the day the Fed moves overnight.
- The calendar is finally alive end to end: 56 seeded macro events (every RBA decision, minutes and Chart Pack date for 2026-27, every 2026 FOMC decision) now flow into the events table nothing had ever written to, and the calendar drawer stops being four bare facts - macro events show what the event is, why it matters, the announcement's local time, and a link to the primary source. Earnings for names you hold or watch, and imminent IPO listings, now alert the morning before they land.
- The Command page countdown ticks to real instants now - the next RBA decision counts down to 2:30pm Sydney and the FOMC to 2:00pm New York, timezone-correct across daylight saving, fed live from the calendar instead of a hand-curated list.
- CGT radar: every position with a purchase date now shows where it sits against the Australian 12-month CGT discount - a quiet held-duration badge that turns amber inside 30 days of the anniversary and green past it - and gains get a notification at 30 and 7 days out. Date math from your records, general information not tax advice.
- Your reviews now benchmark honestly: the monthly, quarterly and yearly reviews add a you-vs-S&P-500 line, and the Friday weekly report translates your USD return into AUD terms using the week's actual currency move. Both lines are measured from stored market snapshots and are silently omitted until enough history exists - never estimated.
- Found and fixed along the way: the hourly market snapshot (regime, VIX, AUD/USD) had been failing to store since the table was created - a NOT NULL column the insert never supplied, swallowed by a catch-all guard. The macro history archive starts accruing for real tonight.
- Macro alerts are ON by default from this release (they were silently off) - 8 decision days a year is signal, not noise. One toggle in notification settings turns the whole pillar off.

## [0.45.0] - 2026-07-17

The harness learns from its own gaps.

### Changed

- The version guard now blocks a release that would move the app version backwards. Two agent sessions can ship from one shared tree, and the version counter they share had no direction check - a real regression this week proved it.
- Scout hardening: live and demo mode now share one clustering pipeline (the forked path caused a real crash), the 14-day drumbeat window announces loudly if it ever saturates instead of silently weakening, and scout items older than 90 days are pruned so the table cannot grow without bound.
- The lessons behind every gate are now written where people actually read them: a new "How this repo stays honest" section in the README, hard rules in AGENT-ONBOARDING, and two new earned-lesson entries in HARNESS.md.

## [0.44.1] - 2026-07-17

Scout demo-mode fix, proven by its first production run.

### Changed

- Fixed a crash in the scout worker when running with no database configured (the demo promise): a refactor left the keyless path referencing a value only computed on the live path. Pinned with a test that runs the whole orchestrator keyless.
- The scout completed its first production run tonight: 400 broad-signal items read from 36 live feeds, attached across all ten verticals, with 110 unmapped items banked into the 14-day window where emerging-vertical drumbeats accumulate. No idea cards yet - the bar (3 items from 2 independent sources) is deliberately hard to clear on night one.

## [0.44.0] - 2026-07-17

Your reviews now actually arrive - monthly, quarterly and yearly, with your real return.

### Changed

- The periodic reviews finally have a scheduler. On the last trading day of every month, quarter and year, Lyra now measures your portfolio and sends the review to your channels - and if a run is missed, it self-heals: the review arrives a night late instead of never, and can never double-send.
- The performance number is real, not narrated. Your return is measured from the same stored prices the scanner scored: positions you held at the start of the period are measured from the period-open price, and positions you bought during the period are measured from what you actually paid - so nothing is credited or blamed for price action you never held. Positions with no price data are skipped and the skip is counted, never hidden.
- Each review names your best and toughest position for the period with its measured move, so you can really see how you did at every zoom level - week, month, quarter, year.
- The Friday weekly report now carries your measured weekly portfolio return too, and Slack reviews show the same cash-with-wings performance tiers as Telegram (5% / 10% / 15%), with losses shown honestly in red.
- Under the hood the measured number now survives the whole pipeline: it rides the dispatch API, is stored with the event, and is rebuilt correctly when a review held by quiet hours is released later - previously the renderers supported a performance badge that nothing could ever feed.

## [0.43.0] - 2026-07-17

Deploys verify themselves now - and a fresh clone is proven to build, on every push.

### Changed

- Every push to main now gets a deploy smoke check: a workflow waits for the live site to actually serve the version that was just pushed, then probes the health endpoint, the landing page content, and the sign-in gate - and pages Telegram and Slack if any of it fails. CI proves the build; this finally proves the DEPLOYMENT, which is where six past bugs slipped through behind green tests.
- A fresh install is now a guarantee, not a hope: CI builds the ENTIRE database schema from empty on every push - all 43 migrations in order plus the reconcile script, against a throwaway Postgres. The class of bug where a new clone could not build the schema at all (it shipped once) now turns the build red before it merges.
- The new gate paid for itself on its first run: it caught a demo seed writing against a constraint that no longer exists and 8 stale indexes referencing columns from pre-multi-user table shapes - all of which would have broken every fresh install following the documented setup path. All repaired, with guards that stay correct on both old and new installs.
- Both gates are registered in the harness enforcement map (HARNESS.md) with the one rule every Lyra gate must obey: a green must be able to go red.

## [0.42.0] - 2026-07-17

A background job that stores nothing now says so, instead of reporting success.

### Changed

- The nightly jobs can no longer claim success while saving nothing. Both the events and fundamentals jobs caught their own database errors, logged a quiet warning, and reported "success" - so for months the dashboards showed a healthy green run while the tables sat completely empty. A job that fetches 21 events and stores none of them has failed, and it now says so loudly enough to trigger an alert.
- The per-stock log no longer lies either: it used to print "snapshot + metrics persisted" for every company regardless of whether the write actually succeeded. It now reports the real number stored.

## [0.41.0] - 2026-07-17

The calendar and fundamentals are storing real data for the first time.

### Changed

- Company events and fundamentals now actually save. The nightly jobs had been reporting success while writing nothing at all: the upsert key was built as a partial index, which Postgres cannot use as a conflict target, so every single write was rejected and the jobs logged a warning and carried on. Both tables were empty. They now hold real rows, which means the market calendar reads live events and fundamentals have somewhere to land.
- This was caught by watching a real run persist zero rows rather than by trusting a green tick - the job had been "succeeding" the whole time.

## [0.40.0] - 2026-07-17

The new reviews could never have been delivered - the API was rejecting them.

### Changed

- Fixed a gap that would have made the weekly, monthly, quarterly and yearly reviews impossible to send. Every renderer supported them, but the endpoint that actually accepts an alert kept its own hand-written list of allowed types - and the reviews were not on it. They would have been turned away as "type is invalid" and never reached you.
- Closed the whole class of bug rather than the one instance: the list of valid alert types is now generated from a single source that the compiler forces to stay complete, so adding a new kind of alert can never again leave the door shut behind it.

## [0.39.0] - 2026-07-17

The AI scout: Lyra now reads the wide world nightly and files evidence-linked ideas on the board.

### Changed

- Lyra can now NOTICE. A nightly scout reads a curated registry of 100 broad-signal sources - 36 open feeds (NASA, DoE, DoD, SpaceNews, SemiAnalysis, World Nuclear News, IEEE Spectrum, mining and quantum trade press) plus the Finnhub general-news firehose - and deterministically attaches every item to the vertical map. All 36 feeds were verified live before shipping.
- Signal with NO home vertical is the interesting part: when an unmapped entity recurs across at least 3 items from 2 independent sources inside a 14-day window, the scout files an idea card on the SAME Ideas board humans use - marked Scout, with the evidence links attached and a confidence that is pure breadth math, never a model opinion.
- Humans stay in charge by construction: the scout only ever writes cards. It cannot touch the vertical map, and moving a card (planned, in progress, shipped, declined) is maintainer-only, enforced in the database, with one-tap status controls on the board for the maintainer.
- The registry also encodes where the scout will grow: 22 crawl targets (pages with high signal but no feed, like the DoD daily contract announcements) light up the moment a Firecrawl key lands, and 41 niche voices on X - from Dylan Patel to fusion and uranium specialists - are registered for when X API access exists. Gated honestly: registered intent, not pretended coverage.
- Fully harness-owned from day one: a new /scout-intel skill chain owns the worker, 17 new tests pin the honest behaviours (two-letter tickers never match bare text, one outlet drumbeating is never signal), and the nightly job reports failures loudly instead of green-ticking.

## [0.38.0] - 2026-07-17

Weekly, monthly, quarterly and yearly reviews - see how you are actually doing.

### Changed

- Lyra can now deliver a weekly, monthly, quarterly or yearly review, so you can finally see how you are doing over a period that matters instead of only what fired in the last hour.
- A good period looks good before you read a word: your return rides in the header with a cash badge that escalates as you climb - one at +5%, two at +10%, three at +15% and above.
- A bad period is never dressed up. A losing review carries a red marker, not a softer emoji - if the cash badge could show up on a loss it would tell you nothing.
- Reviews are written to land a finding, not dump statistics: what changed, what it cost or earned you, and the one habit behind it.
- Delivery only for now. Nothing generates these on a schedule yet, and the return figure is not yet computed from your real positions - the jobs that do both are next.

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

[Unreleased]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.99.0...HEAD
[0.99.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.98.0...v0.99.0
[0.98.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.97.0...v0.98.0
[0.97.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.96.0...v0.97.0
[0.96.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.95.0...v0.96.0
[0.95.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.94.0...v0.95.0
[0.94.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.93.0...v0.94.0
[0.93.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.92.0...v0.93.0
[0.92.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.91.0...v0.92.0
[0.91.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.90.0...v0.91.0
[0.90.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.89.0...v0.90.0
[0.89.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.88.0...v0.89.0
[0.88.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.87.0...v0.88.0
[0.87.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.86.0...v0.87.0
[0.86.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.85.0...v0.86.0
[0.85.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.84.0...v0.85.0
[0.84.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.83.0...v0.84.0
[0.83.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.82.0...v0.83.0
[0.82.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.81.1...v0.82.0
[0.81.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.81.0...v0.81.1
[0.81.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.80.1...v0.81.0
[0.80.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.80.0...v0.80.1
[0.80.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.79.0...v0.80.0
[0.79.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.78.0...v0.79.0
[0.78.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.77.0...v0.78.0
[0.77.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.76.0...v0.77.0
[0.76.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.75.0...v0.76.0
[0.75.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.74.1...v0.75.0
[0.74.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.74.0...v0.74.1
[0.74.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.73.2...v0.74.0
[0.73.2]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.73.1...v0.73.2
[0.73.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.73.0...v0.73.1
[0.73.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.72.0...v0.73.0
[0.72.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.71.0...v0.72.0
[0.71.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.70.2...v0.71.0
[0.70.2]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.70.1...v0.70.2
[0.70.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.70.0...v0.70.1
[0.70.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.69.1...v0.70.0
[0.69.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.69.0...v0.69.1
[0.69.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.68.1...v0.69.0
[0.68.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.68.0...v0.68.1
[0.68.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.67.1...v0.68.0
[0.67.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.67.0...v0.67.1
[0.67.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.66.0...v0.67.0
[0.66.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.65.0...v0.66.0
[0.64.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.63.0...v0.64.0
[0.63.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.62.0...v0.63.0
[0.62.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.61.0...v0.62.0
[0.61.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.60.0...v0.61.0
[0.60.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.59.0...v0.60.0
[0.59.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.58.0...v0.59.0
[0.58.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.57.0...v0.58.0
[0.57.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.56.0...v0.57.0
[0.56.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.55.0...v0.56.0
[0.55.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.54.0...v0.55.0
[0.54.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.53.0...v0.54.0
[0.53.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.52.0...v0.53.0
[0.52.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.51.0...v0.52.0
[0.51.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.50.0...v0.51.0
[0.50.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.49.0...v0.50.0
[0.49.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.48.0...v0.49.0
[0.48.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.47.0...v0.48.0
[0.47.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.46.0...v0.47.0
[0.46.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.45.0...v0.46.0
[0.45.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.44.1...v0.45.0
[0.43.1]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.44.0...v0.43.1
[0.44.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.43.0...v0.44.0
[0.43.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.42.0...v0.43.0
[0.42.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.41.0...v0.42.0
[0.41.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.40.0...v0.41.0
[0.40.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.39.0...v0.40.0
[0.39.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.38.0...v0.39.0
[0.38.0]: https://github.com/BrysonW24/vai-lyra-stock-tracker/compare/v0.37.0...v0.38.0
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
