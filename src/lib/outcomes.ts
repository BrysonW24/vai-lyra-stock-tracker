/**
 * Outcome distribution types and demo data.
 *
 * Represents aggregated forward-return statistics for past similar setups,
 * enabling feedback loops like "past strong_setup momentum_recovery signals
 * returned median 6.4% over 20 days with 71% win rate."
 *
 * DEMO ONLY: These are research-quality synthetic distributions based on
 * backtesting patterns. Not investment advice.
 */
import { computeExpectancy, type ExpectancyInput } from './edge/expectancy';

export interface OutcomeDistribution {
  signalType: string;
  signalStatus: string;
  sampleSize: number;
  return1dMedian: number | null;
  return5dMedian: number | null;
  return20dMedian: number | null;
  return60dMedian: number | null;
  return1dWinRate: number;
  return5dWinRate: number;
  return20dWinRate: number;
  return60dWinRate: number;
  maxUpsideMedian: number | null;
  worstDrawdownMin: number | null;
  /**
   * Where these numbers came from. 'illustrative' = hand-authored demo base rates that have
   * NOT been measured (the honest default until the outcome-labeling loop populates real
   * history); 'measured' = aggregated from real signal_outcomes rows. The UI must surface this
   * so a user never mistakes a placeholder win rate for proven history.
   */
  provenance: 'illustrative' | 'measured';
}

/**
 * Demo outcome distributions for backtested signal types.
 *
 * Horizon assumptions:
 * - 1d: 7 hourly bars (~1 trading day)
 * - 5d: 35 hourly bars (~1 trading week)
 * - 20d: 140 hourly bars (~1 trading month)
 * - 60d: 420 hourly bars (~1 trading quarter)
 *
 * Sample sizes represent historical signal count for each type/status combo.
 * Data is synthetic for demo; live backfill from signal_outcomes table
 * will replace these values.
 */
const DEMO_OUTCOMES: Record<string, Omit<OutcomeDistribution, 'provenance'>> = {
  "momentum_recovery_v1|strong_setup": {
    signalType: "momentum_recovery_v1",
    signalStatus: "strong_setup",
    sampleSize: 23,
    return1dMedian: 0.8,
    return5dMedian: 3.2,
    return20dMedian: 6.4,
    return60dMedian: 11.2,
    return1dWinRate: 65.2,
    return5dWinRate: 69.6,
    return20dWinRate: 73.9,
    return60dWinRate: 78.3,
    maxUpsideMedian: 12.7,
    worstDrawdownMin: -7.1,
  },
  "momentum_recovery_v1|watchlist_setup": {
    signalType: "momentum_recovery_v1",
    signalStatus: "watchlist_setup",
    sampleSize: 18,
    return1dMedian: 0.3,
    return5dMedian: 1.8,
    return20dMedian: 3.9,
    return60dMedian: 7.2,
    return1dWinRate: 55.6,
    return5dWinRate: 61.1,
    return20dWinRate: 66.7,
    return60dWinRate: 72.2,
    maxUpsideMedian: 8.3,
    worstDrawdownMin: -5.4,
  },
  "momentum_recovery_v1|no_signal": {
    signalType: "momentum_recovery_v1",
    signalStatus: "no_signal",
    sampleSize: 156,
    return1dMedian: 0.1,
    return5dMedian: 0.5,
    return20dMedian: 1.2,
    return60dMedian: 2.8,
    return1dWinRate: 50.6,
    return5dWinRate: 52.6,
    return20dWinRate: 54.5,
    return60dWinRate: 57.7,
    maxUpsideMedian: 4.2,
    worstDrawdownMin: -8.9,
  },
  "momentum_recovery_v1|weakening": {
    signalType: "momentum_recovery_v1",
    signalStatus: "weakening",
    sampleSize: 14,
    return1dMedian: -0.6,
    return5dMedian: -1.2,
    return20dMedian: -1.8,
    return60dMedian: -0.5,
    return1dWinRate: 35.7,
    return5dWinRate: 28.6,
    return20dWinRate: 21.4,
    return60dWinRate: 42.9,
    maxUpsideMedian: 3.1,
    worstDrawdownMin: -11.3,
  },
  "momentum_recovery_v1|invalidated": {
    signalType: "momentum_recovery_v1",
    signalStatus: "invalidated",
    sampleSize: 12,
    return1dMedian: -0.9,
    return5dMedian: -1.6,
    return20dMedian: -2.3,
    return60dMedian: -1.1,
    return1dWinRate: 25.0,
    return5dWinRate: 16.7,
    return20dWinRate: 8.3,
    return60dWinRate: 33.3,
    maxUpsideMedian: 2.5,
    worstDrawdownMin: -13.7,
  },
};

/**
 * Get outcome distribution for a signal type.
 *
 * Returns demo data by key "signal_type|signal_status".
 * When live backfill populates signal_outcomes table, this will
 * fetch and aggregate real historical outcomes.
 */
export function getOutcomeDistribution(
  signalType: string,
  signalStatus: string,
): OutcomeDistribution | null {
  const key = `${signalType}|${signalStatus}`;
  const row = DEMO_OUTCOMES[key];
  // Demo rows are illustrative by definition - they are not measured history.
  return row ? { ...row, provenance: 'illustrative' } : null;
}

/**
 * Format outcome as plain-English summary.
 * E.g.: "Past 23 similar strong setup signals returned 6.4% median over 20 days (74% win rate)."
 *
 * Illustrative distributions are explicitly labelled so a placeholder win rate is never mistaken
 * for measured history, and expectancy is co-displayed so a high win rate on small wins and large
 * losses (the mean-reversion trap) is not read as edge.
 */
export function formatOutcomeSummary(dist: OutcomeDistribution | null): string {
  if (!dist) {
    return "Insufficient historical data.";
  }

  const sampleText = `${dist.sampleSize} past signal${dist.sampleSize !== 1 ? "s" : ""}`;
  const returnText = dist.return20dMedian !== null
    ? `${dist.return20dMedian > 0 ? "+" : ""}${dist.return20dMedian.toFixed(1)}%`
    : "N/A";
  const winRateText = `${Math.round(dist.return20dWinRate)}% win rate`;

  const core = `${sampleText} returned ${returnText} over 20 days (${winRateText}).`;
  const prefix = dist.provenance === 'measured' ? '' : 'Illustrative (no measured history yet): ';

  const exp = expectancyFromOutcome(dist);
  const expText = exp
    ? ` Expectancy about ${computeExpectancy(exp).expectedValuePct}% per trade.`
    : '';

  return `${prefix}${core}${expText}`;
}

/**
 * Derive expectancy inputs from an outcome distribution. This is a documented PROXY: the median
 * max-upside stands in for the average win and the worst drawdown for the average loss, so the
 * expected value is directional, not a precise backtest. Returns null when the fields are missing.
 */
export function expectancyFromOutcome(dist: OutcomeDistribution | null): ExpectancyInput | null {
  if (!dist || dist.maxUpsideMedian === null || dist.worstDrawdownMin === null) return null;
  return {
    winRatePct: dist.return20dWinRate,
    avgWinPct: Math.max(0, dist.maxUpsideMedian),
    avgLossPct: Math.abs(dist.worstDrawdownMin),
  };
}
