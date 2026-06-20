'use client';

import { useId } from 'react';
import { BRAND_NAME } from '@/lib/brand';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

/**
 * Brand mark - the canonical Lyra app icon: a white up-right arrow (the stock-market
 * "rising" signal) on the blue -> green -> amber gradient square. Matches
 * public/icons/app-icon.svg (the home-screen + email mark) so the in-app logo, the
 * loading screen and the installed icon are one and the same. Optional gradient wordmark.
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
          <linearGradient id={gid} x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3b5bdb" />
            <stop offset="0.55" stopColor="#43d18b" />
            <stop offset="1" stopColor="#f3a33a" />
          </linearGradient>
        </defs>
        <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill={`url(#${gid})`} />
        {/* Up-right arrow, scaled 1:16 from the 512px app icon (M192 320 L320 192 ...). */}
        <path
          d="M12 20 L20 12 M20 12 H13.5 M20 12 V18.5"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {showWordmark && (
        <span className="bg-gradient-to-r from-[#8aa2ff] via-[#43d18b] to-[#f3a33a] bg-clip-text text-base font-semibold tracking-tight text-transparent">
          {BRAND_NAME}
        </span>
      )}
    </span>
  );
}
