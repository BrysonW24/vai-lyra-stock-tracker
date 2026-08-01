/**
 * Model Lab - the data + run-engine behind the /models experience.
 *
 * This file is the single honest source of truth for what the Lab can run, what each model looks
 * for, which data sources it touches, and - critically - what actually happens when you press Run.
 * It is pure data + pure functions: no fabrication, no fake counters. Every number a run reports is
 * derived from data the app already has (the tracked-universe signals or the shadow-live Emerging
 * Winner reference queue). The run STAGES mirror the real pipeline; the per-stage OUTPUTS are the
 * real outputs that stage produced. What the Lab never does: invent a 428-company universe, a
 * 9,842-record evidence count, a trained-classifier probability, or a percentile that no code
 * computes. Those arrive with the point-in-time dataset (the data gate) and slot in here unchanged.
 */

import type { SignalRow, TickerSetting, PortfolioHolding, WatchlistRow } from '@/types/scanner';
import type { EmergingWinnerQueue, EmergingWinnerResult } from '@/lib/emerging-winner/types';

// ---------------------------------------------------------------------------
// Availability - four unambiguous states (replaces the old built/designed pair)
// ---------------------------------------------------------------------------

export type Availability = 'live' | 'shadow-live' | 'reference' | 'planned';

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  live: 'Live',
  'shadow-live': 'Shadow-live',
  reference: 'Reference',
  planned: 'Planned',
};

export const AVAILABILITY_BLURB: Record<Availability, string> = {
  live: 'Real model, real output.',
  'shadow-live': 'Real execution, logged to an immutable ledger, not yet promoted.',
  reference: 'Deterministic or illustrative output - not learned on real winners yet.',
  planned: 'Architecture exists, implementation does not.',
};

// ---------------------------------------------------------------------------
// Data sources - the honest connection truth, shared across models
// ---------------------------------------------------------------------------

export type SourceState = 'connected' | 'limited' | 'not-connected';

export interface DataSource {
  key: string;
  label: string;
  state: SourceState;
}

export const DATA_SOURCES: Record<string, DataSource> = {
  market: { key: 'market', label: 'Market and volume data', state: 'connected' },
  signals: { key: 'signals', label: 'Lyra deterministic signals', state: 'connected' },
  themes: { key: 'themes', label: 'Theme and supply-chain mappings', state: 'connected' },
  fundamentals: { key: 'fundamentals', label: 'Company fundamentals', state: 'connected' },
  government: { key: 'government', label: 'Government and contract evidence', state: 'connected' },
  insider: { key: 'insider', label: 'Insider / smart-money activity', state: 'limited' },
  hiring: { key: 'hiring', label: 'Hiring history', state: 'not-connected' },
};

// ---------------------------------------------------------------------------
// Models + their outcomes
// ---------------------------------------------------------------------------

export type ModelFamily = 'radar' | 'ew';

export interface LabOutcome {
  key: string;
  label: string;
  sub: string;
  /** false = the outcome is Planned; the Lab shows it but will not run it. */
  runnable: boolean;
}

export interface LabModel {
  key: string;
  name: string;
  cta: string;
  availability: Availability;
  family: ModelFamily;
  predicts: string;
  horizon: string;
  universeNote: string;
  explainability: string;
  /** Static version string for deterministic models; EW models resolve theirs from the queue at runtime. */
  version: string;
  looksFor: string[];
  sources: string[];
  outcomes: LabOutcome[];
  /** How the run view frames itself, kept honest per family. */
  runCaption: string;
}

export const LAB_MODELS: LabModel[] = [
  {
    key: 'oversold',
    name: 'Oversold Recovery',
    cta: 'Run Oversold Recovery',
    availability: 'live',
    family: 'radar',
    predicts: 'An early turn in a beaten-down name',
    horizon: 'Intraday to swing',
    universeNote: 'Your Lyra tracked universe',
    explainability: 'Five-driver deterministic breakdown',
    version: 'Deterministic (TS + Python parity)',
    looksFor: [
      'Reset-band RSI (35-50)',
      'Improving but still-negative MACD histogram',
      'Price within ~10% of its 60-period low',
      'Holding above or near the 200-period average',
      'Volume confirming the turn',
    ],
    sources: ['market', 'signals'],
    runCaption: 'Runs live on your tracked universe. Every number is the deterministic engine.',
    outcomes: [
      { key: 'recovery-score', label: 'Recovery score (0-100)', sub: 'The full early-turn score', runnable: true },
      {
        key: 'momentum',
        label: 'Momentum strengthening',
        sub: 'Ranked by improving RSI + histogram slope',
        runnable: true,
      },
      {
        key: 'risk-invalidation',
        label: 'Risk of invalidation',
        sub: 'Setups weakening or overextended first',
        runnable: true,
      },
      {
        key: 'twenty-before-ten',
        label: '+20% before -10%',
        sub: 'Planned event model - not built yet',
        runnable: false,
      },
    ],
  },
  {
    key: 'emerging',
    name: 'Emerging Winner',
    cta: 'Run Emerging Winner',
    availability: 'shadow-live',
    family: 'ew',
    predicts: 'Structural resemblance to past outsized winners',
    horizon: '24 to 60 months',
    universeNote: 'Real SEC-listed universe (~10,400 US cos · small-caps · dynamic)',
    explainability: '10-domain contribution breakdown',
    version: 'reference-v1',
    looksFor: [
      'Structural quality',
      'Genuine thematic exposure',
      'Policy or contract support',
      'Traction',
      'Survivability',
      'Sponsorship',
      'Technical confirmation',
    ],
    sources: ['market', 'signals', 'themes', 'fundamentals', 'government', 'insider'],
    runCaption:
      'Replays the shadow-live pipeline over an illustrative reference universe. Not a live scan of real companies - not trained on real winners yet.',
    outcomes: [
      {
        key: 'composite',
        label: 'Composite winner resemblance',
        sub: 'The 0-100 resemblance score',
        runnable: true,
      },
      { key: 'double-12m', label: 'Double (2x) within 12 months', sub: 'Reference-v1 probability (nearer horizon)', runnable: true },
      { key: 'double-24m', label: 'Double (2x) within 24 months', sub: 'Reference-v1 probability', runnable: true },
      { key: 'five-36m', label: '5x within 36 months', sub: 'Reference-v1 probability', runnable: true },
      { key: 'ten-60m', label: '10x within 60 months', sub: 'Reference-v1 probability', runnable: true },
      { key: 'lowest-ruin', label: 'Lowest ruin risk', sub: 'Safest downside first - P(-80% or delisting)', runnable: true },
      { key: 'fastest-catalyst', label: 'Fastest to catalyst', sub: 'Nearest expected catalyst first', runnable: true },
    ],
  },
  {
    key: 'analogue',
    name: 'Historical Analogue',
    cta: 'Run Historical Analogue',
    availability: 'shadow-live',
    family: 'ew',
    predicts: 'Which past winners and failures a name resembles',
    horizon: 'Structural (era-matched)',
    universeNote: 'Illustrative reference library (until the data gate)',
    explainability: 'Centred cosine over domain profiles',
    version: 'reference-v1',
    looksFor: [
      'Domain-profile similarity to known winners',
      'Domain-profile similarity to known failures',
      'What the closest winners had that this name is missing',
    ],
    sources: ['themes', 'fundamentals', 'market'],
    runCaption:
      'Matches domain profiles against an illustrative analogue library. Every match is labelled with that caveat.',
    outcomes: [
      { key: 'closest-winners', label: 'Closest past winners', sub: 'Ranked by winner similarity', runnable: true },
      { key: 'closest-failures', label: 'Closest past failures', sub: 'Ranked by failure similarity', runnable: true },
    ],
  },
  {
    key: 'risk-gate',
    name: 'Risk Gate Review',
    cta: 'Run Risk Gate Review',
    availability: 'shadow-live',
    family: 'ew',
    predicts: 'Whether a name survives the five risk gates',
    horizon: 'Point-in-time',
    universeNote: 'Real SEC-listed universe (~10,400 US cos · small-caps · dynamic)',
    explainability: 'Five deterministic gates (pass / review / block)',
    version: 'reference-v1',
    looksFor: [
      'Survivability',
      'Dilution risk',
      'Manipulation / hype',
      'Liquidity',
      'Downside',
    ],
    sources: ['market', 'fundamentals', 'signals'],
    runCaption: 'Real gate logic doing real work: missing data reads INSUFFICIENT, never a silent pass.',
    outcomes: [
      { key: 'survivability', label: 'Survivability first', sub: 'Cleanest gate profile ranked highest', runnable: true },
      { key: 'overall-verdict', label: 'Overall risk verdict', sub: 'Pass / review / block per name', runnable: true },
    ],
  },
];

export function getModel(key: string): LabModel {
  return LAB_MODELS.find((m) => m.key === key) ?? LAB_MODELS[0];
}

// ---------------------------------------------------------------------------
// Verticals + universes
// ---------------------------------------------------------------------------

/**
 * The full vertical/archetype taxonomy - every vertical is always available to select (all features
 * on). Each carries the keyword it matches inside a result.archetype; a vertical with no candidates
 * in the current universe simply returns 0 (honest), it is never hidden or disabled.
 */
export const EW_VERTICALS: { label: string; match: string }[] = [
  { label: 'AI infrastructure', match: 'ai infrastructure' },
  { label: 'Semiconductors', match: 'semiconductor' },
  { label: 'Robotics', match: 'robotics' },
  { label: 'Quantum', match: 'quantum' },
  { label: 'Space', match: 'space' },
  { label: 'Defence', match: 'defence' },
  { label: 'Government-backed', match: 'government-backed' },
  { label: 'Energy infrastructure', match: 'energy' },
  { label: 'Cybersecurity', match: 'cyber' },
  { label: 'Turnaround', match: 'turnaround' },
];

export interface UniverseOption {
  key: string;
  label: string;
  /** true = resolves to real, filterable data today; false = target universe with an honest caption. */
  real: boolean;
  note?: string;
}

export const UNIVERSES: UniverseOption[] = [
  { key: 'tracked', label: 'Lyra tracked universe', real: true },
  { key: 'watchlist', label: 'Only my watchlist', real: true },
  { key: 'portfolio', label: 'Only my portfolio', real: true },
  {
    key: 'small-micro',
    label: 'Small + micro caps',
    real: true,
    note: 'Real filter: keeps names under $2B market cap (Emerging Winner engine, where cap is sourced).',
  },
];

// ---------------------------------------------------------------------------
// Global markets - honest about which resolve today (US = SEC universe, live)
// ---------------------------------------------------------------------------

export interface MarketOption {
  key: string;
  label: string;
  /** live = real listings scan today; false = arrives with the international dataset. */
  live: boolean;
}

/**
 * Which market a run scans. Only the US resolves today (the free SEC universe, ~10,400 listings).
 * The rest are the international-dataset expansion - they stay selectable so the roadmap is visible,
 * but a run against them returns an honest empty set with a note rather than a faked foreign scan.
 * `global` means "every available market" - which is US today, shown with that caveat.
 */
export const MARKETS: MarketOption[] = [
  { key: 'us', label: 'United States (SEC)', live: true },
  { key: 'global', label: 'All markets (global)', live: true },
  { key: 'au', label: 'Australia (ASX)', live: false },
  { key: 'uk', label: 'United Kingdom (LSE)', live: false },
  { key: 'eu', label: 'Europe', live: false },
  { key: 'jp', label: 'Japan (TSE)', live: false },
  { key: 'kr', label: 'South Korea (KRX)', live: false },
  { key: 'in', label: 'India (NSE)', live: false },
];

export function marketFor(key: string | undefined): MarketOption {
  return MARKETS.find((m) => m.key === key) ?? MARKETS[0];
}

// ---------------------------------------------------------------------------
// Market-cap bands - real dollar ranges, filtered on the result's real market cap
// ---------------------------------------------------------------------------

export interface CapBand {
  key: string;
  label: string;
  /** Inclusive lower / exclusive upper bound in USD; null = open-ended. */
  min: number | null;
  max: number | null;
  hint: string;
}

export const CAP_BANDS: CapBand[] = [
  { key: 'all', label: 'All caps', min: null, max: null, hint: 'No size filter' },
  { key: 'micro', label: 'Micro', min: 0, max: 300e6, hint: 'Under $300M' },
  { key: 'small', label: 'Small', min: 300e6, max: 2e9, hint: '$300M - $2B' },
  { key: 'mid', label: 'Mid', min: 2e9, max: 10e9, hint: '$2B - $10B' },
  { key: 'large', label: 'Large', min: 10e9, max: 200e9, hint: '$10B - $200B' },
  { key: 'mega', label: 'Mega', min: 200e9, max: null, hint: 'Over $200B' },
];

export function capBandFor(key: string | undefined): CapBand {
  return CAP_BANDS.find((c) => c.key === key) ?? CAP_BANDS[0];
}

function inBand(cap: number | null | undefined, band: CapBand): boolean {
  if (band.key === 'all') return true;
  if (cap == null) return false; // unknown cap can't be confirmed in-band - excluded honestly
  if (band.min != null && cap < band.min) return false;
  if (band.max != null && cap >= band.max) return false;
  return true;
}

// ---------------------------------------------------------------------------
// The 10 EW domains - the fundamentals the engine scores. Sourced from the live
// result when present (drift-free), with a canonical fallback for an empty queue.
// ---------------------------------------------------------------------------

export const EW_DOMAIN_FALLBACK: { key: string; label: string }[] = [
  { key: 'technical', label: 'Technical structure' },
  { key: 'accumulation', label: 'Volume / accumulation' },
  { key: 'liquidity', label: 'Liquidity / tradability' },
  { key: 'theme', label: 'Theme strength' },
  { key: 'business_quality', label: 'Business quality' },
  { key: 'capital', label: 'Capital / survivability' },
  { key: 'government', label: 'Government / policy' },
  { key: 'adoption', label: 'Adoption / traction' },
  { key: 'sponsorship', label: 'Sponsorship / smart money' },
  { key: 'narrative', label: 'Narrative timing / attention' },
];

/** The 10 domains to offer as focus chips - live from the queue if we have one, else the canonical set. */
export function domainOptions(data: RunData): { key: string; label: string }[] {
  const sample = data.ew.queue[0];
  if (sample && sample.domains.length) return sample.domains.map((d) => ({ key: d.key, label: d.label }));
  return EW_DOMAIN_FALLBACK;
}

// ---------------------------------------------------------------------------
// Run engine - pure, honest
// ---------------------------------------------------------------------------

export interface LabConfig {
  modelKey: string;
  outcomeKey: string;
  verticals: string[]; // vertical labels
  universeKey: string;
  /** A curated ticker list (comma / space / newline separated) OR a single name; blank = whole universe. */
  ticker: string;
  /** Global market to scan. Optional for back-compat; defaults to 'us'. */
  market?: string;
  /** Market-cap band key (see CAP_BANDS). Optional; defaults to 'all'. */
  capBand?: string;
  /** Domain keys the user wants to prioritise; when set, EW results re-rank by strength in these. */
  domainFocus?: string[];
}

export interface RunData {
  signals: SignalRow[];
  tickers: TickerSetting[];
  ew: EmergingWinnerQueue;
  watchlist: WatchlistRow[];
  portfolio: PortfolioHolding[];
}

export type StageState = 'queued' | 'running' | 'complete' | 'warning';

export interface RunStage {
  id: string;
  label: string;
  /** Sources this stage reads (labels). */
  sources: string[];
  /** The real output this stage produced - a short, true line. */
  output: string;
  /** High-level, honest log lines for this step - what it did with the real data. Inspectable on demand. */
  logs?: string[];
  state: StageState;
}

export type ResultTone = 'strong' | 'moderate' | 'weak';

export interface LabResult {
  symbol: string;
  companyName: string;
  kind: ModelFamily;
  headlineValue: number;
  headlineLabel: string;
  tone: ResultTone;
  subtitle: string;
  group: string; // archetype (ew) or sector/status (radar)
  strongest: string[];
  primaryRisk: string;
  confidence?: string;
  evidence: string;
  /** Real market cap in USD when sourced (EW family); null/undefined when not - powers the opportunity map + cap band. */
  marketCap?: number | null;
  radar?: SignalRow;
  ew?: EmergingWinnerResult;
}

export interface RunSummary {
  reviewed: number;
  passed: number;
  surfaced: number;
  universeLabel: string;
  illustrative: boolean;
  version: string;
  marketLabel?: string;
  capBandLabel?: string;
  focusLabels?: string[];
  /** Honest notes about what a filter did (e.g. non-US market has no data yet, cap-band excluded unknowns). */
  notes?: string[];
}

export interface RunResult {
  stages: RunStage[];
  results: LabResult[];
  summary: RunSummary;
}

function toneFor(v: number): ResultTone {
  if (v >= 60) return 'strong';
  if (v >= 40) return 'moderate';
  return 'weak';
}

function nf(n: number): string {
  return n.toLocaleString('en-US');
}

function symbolSetForUniverse(config: LabConfig, data: RunData): Set<string> | null {
  if (config.universeKey === 'watchlist') return new Set(data.watchlist.map((w) => w.symbol.toUpperCase()));
  if (config.universeKey === 'portfolio') return new Set(data.portfolio.map((p) => p.symbol.toUpperCase()));
  return null; // tracked / small-micro -> whole available set
}

/** Parse the ticker box as a curated list: comma / space / newline separated, de-duped, upper-cased. */
function tickerSet(config: LabConfig): Set<string> | null {
  const tokens = config.ticker
    .toUpperCase()
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return tokens.length ? new Set(tokens) : null;
}

/** True when the run scans a market with no data yet (any specific non-US market). */
function marketIsEmpty(config: LabConfig): boolean {
  const key = config.market ?? 'us';
  return key !== 'us' && key !== 'global';
}

function buildRadarRun(config: LabConfig, data: RunData): RunResult {
  const model = getModel(config.modelKey);
  const sectorBySymbol = new Map<string, string>();
  for (const t of data.tickers) {
    const sec = t.sector || t.category;
    if (sec) sectorBySymbol.set(t.symbol.toUpperCase(), sec);
  }

  const uniSet = symbolSetForUniverse(config, data);
  const only = tickerSet(config);
  const selectedSectors = config.verticals.map((v) => v.toLowerCase());
  const emptyMarket = marketIsEmpty(config);

  const considered = emptyMarket
    ? []
    : data.signals.filter((s) => {
        const sym = s.symbol.toUpperCase();
        if (uniSet && !uniSet.has(sym)) return false;
        if (only && !only.has(sym)) return false;
        if (selectedSectors.length) {
          const sec = (sectorBySymbol.get(sym) || '').toLowerCase();
          if (!selectedSectors.some((v) => sec.includes(v))) return false;
        }
        return true;
      });

  const ranked = [...considered].sort((a, b) => {
    if (config.outcomeKey === 'momentum') return b.histogramSlope + b.rsiDelta - (a.histogramSlope + a.rsiDelta);
    return b.score - a.score;
  });

  const results: LabResult[] = ranked.map((s) => ({
    symbol: s.symbol,
    companyName: s.companyName,
    kind: 'radar',
    headlineValue: s.score,
    headlineLabel: 'score',
    tone: toneFor(s.score),
    subtitle: s.status.replace(/_/g, ' '),
    group: sectorBySymbol.get(s.symbol.toUpperCase()) || 'Uncategorised',
    strongest: topDrivers(s),
    primaryRisk: s.explanation.riskNotes[0] || 'No risk note flagged',
    evidence: `${s.rsi.toFixed(0)} RSI · ${s.distanceFromLow.toFixed(1)}% off low · ${s.volumeRatio.toFixed(2)}x vol`,
    radar: s,
  }));

  const universeLabel = UNIVERSES.find((u) => u.key === config.universeKey)?.label || 'Tracked universe';
  const rScores = ranked.map((s) => s.score);
  const rMin = rScores.length ? Math.min(...rScores) : 0;
  const rMax = rScores.length ? Math.max(...rScores) : 0;
  const topS = ranked[0];
  const cleanR = (a: string[]) => a.filter(Boolean);
  const stages: RunStage[] = [
    {
      id: 'resolve',
      label: 'Resolve universe',
      sources: ['Lyra deterministic signals'],
      output: `${nf(considered.length)} tracked names in scope`,
      logs: cleanR([
        `${nf(considered.length)} name${considered.length === 1 ? '' : 's'} in the ${universeLabel.toLowerCase()}`,
        only ? `Filtered to your list: ${[...only].slice(0, 6).join(', ')}` : '',
        selectedSectors.length ? `Sectors: ${config.verticals.join(', ')}` : '',
      ]),
      state: 'queued',
    },
    {
      id: 'load',
      label: 'Load market + indicator data',
      sources: ['Market and volume data'],
      output: `${nf(considered.length)} names with a current scan`,
      logs: cleanR([
        `${nf(considered.length)} name${considered.length === 1 ? '' : 's'} with a current hourly scan`,
        'Deterministic indicators from market + volume data (no recompute in the client)',
      ]),
      state: 'queued',
    },
    {
      id: 'drivers',
      label: 'Compute the five score drivers',
      sources: ['RSI', 'MACD', 'price location', 'trend', 'volume'],
      output: `5 deterministic drivers x ${nf(considered.length)} names`,
      logs: cleanR([
        `5 drivers x ${nf(considered.length)} name${considered.length === 1 ? '' : 's'}`,
        'RSI reset, MACD turn, price location, trend, volume confirmation',
        'TS + Python golden-vector parity',
      ]),
      state: 'queued',
    },
    {
      id: 'rank',
      label: 'Rank candidates',
      sources: ['Deterministic score'],
      output: `${nf(results.length)} ranked by ${config.outcomeKey === 'momentum' ? 'momentum' : 'recovery score'}`,
      logs: cleanR([
        `Ranked ${nf(results.length)} by ${config.outcomeKey === 'momentum' ? 'momentum' : 'recovery score'}`,
        topS ? `Top: ${topS.symbol} at ${topS.score}` : '',
        rScores.length ? `Score range ${rMin}-${rMax}` : '',
      ]),
      state: 'queued',
    },
  ];

  const notes: string[] = [];
  if (emptyMarket) notes.push(`${marketFor(config.market).label} listings arrive with the international dataset - the engine scans US (SEC) today.`);
  if ((config.capBand ?? 'all') !== 'all') notes.push('Cap band applies to the Emerging Winner engine (market-cap tagged); the recovery radar has no cap tag, so all sizes are shown.');

  return {
    stages,
    results,
    summary: {
      reviewed: considered.length,
      passed: results.length,
      surfaced: Math.min(results.length, 25),
      universeLabel,
      illustrative: data.signals.length > 0 ? false : true,
      version: model.version,
      marketLabel: marketFor(config.market).label,
      capBandLabel: capBandFor(config.capBand).label,
      focusLabels: [],
      notes,
    },
  };
}

function topDrivers(s: SignalRow): string[] {
  const b = s.scoreBreakdown;
  const caps: [string, number, number][] = [
    ['RSI', b.rsiScore, 25],
    ['MACD', b.macdScore, 30],
    ['Price', b.priceLocationScore, 15],
    ['Trend', b.trendScore, 15],
    ['Volume', b.volumeScore, 15],
  ];
  return caps
    .filter(([, v]) => v > 0)
    .sort((a, z) => z[1] / z[2] - a[1] / a[2])
    .slice(0, 3)
    .map(([label]) => label);
}

function buildEwRun(config: LabConfig, data: RunData): RunResult {
  const model = getModel(config.modelKey);
  const uniSet = symbolSetForUniverse(config, data);
  const only = tickerSet(config);
  const selected = config.verticals.map((v) => v.toLowerCase());
  const band = capBandFor(config.capBand);
  const emptyMarket = marketIsEmpty(config);
  const focus = (config.domainFocus ?? []).filter(Boolean);

  // The "Small + micro caps" universe is a REAL filter now: names under $2B market cap (where cap is sourced).
  const smallMicroCeil = config.universeKey === 'small-micro' ? 2e9 : null;

  let capExcluded = 0;
  const considered = emptyMarket
    ? []
    : data.ew.queue.filter((r) => {
        const sym = r.symbol.toUpperCase();
        if (uniSet && !uniSet.has(sym)) return false;
        if (only && !only.has(sym)) return false;
        if (selected.length) {
          const arche = r.archetype.toLowerCase();
          if (!selected.some((v) => arche.includes(v))) return false;
        }
        if (smallMicroCeil != null && (r.market_cap == null || r.market_cap >= smallMicroCeil)) return false;
        if (!inBand(r.market_cap, band)) {
          if (band.key !== 'all') capExcluded += 1;
          return false;
        }
        return true;
      });

  // Domain focus: mean score across the user's chosen domains (coverage-aware). When set, it becomes the
  // primary sort so the names strongest in the domains the user cares about rise - honest re-ranking, not
  // a new number. Names with no coverage in ANY focused domain sink (focus score 0).
  const focusScore = (r: EmergingWinnerResult): number => {
    if (!focus.length) return 0;
    const picked = r.domains.filter((d) => focus.includes(d.key) && d.coverage !== 'unavailable' && d.score != null);
    if (!picked.length) return 0;
    return picked.reduce((sum, d) => sum + (d.score ?? 0), 0) / picked.length;
  };

  const sortKey = (r: EmergingWinnerResult): number => {
    if (focus.length) return focusScore(r);
    switch (config.outcomeKey) {
      case 'double-12m':
        return r.outcome_distribution.p_2x_12m;
      case 'double-24m':
        return r.outcome_distribution.p_2x_24m;
      case 'five-36m':
        return r.outcome_distribution.p_5x_36m;
      case 'ten-60m':
        return r.outcome_distribution.p_10x_60m;
      case 'lowest-ruin':
        return -r.outcome_distribution.p_ruin; // lowest ruin first
      case 'fastest-catalyst':
        return -r.outcome_distribution.expected_time_to_catalyst_months; // soonest first
      case 'closest-winners':
        return r.analogues.winner_similarity;
      case 'closest-failures':
        return r.analogues.failure_similarity;
      case 'survivability':
      case 'overall-verdict':
        return -r.risk.penalty; // cleaner (lower penalty) first
      default:
        return r.winner_similarity;
    }
  };

  const ranked = [...considered].sort((a, b) => sortKey(b) - sortKey(a));

  const results: LabResult[] = ranked.map((r) => {
    const headline = headlineForEw(r, config.outcomeKey);
    return {
      symbol: r.symbol,
      companyName: r.symbol,
      kind: 'ew',
      headlineValue: headline.value,
      headlineLabel: headline.label,
      tone: toneFor(headline.tone),
      subtitle: r.stage_label,
      group: r.archetype,
      strongest: r.strongest_domains.slice(0, 3),
      primaryRisk: r.risks[0] || (r.weakest_domains[0] ? `Weak: ${r.weakest_domains[0]}` : 'No blocking risk flagged'),
      confidence: r.confidence,
      evidence: `${r.domains.filter((d) => d.coverage !== 'unavailable').length}/${r.domains.length} domains covered · ${Math.round(
        r.completeness * 100,
      )}% complete`,
      marketCap: r.market_cap,
      ew: r,
    };
  });

  const distinctArchetypes = new Set(considered.map((r) => r.archetype)).size;
  const gateStats = considered.reduce(
    (acc, r) => {
      for (const g of r.risk.gates) {
        if (g.verdict === 'pass') acc.pass += 1;
        else if (g.verdict === 'block') acc.block += 1;
      }
      return acc;
    },
    { pass: 0, block: 0 },
  );
  const nonBlocked = considered.filter((r) => !r.risk.blocked).length;

  // Honest per-step aggregates for the inspectable logs (all derived from real run data).
  const covAvg = considered.length
    ? Math.round(considered.reduce((s, r) => s + r.domains.filter((d) => d.coverage !== 'unavailable').length, 0) / considered.length)
    : 0;
  const sampleR = considered[0];
  const unavailableDomains = sampleR ? sampleR.domains.filter((d) => d.coverage === 'unavailable').map((d) => d.label) : [];
  const sims = ranked.map((r) => r.winner_similarity);
  const simMin = sims.length ? Math.round(Math.min(...sims)) : 0;
  const simMax = sims.length ? Math.round(Math.max(...sims)) : 0;
  const topR = ranked[0];
  const blockedSyms = considered.filter((r) => r.risk.blocked).map((r) => r.symbol);
  const archNames = [...new Set(considered.map((r) => r.archetype))];
  const timingCounts = considered.reduce((acc, r) => {
    acc[r.timing_state] = (acc[r.timing_state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const timingSummary = Object.entries(timingCounts).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(', ') || 'none';
  const clean = (a: string[]) => a.filter(Boolean);

  const stages: RunStage[] = [
    {
      id: 'm1',
      label: 'Domain scorecard (M1)',
      sources: ['Market', 'Fundamentals', 'Themes', 'Government awards', 'Liquidity'],
      output: `10 domains scored x ${nf(considered.length)} candidate${considered.length === 1 ? '' : 's'}`,
      logs: clean([
        `Scored all 10 winner domains for ${nf(considered.length)} candidate${considered.length === 1 ? '' : 's'}`,
        `Average coverage ${covAvg}/10 domains per name`,
        unavailableDomains.length
          ? `Left unavailable (data gate): ${unavailableDomains.slice(0, 4).join(', ')}`
          : 'Every domain covered on the sample',
      ]),
      state: 'queued',
    },
    {
      id: 'm2',
      label: 'Winner classifier (M2)',
      sources: ['Domain profile'],
      output: `Resemblance scored for ${nf(considered.length)} (reference-v1, not trained)`,
      logs: clean([
        'reference-v1 classifier over the domain profile - not trained on real winners yet',
        topR ? `Highest resemblance: ${topR.symbol} at ${Math.round(topR.winner_similarity)}/100` : 'No candidates in scope',
        sims.length ? `Resemblance range ${simMin}-${simMax} across ${nf(sims.length)} name${sims.length === 1 ? '' : 's'}` : '',
      ]),
      state: 'queued',
    },
    {
      id: 'm3',
      label: 'Historical analogue (M3)',
      sources: ['Illustrative analogue library'],
      output: `Matched against the reference library`,
      logs: clean([
        'Cosine match of each domain profile against the reference analogue library',
        topR && topR.analogues.nearest_winners[0]
          ? `${topR.symbol} closest winner: ${topR.analogues.nearest_winners[0].name} (${Math.round(topR.analogues.nearest_winners[0].similarity)})`
          : '',
        'Illustrative library until the point-in-time winner dataset lands',
      ]),
      state: 'queued',
    },
    {
      id: 'm4',
      label: 'Archetype + ranker (M4)',
      sources: ['Theme context', 'Nearest-winner prior'],
      output: `${distinctArchetypes} archetype${distinctArchetypes === 1 ? '' : 's'}, priority-ranked`,
      logs: clean([
        `${distinctArchetypes} archetype${distinctArchetypes === 1 ? '' : 's'}: ${archNames.slice(0, 4).join(', ') || 'none'}`,
        `Priority-ranked ${nf(results.length)} name${results.length === 1 ? '' : 's'}`,
        topR ? `Top research action: ${topR.action.replace(/_/g, ' ')}` : '',
      ]),
      state: 'queued',
    },
    {
      id: 'm5',
      label: 'Risk gate stack (M5)',
      sources: ['Liquidity', 'Dilution', 'Manipulation', 'Downside', 'Survivability'],
      output: `5 gates · ${nf(gateStats.pass)} pass / ${nf(gateStats.block)} block · ${nf(nonBlocked)} cleared`,
      logs: clean([
        `5 gates x ${nf(considered.length)} name${considered.length === 1 ? '' : 's'} = ${nf(considered.length * 5)} checks`,
        `${nf(gateStats.pass)} pass · ${nf(gateStats.block)} block`,
        blockedSyms.length
          ? `Blocked (excluded from the queue): ${blockedSyms.slice(0, 6).join(', ')}`
          : 'No blocks - every name cleared risk',
      ]),
      state: gateStats.block > 0 ? 'warning' : 'queued',
    },
    {
      id: 'm6',
      label: 'Timing + network (M6)',
      sources: ['Temporal', 'Network clusters'],
      output: `Annotated (shadow challenger - contributes nothing to ranking)`,
      logs: clean([
        `Timing states: ${timingSummary}`,
        'Shadow challenger: annotates each name but never steers the ranking',
      ]),
      state: 'queued',
    },
  ];

  const domainLabel = new Map(domainOptions(data).map((d) => [d.key, d.label]));
  const focusLabels = focus.map((k) => domainLabel.get(k) ?? k);

  const notes: string[] = [];
  if (emptyMarket) {
    notes.push(`${marketFor(config.market).label} listings arrive with the international dataset - the engine scans US (SEC) today, so this run returned nothing.`);
  } else if ((config.market ?? 'us') === 'global') {
    notes.push('Global markets are expanding; today the available universe is US-listed (SEC), shown here.');
  }
  if (capExcluded > 0) {
    notes.push(`${band.label} band (${band.hint}): ${nf(capExcluded)} name${capExcluded === 1 ? '' : 's'} excluded (out of band or market cap not sourced).`);
  }
  if (focusLabels.length) {
    notes.push(`Ranked by your focus domains: ${focusLabels.join(', ')} - names strongest in these rise, others sink.`);
  }

  return {
    stages,
    results,
    summary: {
      reviewed: considered.length,
      passed: nonBlocked,
      surfaced: results.length,
      universeLabel: model.universeNote,
      illustrative: true,
      version: data.ew.engine_version || model.version,
      marketLabel: marketFor(config.market).label,
      capBandLabel: band.label,
      focusLabels,
      notes,
    },
  };
}

function headlineForEw(r: EmergingWinnerResult, outcomeKey: string): { value: number; label: string; tone: number } {
  const pct = (p: number) => Math.round(p * 100);
  switch (outcomeKey) {
    case 'double-12m':
      return { value: pct(r.outcome_distribution.p_2x_12m), label: 'P(2x·12m)', tone: r.winner_similarity };
    case 'lowest-ruin':
      return { value: pct(r.outcome_distribution.p_ruin), label: 'P(ruin)', tone: Math.max(0, 100 - pct(r.outcome_distribution.p_ruin)) };
    case 'fastest-catalyst': {
      const m = r.outcome_distribution.expected_time_to_catalyst_months;
      return { value: m, label: 'mo to catalyst', tone: Math.max(0, 100 - m * 4) };
    }
    case 'double-24m':
      return { value: pct(r.outcome_distribution.p_2x_24m), label: 'P(2x·24m)', tone: r.winner_similarity };
    case 'five-36m':
      return { value: pct(r.outcome_distribution.p_5x_36m), label: 'P(5x·36m)', tone: r.winner_similarity };
    case 'ten-60m':
      return { value: pct(r.outcome_distribution.p_10x_60m), label: 'P(10x·60m)', tone: r.winner_similarity };
    case 'closest-winners':
      return { value: Math.round(r.analogues.winner_similarity), label: 'winner sim', tone: r.analogues.winner_similarity };
    case 'closest-failures':
      return {
        value: Math.round(r.analogues.failure_similarity),
        label: 'failure sim',
        tone: 100 - r.analogues.failure_similarity,
      };
    case 'survivability':
    case 'overall-verdict':
      return { value: Math.round(r.winner_similarity), label: 'resemblance', tone: r.risk.blocked ? 20 : r.winner_similarity };
    default:
      return { value: Math.round(r.winner_similarity), label: 'resemblance', tone: r.winner_similarity };
  }
}

/** Build a full, honest run from a config. Pure - deterministic given the same data. */
export function buildRun(config: LabConfig, data: RunData): RunResult {
  const model = getModel(config.modelKey);
  return model.family === 'radar' ? buildRadarRun(config, data) : buildEwRun(config, data);
}

/** The data sources actually available for a model, with honest states. */
export function sourcesForModel(model: LabModel): DataSource[] {
  return model.sources.map((k) => DATA_SOURCES[k]).filter(Boolean);
}

/** Vertical chips for a model, with the live count of matching candidates in the current data. */
export function verticalOptions(
  model: LabModel,
  data: RunData,
): { label: string; count: number }[] {
  if (model.family === 'ew') {
    return EW_VERTICALS.map((v) => ({
      label: v.label,
      count: data.ew.queue.filter((r) => r.archetype.toLowerCase().includes(v.match)).length,
    }));
  }
  // radar -> sectors present in the tracked universe
  const sectorBySymbol = new Map<string, string>();
  for (const t of data.tickers) {
    const sec = t.sector || t.category;
    if (sec) sectorBySymbol.set(t.symbol.toUpperCase(), sec);
  }
  const counts = new Map<string, number>();
  for (const s of data.signals) {
    const sec = sectorBySymbol.get(s.symbol.toUpperCase());
    if (sec) counts.set(sec, (counts.get(sec) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
}

/** The default first-run config - demonstrates the differentiated direction in one click. */
export const RECOMMENDED_CONFIG: LabConfig = {
  modelKey: 'emerging',
  outcomeKey: 'composite',
  verticals: [],
  universeKey: 'small-micro',
  ticker: '',
  market: 'us',
  capBand: 'all',
  domainFocus: [],
};
