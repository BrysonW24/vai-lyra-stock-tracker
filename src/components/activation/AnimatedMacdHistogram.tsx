'use client';

import { useEffect, useState } from 'react';

interface AnimatedMacdHistogramProps {
  startValue: number;
  endValue: number;
  delay: number;
  duration: number;
  reduced?: boolean;
}

/**
 * AnimatedMacdHistogram: MACD mini-panel with histogram bars that animate from
 * deeply negative toward zero, showing momentum improvement. Bars rise from below
 * to show MACD histogram recovering.
 */
export function AnimatedMacdHistogram({
  startValue,
  endValue,
  delay,
  duration,
  reduced = false,
}: AnimatedMacdHistogramProps) {
  const [progress, setProgress] = useState(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;

    const timer = setTimeout(() => {
      const startTime = performance.now();
      let frameId: number;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const p = Math.min(elapsed / duration, 1);
        setProgress(p);

        if (p < 1) {
          frameId = requestAnimationFrame(animate);
        }
      };

      frameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frameId);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, duration, reduced]);

  // Generate histogram bars
  const barCount = 8;
  const bars = Array.from({ length: barCount }).map((_, i) => {
    const posInAnim = i / barCount;
    const isInAnimRange = posInAnim <= progress;
    const barProgress = isInAnimRange ? (progress - posInAnim * progress) / (1 - posInAnim * progress) : 0;

    const startVal = startValue + (i / barCount) * (endValue - startValue) * 0.7;
    const endVal = endValue + (i / barCount) * 0.02;
    const currentVal = startVal + (endVal - startVal) * barProgress;

    return {
      value: currentVal,
      height: Math.max(0, Math.min(100, (currentVal + 0.2) * 250)), // scale for visibility
    };
  });

  const maxHeight = 100;
  const minValue = -0.2;
  const maxValue = 0.15;
  const zeroLinePercent = ((0 - minValue) / (maxValue - minValue)) * 100;

  return (
    <div className="terminal-panel rounded px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
          MACD
        </p>
        <span className="text-xs font-mono text-[#43d18b]">
          {(bars[bars.length - 1]?.value ?? 0).toFixed(2)}
        </span>
      </div>

      {/* Histogram */}
      <div className="relative w-full h-16">
        <svg className="w-full h-full" preserveAspectRatio="none">
          {/* Zero line */}
          <line
            x1="0"
            y1={`${100 - zeroLinePercent}%`}
            x2="100%"
            y2={`${100 - zeroLinePercent}%`}
            stroke="rgba(96, 165, 250, 0.3)"
            strokeWidth="1"
          />

          {/* Histogram bars */}
          {bars.map((bar, i) => {
            const xStart = (i / barCount) * 100;
            const xEnd = ((i + 1) / barCount) * 100;
            const barHeight = ((bar.value - minValue) / (maxValue - minValue)) * 100;
            const isPositive = bar.value >= 0;
            const barY = isPositive ? 100 - barHeight : 100;
            const actualHeight = Math.abs(barHeight);

            return (
              <rect
                key={i}
                x={`${xStart}%`}
                y={`${barY}%`}
                width={`${xEnd - xStart}%`}
                height={`${actualHeight}%`}
                fill={isPositive ? 'rgba(67, 209, 139, 0.6)' : 'rgba(255, 107, 107, 0.6)'}
              />
            );
          })}
        </svg>
      </div>

      {/* Label */}
      <p className="text-[10px] text-[#a8b5c2]">MACD histogram improving</p>
    </div>
  );
}
