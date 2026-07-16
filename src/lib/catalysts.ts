/**
 * Catalyst Radar - the forward-looking "what's coming that matters" layer.
 *
 * Present-state surfaces (Prime Setups, technical Signals) tell you where things stand
 * now. This is the future-state layer: the upcoming market-moving moments - IPOs, mega
 * earnings, launches, macro prints - scored by how much they should be on your radar
 * *today*, so you can set up before they land. Deterministic priority, research framing,
 * never a buy/sell call.
 *
 * The priority matrix has three axes:
 *   - Timing     - how soon (an imminent or just-live moment outranks a distant one)
 *   - Impact     - potential market movement if it lands (scale of the moment)
 *   - Attention  - current hype / interest / news activity around it
 * blended into a single Heat (0-100), then bucketed into an urgency tier.
 */

export type CatalystCategory = 'ipo' | 'earnings' | 'launch' | 'product' | 'regulatory' | 'macro' | 'funding';
export type DateConfidence = 'confirmed' | 'expected' | 'rumored';
export type CatalystTier = 'now' | 'building' | 'horizon';

export interface CatalystSource {
  name: string;
  domain: string;
}

export interface Catalyst {
  id: string;
  title: string;
  category: CatalystCategory;
  /** ISO date (YYYY-MM-DD) the moment is expected to land. */
  date: string;
  dateConfidence: DateConfidence;
  /** Public tickers directly involved (may be empty for private-company events). */
  tickers: string[];
  /** Related public plays to watch for sympathy moves. */
  exposure: string[];
  /** Potential market movement if it lands, 1 (minor) - 5 (generational). */
  impact: number;
  /** Current hype / interest / news activity, 1 (quiet) - 5 (everywhere). */
  attention: number;
  /** One line on why it matters. */
  why: string;
  /** One line on what to watch / how to position - research framing, not advice. */
  setup: string;
  /** IPO/funding only: the price/valuation read (the "gather the price" step). */
  priceNote?: string;
  /** IPO/funding only: how you'd actually access it (the "find the broker" step). */
  accessNote?: string;
  sources?: CatalystSource[];
}

export interface ScoredCatalyst extends Catalyst {
  daysUntil: number;
  /** 0-100 per axis. */
  timing: number;
  impactScore: number;
  attentionScore: number;
  /** 0-100 blended priority. */
  heat: number;
  tier: CatalystTier;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

const HORIZON_DAYS = 45;
// Rumoured moments are real but less certain - discount their impact, not their buzz.
const CONFIDENCE_FACTOR: Record<DateConfidence, number> = { confirmed: 1, expected: 0.9, rumored: 0.78 };

/** Whole days from local midnight today to the catalyst date (negative = already passed). */
export function daysUntil(dateISO: string, now: Date): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateISO}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Timing urgency. Peaks for imminent/just-live moments and decays both ways: a future
 * event fades over the 45-day horizon; a passed event fades fast (~12/day) as it stops
 * being something you can still set up for and becomes old news.
 */
function timingScore(days: number): number {
  if (days >= 0) return clamp(100 - (days / HORIZON_DAYS) * 100, 0, 100);
  return clamp(100 + days * 12, 0, 100);
}

export function scoreCatalyst(catalyst: Catalyst, now: Date): ScoredCatalyst {
  const days = daysUntil(catalyst.date, now);
  const timing = Math.round(timingScore(days));
  const impactScore = Math.round(clamp(catalyst.impact * 20, 0, 100) * CONFIDENCE_FACTOR[catalyst.dateConfidence]);
  const attentionScore = Math.round(clamp(catalyst.attention * 20, 0, 100));
  const heat = Math.round(0.34 * timing + 0.36 * impactScore + 0.3 * attentionScore);

  const tier: CatalystTier =
    heat >= 66 && days >= -3 && days <= 14
      ? 'now'
      : heat >= 50 && days <= 30
        ? 'building'
        : 'horizon';

  return { ...catalyst, daysUntil: days, timing, impactScore, attentionScore, heat, tier };
}

/**
 * Score every catalyst, drop ones that have gone cold (passed more than ~8 days), and
 * rank by Heat. Pure function of the catalyst list + a reference time.
 */
export function deriveCatalystRadar(now: Date, catalysts: Catalyst[] = CATALYSTS): ScoredCatalyst[] {
  return catalysts
    .map((catalyst) => scoreCatalyst(catalyst, now))
    .filter((catalyst) => catalyst.daysUntil > -9)
    .sort((a, b) => b.heat - a.heat);
}

/**
 * The date this editorial catalyst set was last curated. This is static hand-authored data, so the
 * board must be honest about when it was last refreshed - a curated list silently ageing out (every
 * event passing until the board renders empty) reads as "nothing is coming" when it means "nobody
 * updated the list". Update this whenever CATALYSTS changes.
 */
export const CATALYSTS_CURATED_AS_OF = '2026-06-13';

export interface CatalystRadarState {
  items: ScoredCatalyst[];
  /** When the underlying editorial list was last curated. */
  asOf: string;
  /** True when nothing upcoming/recent survives - the board would otherwise render empty. */
  isEmpty: boolean;
  /** Days since the most recent catalyst in the list passed (0 while any are still upcoming). */
  stalenessDays: number;
}

/**
 * Radar state WITH honest freshness. Wraps deriveCatalystRadar and reports whether the board is
 * empty and how stale the curated set is, so the UI can show an explicit "last curated on / refresh
 * due" state instead of rendering nothing.
 */
export function catalystRadarState(now: Date, catalysts: Catalyst[] = CATALYSTS): CatalystRadarState {
  const items = deriveCatalystRadar(now, catalysts);
  const latestDaysUntil = catalysts.reduce((max, c) => Math.max(max, daysUntil(c.date, now)), -Infinity);
  const stalenessDays = Number.isFinite(latestDaysUntil) && latestDaysUntil < 0 ? Math.abs(latestDaysUntil) : 0;
  return { items, asOf: CATALYSTS_CURATED_AS_OF, isEmpty: items.length === 0, stalenessDays };
}

/**
 * Curated big moments. Editorial data - dates carry an explicit confidence flag and
 * everything is framed as research context, never a prediction or recommendation.
 */
export const CATALYSTS: Catalyst[] = [
  {
    id: 'cat-openai-ipo',
    title: 'OpenAI IPO filing',
    category: 'ipo',
    date: '2026-06-19',
    dateConfidence: 'rumored',
    tickers: [],
    exposure: ['MSFT', 'NVDA', 'AVGO', 'AMD'],
    impact: 5,
    attention: 5,
    why: 'The largest AI listing ever would re-rate the whole AI complex and reset private-market comps overnight.',
    setup: 'Watch MSFT (largest backer) and AI-compute names for sympathy moves the moment a filing headline hits.',
    priceNote: 'Public price is set at the prospectus - not yet knowable. Private secondaries have referenced a multi-hundred-billion range.',
    accessNote: 'IPO-day allocation varies by broker; pre-IPO exposure trades on secondary platforms (Forge, EquityZen).',
    sources: [
      { name: 'The Information', domain: 'theinformation.com' },
      { name: 'Bloomberg', domain: 'bloomberg.com' },
    ],
  },
  {
    id: 'cat-spacex-starlink',
    title: 'SpaceX / Starlink direct listing goes live',
    category: 'ipo',
    date: '2026-06-12',
    dateConfidence: 'expected',
    tickers: [],
    exposure: ['theme: space economy'],
    impact: 5,
    attention: 5,
    why: 'A live Starlink listing is a generational space-economy catalyst pulling fresh capital into the whole sector.',
    setup: 'Track satellite + launch-cadence names and watch for attention spillover into adjacent space plays.',
    priceNote: 'Listing price is set at the prospectus; private marks have been in the hundreds of billions.',
    accessNote: 'Watch which brokers run an IPO-access program - a direct listing can trade from day one.',
    sources: [{ name: 'Reuters', domain: 'reuters.com' }],
  },
  {
    id: 'cat-fomc-jun',
    title: 'FOMC rate decision',
    category: 'macro',
    date: '2026-06-17',
    dateConfidence: 'confirmed',
    tickers: [],
    exposure: ['theme: rates / broad market'],
    impact: 4,
    attention: 3,
    why: 'The rate path sets the discount rate under every growth name - a surprise reprices long-duration tech first.',
    setup: 'Expect the sharpest reaction in high-multiple software; watch the dot plot, not just the headline number.',
    sources: [{ name: 'Federal Reserve', domain: 'federalreserve.gov' }],
  },
  {
    id: 'cat-avgo-earnings',
    title: 'Broadcom (AVGO) earnings',
    category: 'earnings',
    date: '2026-06-18',
    dateConfidence: 'confirmed',
    tickers: ['AVGO'],
    exposure: ['NVDA', 'MRVL'],
    impact: 4,
    attention: 4,
    why: 'AVGO AI-interconnect guidance is the cleanest read on hyperscaler datacenter spend - it moves the group.',
    setup: 'The setup is already confirming on the radar; the print is the catalyst that confirms or breaks it.',
    sources: [{ name: 'Broadcom IR', domain: 'broadcom.com' }],
  },
  {
    id: 'cat-apple-ai',
    title: 'Apple on-device AI launch event',
    category: 'product',
    date: '2026-06-23',
    dateConfidence: 'confirmed',
    tickers: ['AAPL'],
    exposure: ['AAPL', 'QCOM', 'ARM'],
    impact: 4,
    attention: 4,
    why: 'A credible on-device AI story would re-rate AAPL and pull silicon suppliers along with it.',
    setup: 'Watch the supply chain (ARM, QCOM) for read-through; the reaction often outlasts the keynote.',
    sources: [{ name: 'Apple', domain: 'apple.com' }],
  },
  {
    id: 'cat-anthropic-round',
    title: 'Anthropic mega funding round',
    category: 'funding',
    date: '2026-06-27',
    dateConfidence: 'rumored',
    tickers: [],
    exposure: ['AMZN', 'GOOGL', 'NVDA'],
    impact: 3,
    attention: 4,
    why: 'A jumbo round resets frontier-AI valuations and signals continued compute demand for the chip names.',
    setup: 'Watch the named backers (AMZN, GOOGL) and compute suppliers for sentiment, not mechanics.',
    priceNote: 'A private round, not a public ticker - the read-through is the valuation mark, not a tradeable price.',
    accessNote: 'No direct retail access; exposure is via public backers (AMZN, GOOGL) and the compute names.',
    sources: [{ name: 'The Information', domain: 'theinformation.com' }],
  },
  {
    id: 'cat-crwd-earnings',
    title: 'CrowdStrike (CRWD) earnings',
    category: 'earnings',
    date: '2026-07-02',
    dateConfidence: 'confirmed',
    tickers: ['CRWD'],
    exposure: ['CRWD', 'PANW', 'ZS'],
    impact: 3,
    attention: 3,
    why: 'CRWD net-new ARR is the bellwether for the security tape - it sets the tone for the whole group.',
    setup: 'A beat-and-raise tends to lift peers (PANW, ZS); watch the read-through, not just the single name.',
    sources: [{ name: 'CrowdStrike IR', domain: 'crowdstrike.com' }],
  },
  {
    id: 'cat-tsla-ai',
    title: 'Tesla / xAI integration event',
    category: 'product',
    date: '2026-07-09',
    dateConfidence: 'rumored',
    tickers: ['TSLA'],
    exposure: ['TSLA', 'NVDA'],
    impact: 3,
    attention: 4,
    why: 'A concrete xAI-in-the-car story would reframe the TSLA narrative from autos to an AI platform.',
    setup: 'Heavy on narrative, light on numbers - size attention, and treat rumored timing as a moving target.',
    sources: [{ name: 'Reuters', domain: 'reuters.com' }],
  },
];
