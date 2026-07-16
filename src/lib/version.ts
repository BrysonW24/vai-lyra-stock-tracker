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
