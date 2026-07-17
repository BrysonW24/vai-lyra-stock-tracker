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
