/**
 * Comparison Lab data and helpers
 * Multi-series ticker comparison with normalisation and ranking
 */

export interface ComparisonSeries {
  ticker: string;
  label: string;
  color: string;
  data: ComparisonPoint[];
}

export interface ComparisonPoint {
  timestamp: string;
  returnPercent: number;
  signalScore: number;
  rsi: number;
  macdHistogram: number;
  volumeRatio: number;
}

export interface NormalisedSeries {
  ticker: string;
  label: string;
  color: string;
  data: NormalisedPoint[];
}

export interface NormalisedPoint {
  timestamp: string;
  normalisedReturn: number;
  normalisedScore: number;
  normalisedRsi: number;
  normalisedMacd: number;
  normalisedVolume: number;
}

export interface ComparisonTableRow {
  ticker: string;
  label: string;
  color: string;
  latestReturn: number;
  latestScore: number;
  latestRsi: number;
  latestMacd: number;
  latestVolume: number;
  returnRank: number;
  scoreRank: number;
  relativeStrength: number;
}

/**
 * Demo data for ~10 tech tickers
 * ~30 points per series, realistic technical metrics
 */
export const DEMO_COMPARISON_DATA: ComparisonSeries[] = [
  {
    ticker: 'NVDA',
    label: 'NVIDIA',
    color: '#60a5fa', // blue
    data: generateDemoSeries(0.8, 65, 42, 0.12, 1.1, 1.2),
  },
  {
    ticker: 'AMD',
    label: 'AMD',
    color: '#f3a33a', // orange
    data: generateDemoSeries(0.5, 58, 38, 0.08, 0.95, 1.0),
  },
  {
    ticker: 'AVGO',
    label: 'Broadcom',
    color: '#43d18b', // green
    data: generateDemoSeries(0.35, 61, 40, 0.06, 1.05, 0.9),
  },
  {
    ticker: 'TSM',
    label: 'TSMC',
    color: '#ff6b6b', // red
    data: generateDemoSeries(0.25, 52, 35, 0.04, 0.85, 0.8),
  },
  {
    ticker: 'ARM',
    label: 'Arm Holdings',
    color: '#a78bfa', // purple
    data: generateDemoSeries(0.65, 68, 44, 0.14, 1.15, 1.3),
  },
  {
    ticker: 'MSFT',
    label: 'Microsoft',
    color: '#06b6d4', // cyan
    data: generateDemoSeries(0.3, 55, 37, 0.02, 0.8, 0.7),
  },
  {
    ticker: 'GOOGL',
    label: 'Alphabet',
    color: '#ec4899', // pink
    data: generateDemoSeries(0.2, 48, 32, 0.01, 0.75, 0.65),
  },
  {
    ticker: 'AMZN',
    label: 'Amazon',
    color: '#f59e0b', // amber
    data: generateDemoSeries(0.28, 51, 34, 0.03, 0.78, 0.72),
  },
  {
    ticker: 'CRWD',
    label: 'CrowdStrike',
    color: '#10b981', // emerald
    data: generateDemoSeries(0.55, 62, 41, 0.11, 1.08, 1.15),
  },
  {
    ticker: 'PANW',
    label: 'Paloalto',
    color: '#8b5cf6', // violet
    data: generateDemoSeries(0.45, 59, 39, 0.09, 1.02, 1.05),
  },
];

/**
 * Generate a realistic demo series with ~30 points
 * Applies random walk to create natural-looking technical data
 */
function generateDemoSeries(
  trendBias: number,
  baseScore: number,
  baseRsi: number,
  baseMacd: number,
  baseVolume: number,
  volatility: number,
): ComparisonPoint[] {
  const points: ComparisonPoint[] = [];
  let returnAccum = 0;
  let scoreAccum = baseScore;
  let rsiAccum = baseRsi;
  let macdAccum = baseMacd;
  let volumeAccum = baseVolume;

  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const timestamp = new Date(now.getTime() - (29 - i) * 60 * 60 * 1000).toISOString();

    // Random walk with trend bias
    const randomWalk = (Math.random() - 0.5) * volatility * 2;
    returnAccum += randomWalk + (trendBias * 0.05);

    // Score mean-revert around base
    const scoreNoise = (Math.random() - 0.5) * 4;
    scoreAccum = Math.max(10, Math.min(100, scoreAccum + scoreNoise - (scoreAccum - baseScore) * 0.05));

    // RSI mean-revert around base (30-70 bounds)
    const rsiNoise = (Math.random() - 0.5) * 3;
    rsiAccum = Math.max(30, Math.min(70, rsiAccum + rsiNoise - (rsiAccum - baseRsi) * 0.08));

    // MACD histogram oscillates
    const macdNoise = (Math.random() - 0.5) * 0.04;
    macdAccum = Math.max(-0.3, Math.min(0.3, macdAccum + macdNoise - macdAccum * 0.1));

    // Volume ratio oscillates 0.6x to 1.5x
    const volNoise = (Math.random() - 0.5) * 0.15;
    volumeAccum = Math.max(0.6, Math.min(1.5, volumeAccum + volNoise - (volumeAccum - baseVolume) * 0.02));

    points.push({
      timestamp,
      returnPercent: returnAccum,
      signalScore: Math.round(scoreAccum),
      rsi: Math.round(rsiAccum * 10) / 10,
      macdHistogram: Math.round(macdAccum * 1000) / 1000,
      volumeRatio: Math.round(volumeAccum * 100) / 100,
    });
  }

  return points;
}

/**
 * Normalise multiple series to a common baseline (e.g., 0% or 0 score)
 * Used for visual comparison when scales differ
 */
export function normaliseSeriesToBaseline(
  series: ComparisonSeries[],
  metric: 'returnPercent' | 'signalScore' | 'rsi' | 'macdHistogram' | 'volumeRatio',
): NormalisedSeries[] {
  return series.map((s) => {
    const baseline = s.data[0]?.[metric] ?? 0;
    return {
      ticker: s.ticker,
      label: s.label,
      color: s.color,
      data: s.data.map((point) => ({
        timestamp: point.timestamp,
        normalisedReturn: point.returnPercent - baseline,
        normalisedScore: point.signalScore - baseline,
        normalisedRsi: point.rsi - baseline,
        normalisedMacd: point.macdHistogram - baseline,
        normalisedVolume: point.volumeRatio - baseline,
      })),
    };
  });
}

/**
 * Normalise series to 0-100 scale (for comparing different metrics)
 */
export function normaliseSeriesToScale(
  series: ComparisonSeries[],
  metric: 'returnPercent' | 'signalScore' | 'rsi' | 'macdHistogram' | 'volumeRatio',
): NormalisedSeries[] {
  const allValues = series.flatMap((s) => s.data.map((p) => p[metric]));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  return series.map((s) => {
    return {
      ticker: s.ticker,
      label: s.label,
      color: s.color,
      data: s.data.map((point) => {
        const normalised = ((point[metric] - min) / range) * 100;
        return {
          timestamp: point.timestamp,
          normalisedReturn: normalised,
          normalisedScore: normalised,
          normalisedRsi: normalised,
          normalisedMacd: normalised,
          normalisedVolume: normalised,
        };
      }),
    };
  });
}

/**
 * Build comparison table: latest values + ranking
 */
export function buildComparisonTable(selected: ComparisonSeries[]): ComparisonTableRow[] {
  const rows: ComparisonTableRow[] = selected.map((s) => {
    const latest = s.data[s.data.length - 1] || s.data[0];
    return {
      ticker: s.ticker,
      label: s.label,
      color: s.color,
      latestReturn: latest?.returnPercent ?? 0,
      latestScore: latest?.signalScore ?? 0,
      latestRsi: latest?.rsi ?? 0,
      latestMacd: latest?.macdHistogram ?? 0,
      latestVolume: latest?.volumeRatio ?? 0,
      returnRank: 0,
      scoreRank: 0,
      relativeStrength: 0,
    };
  });

  // Rank by return
  [...rows]
    .sort((a, b) => b.latestReturn - a.latestReturn)
    .forEach((row, idx) => {
      const match = rows.find((r) => r.ticker === row.ticker);
      if (match) match.returnRank = idx + 1;
    });

  // Rank by score
  [...rows]
    .sort((a, b) => b.latestScore - a.latestScore)
    .forEach((row, idx) => {
      const match = rows.find((r) => r.ticker === row.ticker);
      if (match) match.scoreRank = idx + 1;
    });

  // Relative strength: composite of return rank + score rank
  rows.forEach((row) => {
    row.relativeStrength = Math.round(((row.returnRank + row.scoreRank) / (rows.length * 2)) * 100);
  });

  return rows;
}

/**
 * Extract time labels for chart x-axis (e.g., 'H-29', 'H-28', ..., 'Now')
 */
const TL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function hourLabel(d: Date): string {
  const h = d.getHours();
  return `${h % 12 || 12}${h >= 12 ? 'pm' : 'am'}`;
}

function dayLabel(d: Date): string {
  return `${d.getDate()} ${TL_MONTHS[d.getMonth()]}`;
}

/** Full date + time for the hover scrubber, e.g. "7 Jun, 3pm". */
export function formatPointDateTime(ts: string): string {
  const d = new Date(ts);
  return `${dayLabel(d)}, ${hourLabel(d)}`;
}

/**
 * Adaptive x-axis labels that never overlap. Intraday windows (<= ~2 days) show
 * the time only ("5am", "3pm"); longer windows show the day only ("7 Jun"),
 * de-duplicated so the same day is never printed twice in a row. The last tick is
 * always "Now". Keeps roughly six visible ticks; the rest are blank spacers.
 */
export function extractTimeLabels(points: ComparisonPoint[], totalPoints = 30): string[] {
  const n = totalPoints;
  const labels: string[] = new Array(n).fill('');
  if (n === 0) return labels;

  const firstTs = points[0]?.timestamp;
  const lastTs = points[n - 1]?.timestamp;
  const spanMs = firstTs && lastTs ? new Date(lastTs).getTime() - new Date(firstTs).getTime() : 0;
  const multiDay = spanMs > 48 * 60 * 60 * 1000;

  const interval = Math.max(1, Math.floor(n / 6));
  let lastDay = '';
  for (let i = 0; i < n; i++) {
    const show = i % interval === 0 || i === n - 1;
    if (!show) continue;
    if (i === n - 1) {
      labels[i] = 'Now';
      continue;
    }
    const ts = points[i]?.timestamp;
    if (!ts) continue;
    const d = new Date(ts);
    if (multiDay) {
      const day = dayLabel(d);
      if (day !== lastDay) {
        labels[i] = day;
        lastDay = day;
      }
      // repeated day -> leave blank so "7 Jun" is not printed on every tick
    } else {
      labels[i] = hourLabel(d);
    }
  }

  return labels;
}
