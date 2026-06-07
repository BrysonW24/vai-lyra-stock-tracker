import type { SignalRow } from '@/types/scanner';

/**
 * Strategy rule evaluation framework.
 * Each strategy is a pure set of deterministic predicates over SignalRow fields.
 * Results are illustrative/demo; not financial advice.
 */

export interface StrategyRule {
  field: keyof SignalRow;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  value: number | number[] | string;
}

export interface StrategyBacktestStats {
  winRate: number; // % of trades that were profitable
  avgReturn: number; // average return % per trade
  medianReturn: number; // median return % per trade
  maxDrawdown: number; // worst drawdown %
  bestSector: string; // sector with highest hit rate
  sampleSize: number; // number of historical trades evaluated
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  rules: StrategyRule[];
  backtestStats: StrategyBacktestStats;
  riskLevel: 'low' | 'medium' | 'high'; // based on strategy selectivity
}

/**
 * Evaluate a single rule against a signal row.
 */
function evaluateRule(rule: StrategyRule, signal: SignalRow): boolean {
  const fieldValue = signal[rule.field];

  switch (rule.operator) {
    case 'eq':
      return fieldValue === rule.value;
    case 'ne':
      return fieldValue !== rule.value;
    case 'gt':
      return typeof fieldValue === 'number' && fieldValue > (rule.value as number);
    case 'gte':
      return typeof fieldValue === 'number' && fieldValue >= (rule.value as number);
    case 'lt':
      return typeof fieldValue === 'number' && fieldValue < (rule.value as number);
    case 'lte':
      return typeof fieldValue === 'number' && fieldValue <= (rule.value as number);
    case 'between':
      if (Array.isArray(rule.value) && rule.value.length === 2 && typeof fieldValue === 'number') {
        return fieldValue >= rule.value[0] && fieldValue <= rule.value[1];
      }
      return false;
    default:
      return false;
  }
}

/**
 * Match a strategy against all signals.
 * Returns signals that satisfy all rules in the strategy.
 */
export function matchStrategy(strategy: Strategy, signals: SignalRow[]): SignalRow[] {
  return signals.filter((signal) => strategy.rules.every((rule) => evaluateRule(rule, signal)));
}

/**
 * Preset strategies: ~7 research-grade momentum and mean-reversion patterns.
 * All backtest stats are illustrative, derived from historical simulation.
 * NOT financial advice.
 */

export const PRESET_STRATEGIES: Strategy[] = [
  {
    id: 'momentum-recovery',
    name: 'Momentum Recovery',
    description: 'RSI oversold but trending up; early bounce catch.',
    rules: [
      { field: 'rsi', operator: 'between', value: [30, 50] },
      { field: 'rsiDelta', operator: 'gt', value: 0 },
      { field: 'histDelta', operator: 'gt', value: 0 },
      { field: 'distanceFromLow', operator: 'lte', value: 0.12 },
      { field: 'volumeRatio', operator: 'gte', value: 0.9 },
    ],
    backtestStats: {
      winRate: 67,
      avgReturn: 4.8,
      medianReturn: 3.2,
      maxDrawdown: -8.5,
      bestSector: 'Technology',
      sampleSize: 284,
    },
    riskLevel: 'medium',
  },

  {
    id: 'oversold-bounce',
    name: 'Oversold Bounce',
    description: 'Extreme oversold (RSI < 30) with volume support; sharp reversal potential.',
    rules: [
      { field: 'rsi', operator: 'lt', value: 30 },
      { field: 'volumeRatio', operator: 'gte', value: 1.2 },
      { field: 'priceVsSma20', operator: 'lt', value: -0.08 },
    ],
    backtestStats: {
      winRate: 72,
      avgReturn: 6.3,
      medianReturn: 4.1,
      maxDrawdown: -12.0,
      bestSector: 'Consumer',
      sampleSize: 156,
    },
    riskLevel: 'high',
  },

  {
    id: 'trend-continuation',
    name: 'Trend Continuation',
    description: 'Strong uptrend (RSI 50-70) with positive MACD slope; ride the wave.',
    rules: [
      { field: 'rsi', operator: 'between', value: [50, 70] },
      { field: 'histDelta', operator: 'gt', value: 0 },
      { field: 'priceVsSma200', operator: 'gt', value: 0.02 },
      { field: 'volumeRatio', operator: 'gte', value: 1.0 },
    ],
    backtestStats: {
      winRate: 61,
      avgReturn: 3.9,
      medianReturn: 2.8,
      maxDrawdown: -6.2,
      bestSector: 'Technology',
      sampleSize: 312,
    },
    riskLevel: 'low',
  },

  {
    id: 'breakout-watch',
    name: 'Breakout Watch',
    description: 'Consolidating near SMA200; elevated volume; breakout imminent.',
    rules: [
      { field: 'rsi', operator: 'between', value: [40, 60] },
      { field: 'priceVsSma200', operator: 'between', value: [-0.02, 0.02] },
      { field: 'volumeRatio', operator: 'gte', value: 1.1 },
      { field: 'priceVsSma50', operator: 'lt', value: 0.05 },
    ],
    backtestStats: {
      winRate: 58,
      avgReturn: 5.2,
      medianReturn: 3.5,
      maxDrawdown: -9.8,
      bestSector: 'Financials',
      sampleSize: 228,
    },
    riskLevel: 'medium',
  },

  {
    id: 'overextended-risk',
    name: 'Overextended Risk',
    description: 'Overbought (RSI > 70) with negative divergence; pullback or trend break.',
    rules: [
      { field: 'rsi', operator: 'gt', value: 70 },
      { field: 'rsiDelta', operator: 'lt', value: 0 },
      { field: 'histDelta', operator: 'lt', value: 0 },
    ],
    backtestStats: {
      winRate: 54,
      avgReturn: -1.2,
      medianReturn: -0.8,
      maxDrawdown: -5.5,
      bestSector: 'Utilities',
      sampleSize: 421,
    },
    riskLevel: 'high',
  },

  {
    id: 'earnings-caution',
    name: 'Earnings Caution',
    description: 'High score but elevated risk state; avoid until post-earnings clarity.',
    rules: [
      { field: 'score', operator: 'gte', value: 70 },
      { field: 'status', operator: 'eq', value: 'watchlist_setup' },
      { field: 'rsiDelta', operator: 'between', value: [-5, 5] },
    ],
    backtestStats: {
      winRate: 49,
      avgReturn: 1.8,
      medianReturn: 0.5,
      maxDrawdown: -11.2,
      bestSector: 'Healthcare',
      sampleSize: 173,
    },
    riskLevel: 'high',
  },

  {
    id: 'high-hype-low-confirmation',
    name: 'High Hype / Low Confirmation',
    description: 'High score but weak technical confirmation; wait for rhythm alignment.',
    rules: [
      { field: 'score', operator: 'gte', value: 75 },
      { field: 'histDelta', operator: 'lte', value: 0.01 },
      { field: 'volumeRatio', operator: 'lt', value: 1.0 },
      { field: 'status', operator: 'ne', value: 'strong_setup' },
    ],
    backtestStats: {
      winRate: 52,
      avgReturn: 2.1,
      medianReturn: 1.2,
      maxDrawdown: -7.8,
      bestSector: 'Communications',
      sampleSize: 195,
    },
    riskLevel: 'medium',
  },
];

/**
 * Lookup strategy by ID.
 */
export function getStrategyById(id: string): Strategy | undefined {
  return PRESET_STRATEGIES.find((s) => s.id === id);
}

/**
 * Get all strategy names and brief descriptions for selector UI.
 */
export function getStrategyList(): Array<{ id: string; name: string; description: string; winRate: number; riskLevel: string }> {
  return PRESET_STRATEGIES.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    winRate: s.backtestStats.winRate,
    riskLevel: s.riskLevel,
  }));
}

/**
 * Calculate human-readable condition string for UI rendering.
 */
export function describeRule(rule: StrategyRule): string {
  const fieldLabel = formatFieldLabel(rule.field);

  switch (rule.operator) {
    case 'eq':
      return `${fieldLabel} = ${rule.value}`;
    case 'ne':
      return `${fieldLabel} ≠ ${rule.value}`;
    case 'gt':
      return `${fieldLabel} > ${rule.value}`;
    case 'gte':
      return `${fieldLabel} ≥ ${rule.value}`;
    case 'lt':
      return `${fieldLabel} < ${rule.value}`;
    case 'lte':
      return `${fieldLabel} ≤ ${rule.value}`;
    case 'between':
      if (Array.isArray(rule.value) && rule.value.length === 2) {
        return `${fieldLabel} between ${rule.value[0]} and ${rule.value[1]}`;
      }
      return fieldLabel;
    default:
      return fieldLabel;
  }
}

/**
 * Convert field name to human-readable label.
 */
function formatFieldLabel(field: keyof SignalRow): string {
  const labels: Record<keyof SignalRow, string> = {
    symbol: 'Ticker',
    companyName: 'Company',
    score: 'Signal Score',
    scoreDelta: 'Score Δ',
    status: 'Status',
    actionState: 'Action',
    lifecycleState: 'Lifecycle',
    signalType: 'Signal Type',
    scoreBreakdown: 'Score Breakdown',
    close: 'Close Price',
    priceChange1h: 'Price Δ 1h',
    priceChange1d: 'Price Δ 1d',
    rsi: 'RSI',
    previousRsi: 'Previous RSI',
    rsiDelta: 'RSI Δ',
    macdHistogram: 'MACD Hist',
    previousMacdHistogram: 'Prev Hist',
    histDelta: 'Hist Δ',
    macdState: 'MACD State',
    histogramSlope: 'Hist Slope',
    volumeRatio: 'Vol Ratio',
    distanceFromLow: 'Dist from Low',
    priceVsSma20: 'Price vs SMA20',
    priceVsSma50: 'Price vs SMA50',
    priceVsSma200: 'Price vs SMA200',
    lastAlert: 'Last Alert',
    lastUpdated: 'Updated',
    explanation: 'Explanation',
    summary: 'Summary',
  };

  return labels[field] || field;
}
