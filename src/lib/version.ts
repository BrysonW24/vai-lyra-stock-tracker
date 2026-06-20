/**
 * Single source of truth for the app version + the in-product, version-numbered changelog.
 *
 * APP_VERSION is shown on the landing page (so you can tell at a glance whether the deploy updated)
 * and on the What's New page. RELEASES is the semver changelog rendered in-app at /whats-new, so the
 * founder now - and users later - can track exactly what changed in each version. Keep this in lockstep
 * with CHANGELOG.md and package.json: when you cut a release, bump APP_VERSION, prepend a RELEASES
 * entry, move the CHANGELOG [Unreleased] section to the same version, and set package.json "version".
 */

export interface Release {
  version: string;
  /** ISO date the version shipped. */
  date: string;
  /** One-line theme for the version. */
  title: string;
  /** User-facing highlights, most important first. Plain hyphens only - never an em dash. */
  highlights: string[];
}

export const APP_VERSION = '0.5.0';

/** Newest first. The first entry is the current build. */
export const RELEASES: Release[] = [
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
