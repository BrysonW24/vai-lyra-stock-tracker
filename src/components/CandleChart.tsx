'use client';

import type { Candle } from '@/lib/candle-series';
import { formatCurrency, formatNumber } from '@/lib/format';

/**
 * Compact candlestick chart. Green body when close >= open, red otherwise; thin wicks
 * for the high/low. preserveAspectRatio="none" fills the panel width like the other
 * charts; wick strokes stay crisp via vectorEffect.
 */
export function CandleChart({ candles, height = 150 }: { candles: Candle[]; height?: number }) {
  const W = 320;
  const padX = 10;
  const padTop = 10;
  const padBottom = 10;
  const innerH = height - padTop - padBottom;

  const max = Math.max(...candles.map((c) => c.high));
  const min = Math.min(...candles.map((c) => c.low));
  const range = max - min || 1;
  const yFor = (value: number) => padTop + ((max - value) / range) * innerH;

  const slot = (W - padX * 2) / candles.length;
  const bodyW = Math.max(2, slot * 0.5);
  const last = candles[candles.length - 1];

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Price · candles</p>
        <span className="font-mono text-xs text-ink-title">{formatCurrency(last.close)}</span>
      </div>

      <div className="relative h-[var(--ch)] overflow-hidden" style={{ ['--ch' as string]: `${height}px` }}>
        <svg className="h-full w-full" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label="Candlestick price chart">
          {candles.map((candle, index) => {
            const x = padX + slot * index + slot / 2;
            const up = candle.close >= candle.open;
            // SVG paint attrs cannot resolve var(); literals are byte-copies of
            // --lyra-positive / --lyra-negative, and gain/loss IS the meaning here.
            const color = up ? '#43d18b' : '#ff6b6b';
            const bodyTop = yFor(Math.max(candle.open, candle.close));
            const bodyBot = yFor(Math.min(candle.open, candle.close));
            const bodyH = Math.max(1, bodyBot - bodyTop);
            return (
              <g key={candle.label}>
                <line x1={x} x2={x} y1={yFor(candle.high)} y2={yFor(candle.low)} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} rx="0.5" />
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute right-2 top-1 rounded border border-line-strong bg-panel/90 px-2 py-0.5 font-mono text-[10px] text-ink-2">
          {formatNumber(max, 2)} / {formatNumber(min, 2)}
        </div>
      </div>

      <div className="flex justify-between gap-1 border-t border-line px-4 py-2 font-mono text-[10px] text-ink-3">
        {candles.map((candle) => (
          <span key={candle.label} className="truncate">{candle.label}</span>
        ))}
      </div>
    </section>
  );
}
