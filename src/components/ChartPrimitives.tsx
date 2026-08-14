'use client';

/*
 * Chart primitives - slimmed to the honest set in the 2026-08-11 visualisation audit.
 * Deleted: ScoreHeatBars + MacdHistogramChart (drew the fabricated 7-point score-history
 * ramp), MiniCandlestick (invented OHLC wicks/noise from close-only values), DenseLineChart
 * (only consumer was the dead HoldingChartCarousel), and the ReconstructedNote footnote that
 * excused them. What remains draws exactly the values it is given, nothing more.
 *
 * NOTE ON COLOUR LITERALS: series colours are painted through SVG presentation ATTRIBUTES
 * (fill= / stroke=) and interpolated into gradient ids (url(#...)), where CSS custom
 * properties do not resolve - so they stay literal hexes, byte-equal to the token table
 * (positive #43d18b, negative #ff6b6b). See lyra-ux/notes/2026-08-02-p0.md.
 */

function bounds(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }

  return { min, max };
}

function pathFor(values: number[], width: number, height: number, min: number, max: number, pad = 12) {
  const range = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = pad + step * index;
      const y = height - pad - ((value - min) / range) * (height - pad * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function areaPathFor(values: number[], width: number, height: number, min: number, max: number, pad = 12) {
  const range = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;

  const linePath = values
    .map((value, index) => {
      const x = pad + step * index;
      const y = height - pad - ((value - min) / range) * (height - pad * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  // Close path: go to baseline and back
  const lastX = pad + step * (values.length - 1);
  const baseline = height - pad;

  return `${linePath} L ${lastX.toFixed(2)} ${baseline.toFixed(2)} L ${pad.toFixed(2)} ${baseline.toFixed(2)} Z`;
}

/** A plain line-with-area sparkline of REAL values - it draws what it is given, only that. */
export function MiniSparkline({
  values,
  color = '#43d18b',
  height = 36,
  className = 'h-9 w-24',
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const width = 96;
  const { min, max } = bounds(values);

  return (
    <svg
      className={`${className} overflow-visible`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend sparkline"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id={`mini-grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={areaPathFor(values, width, height, min, max, 3)}
        fill={`url(#mini-grad-${color})`}
      />
      <path
        d={pathFor(values, width, height, min, max, 3)}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
