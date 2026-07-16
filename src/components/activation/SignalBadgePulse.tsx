'use client';

import { useEffect, useState } from 'react';

interface SignalBadgePulseProps {
  delay: number;
  duration: number;
  reduced?: boolean;
}

/**
 * SignalBadgePulse: A "Buy Review" badge that fades in and pulses subtly.
 * Represents the status badge that appears during momentum review.
 */
export function SignalBadgePulse({
  delay,
  reduced = false,
}: SignalBadgePulseProps) {
  const [isVisible, setIsVisible] = useState(reduced);

  useEffect(() => {
    if (reduced) return;

    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay, reduced]);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded border border-[#43d18b] bg-[#0d1117] transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        animation: isVisible ? 'badgePulse 2s ease-in-out infinite' : 'none',
      }}
    >
      <span className="inline-block w-2 h-2 rounded-full bg-[#43d18b]" />
      <span className="text-xs font-semibold text-[#43d18b]">Buy Review</span>
      <style jsx>{`
        @keyframes badgePulse {
          0% {
            box-shadow: 0 0 0 0 rgba(67, 209, 139, 0.4);
          }
          50% {
            box-shadow: 0 0 8px 2px rgba(67, 209, 139, 0.2);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(67, 209, 139, 0);
          }
        }
      `}</style>
    </div>
  );
}
