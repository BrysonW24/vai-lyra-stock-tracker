import { describe, it, expect } from 'vitest';
import { buildRun, verticalOptions, getModel, RECOMMENDED_CONFIG, LAB_MODELS, type LabConfig, type RunData } from '../lab';
import type { SignalRow } from '@/types/scanner';
import type { EmergingWinnerResult, EmergingWinnerQueue } from '@/lib/emerging-winner/types';

/**
 * The run engine is the honesty seam of the Model Lab: it must rank real data and report only real
 * counts. These tests pin the invariant - reviewed == candidates in scope (never an invented 428),
 * ranking is by the chosen outcome, and the EW family is always flagged illustrative.
 */

function sig(symbol: string, score: number, over: Partial<SignalRow> = {}): SignalRow {
  return {
    symbol,
    companyName: `${symbol} Inc`,
    score,
    scoreDelta: 0,
    status: 'strong_setup',
    actionState: 'buy_review',
    lifecycleState: 'new_signal',
    signalType: 'oversold_recovery',
    scoreBreakdown: { rsiScore: 20, macdScore: 20, priceLocationScore: 10, trendScore: 10, volumeScore: 5 },
    close: 10,
    priceChange1h: 0,
    priceChange1d: 0,
    rsi: 42,
    previousRsi: 40,
    rsiDelta: 2,
    macdHistogram: -0.1,
    previousMacdHistogram: -0.2,
    histDelta: 0.1,
    macdState: 'improving',
    histogramSlope: 0.1,
    volumeRatio: 1.2,
    distanceFromLow: 5,
    priceVsSma20: 1,
    priceVsSma50: -1,
    priceVsSma200: 2,
    lastAlert: null,
    lastUpdated: '2026-08-01T00:00:00Z',
    explanation: { triggeredBecause: ['reset-band RSI'], missingConfirmation: [], riskNotes: ['thin liquidity'], action: 'buy_review' },
    summary: { rsi: '', macd: '', volume: '', trend: '', price: '' },
    ...over,
  };
}

function ewr(symbol: string, sim: number, archetype: string, over: Partial<EmergingWinnerResult> = {}): EmergingWinnerResult {
  return {
    symbol,
    engine_version: 'reference-v1',
    generated_at: '2026-08-01T00:00:00Z',
    winner_similarity: sim,
    probability: 0.1,
    ordinal_stage: 2,
    stage_label: 'strong',
    confidence: 'medium',
    completeness: 0.8,
    archetype,
    archetype_confidence: 'medium',
    market_cap: null,
    domain_composite: 60,
    present_traits: [],
    strongest_domains: ['Technical', 'Theme'],
    weakest_domains: ['Capital'],
    missing_domains: [],
    contributions: [{ domain: 'technical', label: 'Technical', contribution: 12 }],
    domains: [{ key: 'technical', label: 'Technical', score: 70, coverage: 'full', reason: '', subsignals: [] }],
    analogues: {
      nearest_winners: [{ name: 'AlphaWave (ref)', archetype, era: '2016', label: 'winner', similarity: 80 }],
      nearest_failures: [],
      winner_similarity: 80,
      failure_similarity: 20,
      winner_failure_ratio: 4,
      present_that_winners_had: [],
      missing_vs_top_winner: [],
      provenance: 'illustrative reference seed',
    },
    outcome_distribution: {
      p_2x_24m: 0.2,
      p_5x_36m: 0.1,
      p_10x_60m: 0.05,
      p_ruin: 0.15,
      survivability: 'medium',
      expected_time_to_catalyst_months: 12,
      expected_max_drawdown_pct: 40,
      provenance: 'coarse distribution',
    },
    risk: { verdict: 'pass', penalty: 0, blocked: false, gates: [{ key: 'liq', label: 'Liquidity', verdict: 'pass', penalty: 0, reasons: [] }] },
    priority_score: 50,
    action: 'deep_research',
    ranking_signals: {},
    surfaced: true,
    timing_state: 'accelerating',
    timing: { timing_state: 'accelerating', timing_score: 60, catalyst_window: 'near', network_state: 'clustered', network_score: 50, network_notes: [], challenger_note: '', provenance: '' },
    risks: ['thin float'],
    ...over,
  };
}

function queue(results: EmergingWinnerResult[], demo = true): EmergingWinnerQueue {
  return { queue: results, generated_at: '2026-08-01T00:00:00Z', engine_version: 'reference-v1', demo, note: '' };
}

function data(over: Partial<RunData> = {}): RunData {
  return {
    signals: [],
    tickers: [],
    ew: queue([]),
    watchlist: [],
    portfolio: [],
    ...over,
  };
}

describe('buildRun - radar family (Oversold Recovery)', () => {
  const cfg: LabConfig = { modelKey: 'oversold', outcomeKey: 'recovery-score', verticals: [], universeKey: 'tracked', ticker: '' };

  it('ranks by score and reports only real counts', () => {
    const d = data({ signals: [sig('AAA', 40), sig('BBB', 80), sig('CCC', 60)] });
    const run = buildRun(cfg, d);
    expect(run.results.map((r) => r.symbol)).toEqual(['BBB', 'CCC', 'AAA']);
    expect(run.summary.reviewed).toBe(3); // never a fabricated universe size
    expect(run.summary.illustrative).toBe(false); // real tracked signals
    expect(run.stages.length).toBe(4);
    expect(run.stages[0].output).toContain('3');
  });

  it('honours a ticker filter', () => {
    const d = data({ signals: [sig('AAA', 40), sig('BBB', 80)] });
    const run = buildRun({ ...cfg, ticker: 'bbb' }, d);
    expect(run.results.map((r) => r.symbol)).toEqual(['BBB']);
    expect(run.summary.reviewed).toBe(1);
  });
});

describe('buildRun - EW family (Emerging Winner)', () => {
  const cfg: LabConfig = { modelKey: 'emerging', outcomeKey: 'composite', verticals: [], universeKey: 'tracked', ticker: '' };

  it('ranks by resemblance and is always flagged illustrative', () => {
    const d = data({ ew: queue([ewr('QBIT', 55, 'Quantum Infrastructure'), ewr('AIX', 88, 'AI Infrastructure Enabler')]) });
    const run = buildRun(cfg, d);
    expect(run.results.map((r) => r.symbol)).toEqual(['AIX', 'QBIT']);
    expect(run.summary.illustrative).toBe(true);
    expect(run.stages.length).toBe(6); // the six-model pipeline
    expect(run.summary.reviewed).toBe(2);
  });

  it('filters by vertical/archetype', () => {
    const d = data({ ew: queue([ewr('QBIT', 55, 'Quantum Infrastructure'), ewr('AIX', 88, 'AI Infrastructure Enabler')]) });
    const run = buildRun({ ...cfg, verticals: ['Quantum'] }, d);
    expect(run.results.map((r) => r.symbol)).toEqual(['QBIT']);
  });

  it('surfaces real gate stats in the risk stage', () => {
    const blocked = ewr('BAD', 30, 'Speculative narrative', {
      risk: { verdict: 'block', penalty: 50, blocked: true, gates: [{ key: 'liq', label: 'Liquidity', verdict: 'block', penalty: 50, reasons: ['thin'] }] },
    });
    const d = data({ ew: queue([ewr('AIX', 88, 'AI Infrastructure Enabler'), blocked]) });
    const run = buildRun(cfg, d);
    const gateStage = run.stages.find((s) => s.id === 'm5');
    expect(gateStage?.state).toBe('warning');
    expect(gateStage?.output).toContain('block');
    expect(run.summary.passed).toBe(1); // one non-blocked
  });
});

describe('buildRun - EW controls (market / cap / focus / curated list)', () => {
  const base: LabConfig = { modelKey: 'emerging', outcomeKey: 'composite', verticals: [], universeKey: 'tracked', ticker: '' };
  const dom = (key: string, label: string, score: number | null, coverage: 'full' | 'unavailable' = 'full') => ({
    key,
    label,
    score,
    coverage,
    reason: '',
    subsignals: [],
  });

  it('threads real market cap onto the result', () => {
    const d = data({ ew: queue([ewr('MC', 60, 'AI Infrastructure Enabler', { market_cap: 1_500_000_000 })]) });
    const run = buildRun(base, d);
    expect(run.results[0].marketCap).toBe(1_500_000_000);
  });

  it('filters by market-cap band and excludes unknown-cap names from a specific band', () => {
    const d = data({
      ew: queue([
        ewr('MIC', 50, 'AI', { market_cap: 100e6 }),
        ewr('MID', 90, 'AI', { market_cap: 5e9 }),
        ewr('UNK', 70, 'AI', { market_cap: null }),
      ]),
    });
    const run = buildRun({ ...base, capBand: 'micro' }, d);
    expect(run.results.map((r) => r.symbol)).toEqual(['MIC']);
    expect(run.summary.notes?.some((n) => /Micro/.test(n))).toBe(true);
  });

  it('returns an honest empty set with a note for a non-US market', () => {
    const d = data({ ew: queue([ewr('AIX', 88, 'AI Infrastructure Enabler', { market_cap: 2e9 })]) });
    const run = buildRun({ ...base, market: 'kr' }, d);
    expect(run.results.length).toBe(0);
    expect(run.summary.notes?.some((n) => /international dataset/.test(n))).toBe(true);
  });

  it('runs US data for the global market with an expansion note', () => {
    const d = data({ ew: queue([ewr('AIX', 88, 'AI Infrastructure Enabler', { market_cap: 2e9 })]) });
    const run = buildRun({ ...base, market: 'global' }, d);
    expect(run.results.map((r) => r.symbol)).toEqual(['AIX']);
    expect(run.summary.notes?.some((n) => /Global markets/.test(n))).toBe(true);
  });

  it('re-ranks by focus domains, overriding the outcome sort', () => {
    const a = ewr('AAA', 40, 'AI', { domains: [dom('technical', 'Technical', 20), dom('theme', 'Theme', 90)] });
    const b = ewr('BBB', 95, 'AI', { domains: [dom('technical', 'Technical', 95), dom('theme', 'Theme', 10)] });
    const d = data({ ew: queue([a, b]) });
    // Without focus, BBB (higher resemblance) leads.
    expect(buildRun(base, d).results.map((r) => r.symbol)).toEqual(['BBB', 'AAA']);
    // Focused on Theme, AAA (strong theme) leads despite lower resemblance.
    const focused = buildRun({ ...base, domainFocus: ['theme'] }, d);
    expect(focused.results.map((r) => r.symbol)).toEqual(['AAA', 'BBB']);
    expect(focused.summary.focusLabels).toEqual(['Theme']);
  });

  it('honours a curated multi-ticker list', () => {
    const d = data({ ew: queue([ewr('AAA', 50, 'AI'), ewr('BBB', 60, 'AI'), ewr('CCC', 70, 'AI')]) });
    const run = buildRun({ ...base, ticker: 'aaa, bbb' }, d);
    expect(run.results.map((r) => r.symbol).sort()).toEqual(['AAA', 'BBB']);
  });
});

describe('lab metadata', () => {
  it('exposes exactly four models and a runnable recommended default', () => {
    expect(LAB_MODELS.map((m) => m.key)).toEqual(['oversold', 'emerging', 'analogue', 'risk-gate']);
    const model = getModel(RECOMMENDED_CONFIG.modelKey);
    const outcome = model.outcomes.find((o) => o.key === RECOMMENDED_CONFIG.outcomeKey);
    expect(outcome?.runnable).toBe(true);
  });

  it('counts matching candidates per vertical chip', () => {
    const d = data({ ew: queue([ewr('QBIT', 55, 'Quantum Infrastructure'), ewr('Q2', 60, 'Quantum Infrastructure')]) });
    const opts = verticalOptions(getModel('emerging'), d);
    expect(opts.find((o) => o.label === 'Quantum')?.count).toBe(2);
    expect(opts.find((o) => o.label === 'Robotics')?.count).toBe(0);
  });
});
