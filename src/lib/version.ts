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
