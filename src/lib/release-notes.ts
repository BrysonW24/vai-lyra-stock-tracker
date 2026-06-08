/**
 * In-product changelog manifest - the "What's New" feed at /whats-new.
 *
 * Pattern stolen from Wiz's Product Updates surface (see vd-business/design-system/
 * references/wiz/16-product-updates-changelog.png + annotations §I): release notes
 * rendered as a filterable, week-grouped, category-tagged in-product feed rather
 * than a docs site nobody reads.
 *
 * This is the source of truth for the feed. Add a new entry at the top whenever a
 * user-visible change ships. Dates on entries before 2026-06 are approximate
 * groupings of existing capabilities; the 2026-06 entries are precise.
 */

export type ReleaseCategory = 'Feature' | 'Improvement' | 'Mobile' | 'Data' | 'Fix';

export interface ReleaseNote {
  id: string;
  /** ISO date the change shipped. */
  date: string;
  /** Week-group header label, e.g. "Week of 1 Jun 2026". */
  week: string;
  category: ReleaseCategory;
  /** Highlighted entries get the amber HIGHLIGHT pill, like Wiz. */
  highlight?: boolean;
  title: string;
  description: string;
  /** Short surface/area tags for scanning. */
  tags?: string[];
}

export const RELEASE_CATEGORIES: ReleaseCategory[] = ['Feature', 'Improvement', 'Mobile', 'Data', 'Fix'];

export const releaseNotes: ReleaseNote[] = [
  {
    id: 'rn-2026-06-07-live-wire',
    date: '2026-06-07',
    week: 'Week of 1 Jun 2026',
    category: 'Feature',
    highlight: true,
    title: 'Live Wire - one rolling feed of everything changing',
    description:
      'A new Wire surface (in the nav after Radar): every signal change + market headlines + events in one dense, newest-first stream with kind filters and a live marker.',
    tags: ['Wire', 'Intelligence'],
  },
  {
    id: 'rn-2026-06-07-spaces',
    date: '2026-06-07',
    week: 'Week of 1 Jun 2026',
    category: 'Feature',
    title: 'Smart Money + Commodities spaces',
    description:
      'Small caps catching government / big-tech / big-AI money, and the key commodities with real source countries + the AI-buildout angle - each on its own page.',
    tags: ['Smart Money', 'Commodities'],
  },
  {
    id: 'rn-2026-06-07-drawers',
    date: '2026-06-07',
    week: 'Week of 1 Jun 2026',
    category: 'Feature',
    title: 'Tap-to-explain drawers everywhere',
    description:
      'Tap a signal row, a calendar event, or a Smart Money name and a right-slide drawer explains what the score / RSI / MACD / event actually means. Research, not advice.',
    tags: ['Explainers'],
  },
  {
    id: 'rn-2026-06-07-density',
    date: '2026-06-07',
    week: 'Week of 1 Jun 2026',
    category: 'Improvement',
    highlight: true,
    title: 'Ultra-compact density pass',
    description:
      'A top-to-bottom density overhaul - global 15px base, tighter boxes, single-line signal rows, smaller chips and controls - so the whole console reads like a real terminal.',
    tags: ['Density'],
  },
  {
    id: 'rn-2026-06-07-executive-strip',
    date: '2026-06-07',
    week: 'Week of 1 Jun 2026',
    category: 'Feature',
    title: 'Executive strip on Command',
    description:
      'A Bloomberg-style row of minimal real mini-trackers (ticker / price / change / score) across the top of Command - your book at a glance, tap a tile for detail.',
    tags: ['Command'],
  },
  {
    id: 'rn-2026-06-07-compare',
    date: '2026-06-07',
    week: 'Week of 1 Jun 2026',
    category: 'Improvement',
    title: 'Compare: search, your portfolio, real dates',
    description:
      'Search-to-add tickers + a one-tap "use my portfolio", real date+time axis labels (no more H-29), and a glossary explaining what each metric means.',
    tags: ['Compare'],
  },
  {
    id: 'rn-2026-06-07-personalised',
    date: '2026-06-07',
    week: 'Week of 1 Jun 2026',
    category: 'Improvement',
    title: 'Personalised Command + holdings that stick',
    description:
      'The "New here" banner now adapts to what you have set up (or your beginner track), and holdings entered in onboarding now actually show in your book in demo mode.',
    tags: ['Command', 'Onboarding'],
  },
  {
    id: 'rn-2026-06-07-calendar',
    date: '2026-06-07',
    week: 'Week of 1 Jun 2026',
    category: 'Feature',
    title: 'Calendar: six months forward + event detail',
    description:
      'Navigate the month grid up to six months ahead, and tap any day or event for a detail drawer (type, exchange, timing, event risk).',
    tags: ['Calendar'],
  },
  {
    id: 'rn-2026-06-06-live-candles',
    date: '2026-06-06',
    week: 'Week of 1 Jun 2026',
    category: 'Feature',
    highlight: true,
    title: 'Live candle charts on every holding',
    description:
      'The Holdings Momentum board now renders the full live candle view per ticker - real price history and trend - instead of the synthetic 7-bar snapshot. Same charting premise as the ticker detail page.',
    tags: ['Command', 'Holdings'],
  },
  {
    id: 'rn-2026-06-06-dossier-carousel',
    date: '2026-06-06',
    week: 'Week of 1 Jun 2026',
    category: 'Feature',
    title: 'Swipe each holding into a dossier',
    description:
      'Every panel is now a swipeable carousel: Chart -> Setup -> Intel. Setup explains the score (action state, why-this-setup, risks). Intel surfaces ticker-tagged news and the hype read, all keyed to the dropdown symbol.',
    tags: ['Command', 'Holdings'],
  },
  {
    id: 'rn-2026-06-06-indicators',
    date: '2026-06-06',
    week: 'Week of 1 Jun 2026',
    category: 'Improvement',
    title: 'RSI + MACD on by default',
    description:
      'Momentum studies overlay every live chart by default so you can read momentum at a glance, with a one-tap Indicators toggle to switch back to clean candles.',
    tags: ['Charts'],
  },
  {
    id: 'rn-2026-06-06-mobile-2x2',
    date: '2026-06-06',
    week: 'Week of 1 Jun 2026',
    category: 'Mobile',
    title: 'Compact 2x2 holdings board on mobile',
    description:
      'The four holdings now tile as a 2x2 grid on every screen size, so you can scan all of them without scrolling a tall single column.',
    tags: ['Mobile', 'Holdings'],
  },
  {
    id: 'rn-2026-05-intelligence',
    date: '2026-05-28',
    week: 'Week of 25 May 2026',
    category: 'Feature',
    title: 'Intelligence feed',
    description:
      'Ticker-tagged market intelligence with source, sentiment, category and a per-ticker hype read - augmenting the technical signal with what the market is saying.',
    tags: ['Intelligence'],
  },
  {
    id: 'rn-2026-05-overlays',
    date: '2026-05-26',
    week: 'Week of 25 May 2026',
    category: 'Feature',
    title: 'Portfolio & watchlist overlays',
    description:
      'Backend-owned portfolio risk states and watchlist trigger states are surfaced across the console, so holdings and near-trigger setups read off the same signal truth.',
    tags: ['Portfolio', 'Watchlist'],
  },
  {
    id: 'rn-2026-05-demo-doctor',
    date: '2026-05-24',
    week: 'Week of 25 May 2026',
    category: 'Data',
    title: 'Demo mode + setup doctor',
    description:
      'Run the whole console on built-in demo data with no keys. `npm run doctor` shows exactly what is configured, what is missing, and which mode you are in (demo / live / alerts / AI).',
    tags: ['Setup'],
  },
  {
    id: 'rn-2026-05-telegram',
    date: '2026-05-22',
    week: 'Week of 25 May 2026',
    category: 'Feature',
    title: 'Telegram alerts',
    description:
      'The scanner can push setup alerts to Telegram, with mode / mute / quiet-hours / scope controls from the top bar. Backend-only - secrets never touch the frontend.',
    tags: ['Alerts'],
  },
];
