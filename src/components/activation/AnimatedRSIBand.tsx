'use client';

import { useEffect, useState } from 'react';

interface AnimatedRSIBandProps {
  startValue: number;
  endValue: number;
  min?: number;
  max?: number;
  lowerBand?: number;
  upperBand?: number;
  delay: number;
  duration: number;
  reduced?: boolean;
}

/**
 * AnimatedRSIBand: RSI mini-panel with a line that animates from startValue to endValue
 * across a 30-70 band visualization. Shows "RSI rising from below 50" label.
 */
export function AnimatedRSIBand({
  startValue,
  endValue,
  min = 0,
  max = 100,
  lowerBand = 30,
  upperBand = 70,
  delay,
  duration,
  reduced = false,
}: AnimatedRSIBandProps) {
  const [displayValue, setDisplayValue] = useState(reduced ? endValue : startValue);
  const [isAnimating, setIsAnimating] = useState(reduced);

  useEffect(() => {
    if (reduced) return;

    const timer = setTimeout(() => {
      setIsAnimating(true);
      const startTime = performance.now();
      let frameId: number;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const newValue = startValue + (endValue - startValue) * progress;
        setDisplayValue(newValue);

        if (progress < 1) {
          frameId = requestAnimationFrame(animate);
        }
      };

      frameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frameId);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, duration, startValue, endValue, reduced]);

  const yPos = ((displayValue - min) / (max - min)) * 100;
  const lowerBandPercent = ((lowerBand - min) / (max - min)) * 100;
  const upperBandPercent = ((upperBand - min) / (max - min)) * 100;

  return (
    <div className="terminal-panel rounded px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
          RSI
        </p>
        <span className="text-xs font-mono text-[#60a5fa]">
          {Math.round(displayValue)}
        </span>
      </div>

      {/* RSI Band */}
      <div className="relative w-full h-16 mb-3">
        <svg className="w-full h-full" preserveAspectRatio="none">
          {/* Background band 0-30 (oversold) */}
          <rect
            x="0"
            y={`${100 - lowerBandPercent}%`}
            width="100%"
            height={`${lowerBandPercent}%`}
            fill="rgba(255, 107, 107, 0.1)"
          />
          {/* Middle band 30-70 (neutral) */}
          <rect
            x="0"
            y={`${100 - upperBandPercent}%`}
            width="100%"
            height={`${upperBandPercent - lowerBandPercent}%`}
            fill="rgba(96, 165, 250, 0.08)"
          />
          {/* Top band 70-100 (overbought) */}
          <rect
            x="0"
            y="0"
            width="100%"
            height={`${100 - upperBandPercent}%`}
            fill="rgba(67, 209, 139, 0.1)"
          />

          {/* Lower band line */}
          <line
            x1="0"
            y1={`${100 - lowerBandPercent}%`}
            x2="100%"
            y2={`${100 - lowerBandPercent}%`}
            stroke="rgba(255, 107, 107, 0.3)"
            strokeWidth="1"
          />
          {/* Upper band line */}
          <line
            x1="0"
            y1={`${100 - upperBandPercent}%`}
            x2="100%"
            y2={`${100 - upperBandPercent}%`}
            stroke="rgba(67, 209, 139, 0.3)"
            strokeWidth="1"
          />

          {/* Value indicator dot */}
          <circle
            cx="100%"
            cy={`${100 - yPos}%`}
            r="3"
            fill="#60a5fa"
          />
        </svg>
      </div>

      {/* Label */}
      <p className="text-[10px] text-[#a8b5c2]">RSI rising from below 50</p>
    </div>
  );
}
