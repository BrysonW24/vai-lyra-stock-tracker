'use client';

import { useEffect, useState } from 'react';
import { TickerLogo } from '@/components/TickerLogo';

interface AnimatedTickerChipProps {
  symbol: string;
  delay: number;
  duration: number;
  reduced?: boolean;
}

/**
 * AnimatedTickerChip: A ticker badge that glides into view from the left.
 * Uses CSS transform + transition for smooth entry animation.
 */
export function AnimatedTickerChip({
  symbol,
  delay,
  duration,
  reduced = false,
}: AnimatedTickerChipProps) {
  const [isVisible, setIsVisible] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay, reduced]);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded border border-[#263241] terminal-panel-soft transition-all ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        transitionDuration: reduced ? '0ms' : `${duration}ms`,
        transform: isVisible ? 'translateX(0)' : 'translateX(-20px)',
      }}
    >
      <TickerLogo symbol={symbol} size={16} />
      <span className="text-xs font-semibold text-[#eef3f8]">{symbol}</span>
    </div>
  );
}
