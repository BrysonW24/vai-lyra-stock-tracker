/**
 * In-product changelog manifest - the "What's New" feed at /whats-new.
 *
 * Release notes rendered as a filterable, week-grouped, category-tagged in-product
 * feed rather than a docs site nobody reads.
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
