'use client';

import { useId } from 'react';
import { BRAND_NAME } from '@/lib/brand';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

/**
 * Brand mark - a gradient "momentum radar" tile: a rising signal line cresting to
 * a glowing signal dot, inside a gradient-edged dark tile. Scales crisply from the
 * 26px header to larger sizes. Optional gradient wordmark.
 */
export function BrandLogo({ size = 30, showWordmark = false, className = '' }: BrandLogoProps) {
  // Unique per instance - duplicate gradient ids across the sidebar / header logos
  // made the visible logo reference a hidden (display:none) gradient and render dark.
  const gid = `lyra-grad-${useId().replace(/:/g, '')}`;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        role="img"
        aria-label={BRAND_NAME}
        shapeRendering="geometricPrecision"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(59,91,219,0.28))' }}
      >
        <defs>
          <linearGradient id={gid} x1="2" y1="30" x2="30" y2="2" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3b5bdb" />
            <stop offset="0.55" stopColor="#43d18b" />
            <stop offset="1" stopColor="#f3a33a" />
          </linearGradient>
        </defs>
        <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="8" fill="#0d1117" stroke={`url(#${gid})`} strokeWidth="1.5" />
        <polyline
          points="6.5,22.5 12,16.5 16.5,19.5 25,8.5"
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="25" cy="8.5" r="3.6" fill="#f3a33a" opacity="0.22" />
        <circle cx="25" cy="8.5" r="1.9" fill="#f8c46b" />
      </svg>
      {showWordmark && (
        <span className="bg-gradient-to-r from-[#8aa2ff] via-[#43d18b] to-[#f3a33a] bg-clip-text text-base font-semibold tracking-tight text-transparent">
          {BRAND_NAME}
        </span>
      )}
    </span>
  );
}
