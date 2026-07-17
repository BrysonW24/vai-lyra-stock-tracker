/**
 * Track Record - the HONEST, measured performance of Lyra's live signals, aggregated from
 * real signal_outcomes rows (not the illustrative preset numbers in strategy.ts).
 *
 * The deterministic engine owns every number here; this module only aggregates rows the
 * outcome-labelling worker already wrote. No estimation, no smoothing, no rounding that
 * changes a value. If there are no rows, the record is empty and the UI says "not yet
 * measured" - it never falls back to a decorative win rate.
 *
 * Why this exists: strategy.ts shipped hardcoded win rates (67%, 72%) with a comment
 * claiming they came from simulation. They did not, and the real numbers are humbler and
 * occasionally worse than a coin toss - which is exactly why showing the truth matters for
 * a research-only product. Manufactured confidence is the harm; measured honesty is the fix.
 */

/** One labelled outcome row as stored in signal_outcomes (only the fields we aggregate). */
export interface OutcomeRow {
  signal_type: string;
  signal_status: string;
  return_1d: number | null;
  return_5d: number | null;
  return_20d: number | null;
  return_60d: number | null;
}

export type Horizon = '1d' | '5d' | '20d' | '60d';

export const HORIZONS: Horizon[] = ['1d', '5d', '20d', '60d'];

/**
 * A move smaller than round-trip friction is not a win. Counting break-evens as wins
 * inflates the rate; the per-symbol outcome route already uses this same 0.3% floor, so
 * the Track Record and the drawer agree on what "win" means.
 */
export const WIN_THRESHOLD_PCT = 0.3;

/**
 * A win rate on a handful of samples is noise, not a track record. The UI must gate the
 * measured aggregate behind this floor per group and say "still measuring" below it -
 * same threshold the per-symbol route uses.
 */
export const MIN_SAMPLE_FOR_CONFIDENCE = 20;

const RETURN_FIELD: Record<Horizon, keyof OutcomeRow> = {
  '1d': 'return_1d',
  '5d': 'return_5d',
  '20d': 'return_20d',
  '60d': 'return_60d',
};

/** Measured stats for one horizon. n is the count of rows that actually carry that horizon. */
export interface HorizonStat {
  horizon: Horizon;
  n: number;
  /** Percent of measured returns strictly greater than 0. Null when n === 0. */
  winRatePct: number | null;
  /** Mean measured return in percent. Null when n === 0. */
  avgReturnPct: number | null;
  /** Median measured return in percent. Null when n === 0. */
  medianReturnPct: number | null;
  /** Best and worst measured return in percent. Null when n === 0. */
  bestPct: number | null;
  worstPct: number | null;
}

/** One signal-status group (e.g. strong_setup) with its per-horizon measured stats. */
export interface TrackRecordGroup {
  signalStatus: string;
  /** Total rows in this group (rows may still have a null at some horizons). */
  totalRows: number;
  horizons: HorizonStat[];
}

export interface TrackRecord {
  provenance: 'measured' | 'empty';
  totalOutcomes: number;
  /** Distinct signal types represented, so the UI never implies more coverage than exists. */
  signalTypes: string[];
  groups: TrackRecordGroup[];
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function horizonStat(rows: OutcomeRow[], horizon: Horizon): HorizonStat {
  const field = RETURN_FIELD[horizon];
  const values = rows
    .map((r) => r[field])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  if (values.length === 0) {
    return { horizon, n: 0, winRatePct: null, avgReturnPct: null, medianReturnPct: null, bestPct: null, worstPct: null };
  }

  const wins = values.filter((v) => v > WIN_THRESHOLD_PCT).length;
  const sum = values.reduce((a, v) => a + v, 0);
  const sorted = [...values].sort((a, b) => a - b);

  return {
    horizon,
    n: values.length,
    winRatePct: (100 * wins) / values.length,
    avgReturnPct: sum / values.length,
    medianReturnPct: median(sorted),
    bestPct: sorted[sorted.length - 1],
    worstPct: sorted[0],
  };
}

/**
 * Aggregate raw outcome rows into a measured Track Record. Pure and total: any input
 * (including []) returns a well-formed record. Groups are ordered by totalRows desc so the
 * most-sampled status leads, and ties break alphabetically for deterministic output.
 */
export function aggregateTrackRecord(rows: OutcomeRow[]): TrackRecord {
  if (rows.length === 0) {
    return { provenance: 'empty', totalOutcomes: 0, signalTypes: [], groups: [] };
  }

  const byStatus = new Map<string, OutcomeRow[]>();
  for (const row of rows) {
    const list = byStatus.get(row.signal_status) ?? [];
    list.push(row);
    byStatus.set(row.signal_status, list);
  }

  const groups: TrackRecordGroup[] = [...byStatus.entries()]
    .map(([signalStatus, groupRows]) => ({
      signalStatus,
      totalRows: groupRows.length,
      horizons: HORIZONS.map((h) => horizonStat(groupRows, h)),
    }))
    .sort((a, b) => b.totalRows - a.totalRows || a.signalStatus.localeCompare(b.signalStatus));

  const signalTypes = [...new Set(rows.map((r) => r.signal_type))].sort();

  return { provenance: 'measured', totalOutcomes: rows.length, signalTypes, groups };
}

/** Round a measured percent for display without ever changing which side of zero it sits. */
export function formatPct(value: number | null, digits = 1): string {
  if (value === null) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}
