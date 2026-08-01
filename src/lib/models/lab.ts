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
    universeNote: 'Illustrative reference universe (until the data gate)',
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
      { key: 'double-24m', label: 'Double (2x) within 24 months', sub: 'Reference-v1 probability', runnable: true },
      { key: 'five-36m', label: '5x within 36 months', sub: 'Reference-v1 probability', runnable: true },
      { key: 'ten-60m', label: '10x within 60 months', sub: 'Reference-v1 probability', runnable: true },
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
    universeNote: 'Illustrative reference universe (until the data gate)',
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
    real: false,
    note: 'Target universe. Resolves to the available set until the small-cap dataset lands.',
  },
];

// ---------------------------------------------------------------------------
// Run engine - pure, honest
// ---------------------------------------------------------------------------

export interface LabConfig {
  modelKey: string;
  outcomeKey: string;
  verticals: string[]; // vertical labels
  universeKey: string;
  ticker: string;
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

function tickerFilter(config: LabConfig): string | null {
  const t = config.ticker.trim().toUpperCase();
  return t.length ? t : null;
}

function buildRadarRun(config: LabConfig, data: RunData): RunResult {
  const model = getModel(config.modelKey);
  const sectorBySymbol = new Map<string, string>();
  for (const t of data.tickers) {
    const sec = t.sector || t.category;
    if (sec) sectorBySymbol.set(t.symbol.toUpperCase(), sec);
  }

  const uniSet = symbolSetForUniverse(config, data);
  const only = tickerFilter(config);
  const selectedSectors = config.verticals.map((v) => v.toLowerCase());

  const considered = data.signals.filter((s) => {
    const sym = s.symbol.toUpperCase();
    if (uniSet && !uniSet.has(sym)) return false;
    if (only && sym !== only) return false;
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
  const stages: RunStage[] = [
    {
      id: 'resolve',
      label: 'Resolve universe',
      sources: ['Lyra deterministic signals'],
      output: `${nf(considered.length)} tracked names in scope`,
      state: 'queued',
    },
    {
      id: 'load',
      label: 'Load market + indicator data',
      sources: ['Market and volume data'],
      output: `${nf(considered.length)} names with a current scan`,
      state: 'queued',
    },
    {
      id: 'drivers',
      label: 'Compute the five score drivers',
      sources: ['RSI', 'MACD', 'price location', 'trend', 'volume'],
      output: `5 deterministic drivers x ${nf(considered.length)} names`,
      state: 'queued',
    },
    {
      id: 'rank',
      label: 'Rank candidates',
      sources: ['Deterministic score'],
      output: `${nf(results.length)} ranked by ${config.outcomeKey === 'momentum' ? 'momentum' : 'recovery score'}`,
      state: 'queued',
    },
  ];

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
  const only = tickerFilter(config);
  const selected = config.verticals.map((v) => v.toLowerCase());

  const considered = data.ew.queue.filter((r) => {
    const sym = r.symbol.toUpperCase();
    if (uniSet && !uniSet.has(sym)) return false;
    if (only && sym !== only) return false;
    if (selected.length) {
      const arche = r.archetype.toLowerCase();
      const matches = selected.some((v) => arche.includes(v));
      if (!matches) return false;
    }
    return true;
  });

  const sortKey = (r: EmergingWinnerResult): number => {
    switch (config.outcomeKey) {
      case 'double-24m':
        return r.outcome_distribution.p_2x_24m;
      case 'five-36m':
        return r.outcome_distribution.p_5x_36m;
      case 'ten-60m':
        return r.outcome_distribution.p_10x_60m;
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

  const stages: RunStage[] = [
    {
      id: 'm1',
      label: 'Domain scorecard (M1)',
      sources: ['Market', 'Fundamentals', 'Themes', 'Government awards', 'Liquidity'],
      output: `10 domains scored x ${nf(considered.length)} candidate${considered.length === 1 ? '' : 's'}`,
      state: 'queued',
    },
    {
      id: 'm2',
      label: 'Winner classifier (M2)',
      sources: ['Domain profile'],
      output: `Resemblance scored for ${nf(considered.length)} (reference-v1, not trained)`,
      state: 'queued',
    },
    {
      id: 'm3',
      label: 'Historical analogue (M3)',
      sources: ['Illustrative analogue library'],
      output: `Matched against the reference library`,
      state: 'queued',
    },
    {
      id: 'm4',
      label: 'Archetype + ranker (M4)',
      sources: ['Theme context', 'Nearest-winner prior'],
      output: `${distinctArchetypes} archetype${distinctArchetypes === 1 ? '' : 's'}, priority-ranked`,
      state: 'queued',
    },
    {
      id: 'm5',
      label: 'Risk gate stack (M5)',
      sources: ['Liquidity', 'Dilution', 'Manipulation', 'Downside', 'Survivability'],
      output: `5 gates · ${nf(gateStats.pass)} pass / ${nf(gateStats.block)} block · ${nf(nonBlocked)} cleared`,
      state: gateStats.block > 0 ? 'warning' : 'queued',
    },
    {
      id: 'm6',
      label: 'Timing + network (M6)',
      sources: ['Temporal', 'Network clusters'],
      output: `Annotated (shadow challenger - contributes nothing to ranking)`,
      state: 'queued',
    },
  ];

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
    },
  };
}

function headlineForEw(r: EmergingWinnerResult, outcomeKey: string): { value: number; label: string; tone: number } {
  const pct = (p: number) => Math.round(p * 100);
  switch (outcomeKey) {
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
};
