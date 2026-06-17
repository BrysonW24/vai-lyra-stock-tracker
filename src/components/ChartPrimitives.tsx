'use client';

import type { ScorePoint } from '@/types/scanner';
import { formatNumber } from '@/lib/format';
import type { CSSProperties } from 'react';
import { useState, useRef, useMemo } from 'react';

type ChartSeries = {
  label: string;
  values: number[];
  color: string;
};

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

function getPointsForLabels(values: number[], width: number, height: number, min: number, max: number, pad = 12): Array<{ x: number; y: number; value: number; index: number }> {
  const range = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;

  return values.map((value, index) => {
    const x = pad + step * index;
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return { x, y, value, index };
  });
}

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

export function MiniCandlestick({
  values,
  positiveColor = '#43d18b',
  negativeColor = '#ff6b6b',
  height = 56,
  className = 'h-14 w-full',
}: {
  values: number[];
  positiveColor?: string;
  negativeColor?: string;
  height?: number;
  className?: string;
}) {
  const width = 160;

  // Generate OHLC data from the 1D values array
  const candles = useMemo(() => {
    return values.map((val, i) => {
      const close = val;
      const open = i === 0 ? val : values[i - 1];
      const diff = Math.abs(close - open);
      const baseNoise = Math.max(close, open) * 0.003; // 0.3% baseline volatility
      const high = Math.max(open, close) + Math.max(diff * 0.2, baseNoise * 0.4);
      const low = Math.min(open, close) - Math.max(diff * 0.2, baseNoise * 0.4);
      return { open, high, low, close };
    });
  }, [values]);

  const { min, max } = useMemo(() => {
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const minVal = Math.min(...lows);
    const maxVal = Math.max(...highs);
    if (minVal === maxVal) {
      return { min: minVal - 1, max: maxVal + 1 };
    }
    return { min: minVal, max: maxVal };
  }, [candles]);

  const pad = 4;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  const step = candles.length > 1 ? plotW / (candles.length - 1) : 0;
  const candleW = Math.max(1.5, Math.min(6, step * 0.6));

  return (
    <svg
      className={`${className} overflow-visible`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Candlestick chart"
      shapeRendering="geometricPrecision"
    >
      {candles.map((candle, index) => {
        const x = pad + step * index;
        const range = max - min || 1;
        const yOpen = height - pad - ((candle.open - min) / range) * plotH;
        const yClose = height - pad - ((candle.close - min) / range) * plotH;
        const yHigh = height - pad - ((candle.high - min) / range) * plotH;
        const yLow = height - pad - ((candle.low - min) / range) * plotH;

        const isBullish = candle.close >= candle.open;
        const bodyColor = isBullish ? positiveColor : negativeColor;
        const bodyY = Math.min(yOpen, yClose);
        const bodyH = Math.max(1.5, Math.abs(yOpen - yClose));

        return (
          <g key={index}>
            {/* Wick */}
            <line
              x1={x}
              y1={yHigh}
              x2={x}
              y2={yLow}
              stroke={bodyColor}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {/* Body */}
            <rect
              x={x - candleW / 2}
              y={bodyY}
              width={candleW}
              height={bodyH}
              fill={bodyColor}
              stroke={bodyColor}
              strokeWidth="0.5"
              rx={0.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}


export function DenseLineChart({
  title,
  subtitle,
  labels,
  series,
  height = 260,
}: {
  title: string;
  subtitle?: string;
  labels: string[];
  series: ChartSeries[];
  height?: number;
}) {
  const width = 720;
  const allValues = series.flatMap((item) => item.values);
  const { min, max } = bounds(allValues);
  const gridLines = [0, 1, 2, 3, 4];

  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  type TooltipInfo = { seriesLabel: string; color: string; x: number; y: number; value: number; label: string };

  // Find nearest point to hover position
  const tooltipData = useMemo((): TooltipInfo | null => {
    if (hoverX === null) return null;

    const tolerance = 30; // pixels
    let nearest: TooltipInfo | null = null;
    let nearestDist = tolerance;

    series.forEach((item) => {
      const points = getPointsForLabels(item.values, width, height, min, max);
      points.forEach((point) => {
        const dist = Math.abs(point.x - hoverX);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = {
            seriesLabel: item.label,
            color: item.color,
            x: point.x,
            y: point.y,
            value: point.value,
            label: labels[point.index],
          };
        }
      });
    });

    return nearest;
  }, [hoverX, series, width, height, min, max, labels]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    setHoverX(svgX);
  };

  const handleMouseLeave = () => {
    setHoverX(null);
  };

  // Compute tooltip position to avoid clipping
  let tooltipLeft = 'auto';
  let tooltipRight = 'auto';
  let tooltipTop = 'auto';
  let tooltipBottom = 'auto';

  if (tooltipData !== null) {
    const tooltipPixelX = (tooltipData.x / width) * 100;
    const tooltipPixelY = (tooltipData.y / height) * 100;

    tooltipLeft = tooltipPixelX > 50 ? 'auto' : `${tooltipPixelX + 2}%`;
    tooltipRight = tooltipPixelX > 50 ? `${100 - tooltipPixelX + 2}%` : 'auto';
    tooltipTop = tooltipPixelY < 30 ? `${tooltipPixelY + 2}%` : 'auto';
    tooltipBottom = tooltipPixelY >= 30 ? `${100 - tooltipPixelY + 2}%` : 'auto';
  }

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2530] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">{title}</p>
          {subtitle && <p className="mt-1 text-xs text-[#a8b5c2]">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          {series.map((item) => (
            <span className="flex items-center gap-1.5 font-mono text-xs text-[#a8b5c2]" key={item.label}>
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative h-[var(--chart-height)] overflow-hidden" style={{ '--chart-height': `${height}px` } as CSSProperties}>
        <svg
          ref={svgRef}
          className="h-full w-full cursor-crosshair"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={title}
          shapeRendering="geometricPrecision"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {series.map((item) => (
              <linearGradient key={`grad-${item.label}`} id={`dense-grad-${item.label}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={item.color} stopOpacity="0.12" />
                <stop offset="100%" stopColor={item.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {gridLines.map((line) => {
            const y = 12 + ((height - 24) / (gridLines.length - 1)) * line;
            return <line x1="0" x2={width} y1={y} y2={y} stroke="#17202a" strokeWidth="0.5" key={line} shapeRendering="crispEdges" />;
          })}

          {/* Area fills under lines */}
          {series.map((item) => (
            <path
              key={`area-${item.label}`}
              d={areaPathFor(item.values, width, height, min, max)}
              fill={`url(#dense-grad-${item.label})`}
            />
          ))}

          {/* Lines */}
          {series.map((item) => (
            <path
              d={pathFor(item.values, width, height, min, max)}
              fill="none"
              stroke={item.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              key={item.label}
            />
          ))}

          {/* Hover crosshair and dot */}
          {tooltipData !== null && (
            <>
              <line
                x1={tooltipData!.x}
                x2={tooltipData!.x}
                y1="12"
                y2={height - 12}
                stroke={tooltipData!.color}
                strokeWidth="0.5"
                opacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={tooltipData!.x}
                cy={tooltipData!.y}
                r="3"
                fill={tooltipData!.color}
                stroke="#0d1117"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* Hover tooltip - clamped inside the plot so it never escapes the panel */}
        {tooltipData !== null && (
          <div
            className="pointer-events-none absolute z-10 max-w-[160px] rounded border border-[#263241] bg-[#0d1117]/95 px-2.5 py-1.5 font-mono text-xs text-[#dbe5ee] shadow-xl backdrop-blur-sm"
            style={{
              left: tooltipLeft,
              right: tooltipRight,
              top: tooltipTop,
              bottom: tooltipBottom,
              whiteSpace: 'nowrap',
            }}
          >
            <div className="font-semibold" style={{ color: tooltipData!.color }}>
              {tooltipData!.seriesLabel}
            </div>
            <div className="mt-0.5 text-[10px] text-[#a8b5c2]">{tooltipData!.label}</div>
            <div className="mt-0.5">{formatNumber(tooltipData!.value, 2)}</div>
          </div>
        )}

        <div className="absolute right-3 top-3 rounded border border-[#263241] bg-[#0d141c]/90 px-2 py-1 font-mono text-[11px] text-[#a8b5c2]">
          {formatNumber(max)} / {formatNumber(min)}
        </div>
      </div>

      {/* X-axis labels - own row below the plot so they are always readable */}
      <div className="flex justify-between gap-1 border-t border-[#1b2530] px-4 py-2 font-mono text-[10px] text-[#8190a0]">
        {labels.map((label) => (
          <span key={label} className="truncate">{label}</span>
        ))}
      </div>
    </section>
  );
}

export function MacdHistogramChart({
  points,
  title = 'Momentum shift',
  subtitle = 'MACD histogram, zero-centred. Bars above the line are bullish momentum; bars below are bearish. Bright = extending, faded = receding toward zero.',
}: {
  points: ScorePoint[];
  title?: string;
  subtitle?: string;
}) {
  // SVG plot geometry. preserveAspectRatio="none" lets it fill the panel width;
  // text/labels live in HTML overlays so they never distort.
  const W = 360;
  const H = 156;
  const padX = 14;
  const padTop = 14;
  const padBottom = 14;
  const innerH = H - padTop - padBottom;

  const values = points.map((point) => point.histogram);
  const maxV = Math.max(0, ...values);
  const minV = Math.min(0, ...values);
  const range = maxV - minV || 1;

  const yFor = (value: number) => padTop + ((maxV - value) / range) * innerH;
  const zeroY = yFor(0);
  const zeroPct = (zeroY / H) * 100;

  const slot = (W - padX * 2) / points.length;
  const barW = slot * 0.56;

  // TradingView four-state colouring relative to the previous bar.
  const colorFor = (curr: number, prev: number, hovered: boolean) => {
    const rising = curr >= prev;
    if (curr >= 0) {
      // above zero: teal/green, bright when growing
      return { fill: rising ? '#43d18b' : '#2a8f63', glow: hovered ? 'rgba(67,209,139,0.35)' : 'transparent' };
    }
    // below zero: red, bright when falling deeper, faded when recovering toward zero
    return { fill: rising ? '#ff9aa2' : '#ff5c5c', glow: hovered ? 'rgba(255,107,107,0.35)' : 'transparent' };
  };

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null;
  const hoveredCenterPct =
    hoveredIndex !== null ? ((padX + slot * hoveredIndex + slot / 2) / W) * 100 : 50;

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="border-b border-[#1b2530] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">{title}</p>
        <p className="mt-1 text-xs text-[#a8b5c2]">{subtitle}</p>
      </div>
      <div className="relative h-[156px] overflow-hidden px-1">
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={title}
        >
          {/* Zero baseline */}
          <line
            x1={padX}
            x2={W - padX}
            y1={zeroY}
            y2={zeroY}
            stroke="#3a4654"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point, index) => {
            const prev = index === 0 ? point.histogram : points[index - 1].histogram;
            const isHovered = hoveredIndex === index;
            const { fill, glow } = colorFor(point.histogram, prev, isHovered);
            const y = yFor(point.histogram);
            const top = Math.min(zeroY, y);
            const barH = Math.max(2, Math.abs(y - zeroY));
            const x = padX + slot * index + (slot - barW) / 2;

            return (
              <rect
                key={point.label}
                x={x}
                y={top}
                width={barW}
                height={barH}
                rx={1.5}
                fill={fill}
                style={{ filter: glow === 'transparent' ? undefined : `drop-shadow(0 0 6px ${glow})` }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Zero label pinned to the baseline */}
        <span
          className="pointer-events-none absolute right-2 -translate-y-1/2 font-mono text-[9px] text-[#5e6b78]"
          style={{ top: `${zeroPct}%` }}
        >
          0
        </span>

        {/* Hover tooltip */}
        {hovered !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded border border-[#263241] bg-[#0d1117]/95 px-2.5 py-1.5 font-mono text-xs text-[#dbe5ee] shadow-xl backdrop-blur-sm"
            style={{ left: `${Math.min(Math.max(hoveredCenterPct, 18), 82)}%` }}
          >
            <div className="font-semibold" style={{ color: hovered.histogram >= 0 ? '#43d18b' : '#ff6b6b' }}>
              {hovered.label}
            </div>
            <div className="mt-0.5 text-[10px] text-[#a8b5c2]">MACD histogram</div>
            <div className="mt-0.5">{formatNumber(hovered.histogram, 3)}</div>
          </div>
        )}
      </div>

      {/* X-axis labels in their own row so they stay readable */}
      <div className="flex justify-between gap-1 border-t border-[#1b2530] px-4 py-2 font-mono text-[10px] text-[#8190a0]">
        {points.map((point) => (
          <span key={point.label} className="truncate">{point.label}</span>
        ))}
      </div>
    </section>
  );
}

export function ScoreHeatBars({ points }: { points: ScorePoint[] }) {
  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center justify-between border-b border-[#1b2530] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Signal score history</p>
          <p className="mt-1 text-xs text-[#a8b5c2]">Score, RSI, and histogram recovery window.</p>
        </div>
        <span className="rounded border border-[#1d7f55] bg-[#0d251b] px-2 py-1 font-mono text-xs text-[#43d18b]">
          Now {points.at(-1)?.score ?? 0}
        </span>
      </div>
      <div className="grid min-h-[210px] grid-cols-7 items-end gap-2 px-4 pb-4 pt-6">
        {points.map((point) => (
          <div className="group flex h-44 flex-col justify-end" key={point.label}>
            <div
              className="rounded-sm border border-[#1d7f55] bg-[#43d18b]/70 transition group-hover:bg-[#43d18b]"
              style={{ height: `${Math.max(12, point.score * 1.55)}px` }}
              title={`Score ${point.score}`}
            />
            <p className="mt-2 text-center font-mono text-sm text-[#eef3f8]">{point.score}</p>
            <p className="text-center font-mono text-[10px] text-[#8190a0]">{point.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
