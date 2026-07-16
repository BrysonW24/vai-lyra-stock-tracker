'use client';

import { useState } from 'react';
import { faviconUrl } from '@/lib/ticker-logos';

interface SourceFaviconProps {
  domain: string;
  sourceName: string;
}

/**
 * SourceFavicon - logo-first fallback to deterministic coloured letter badge.
 * Tries Google favicons API first, falls back to hue-hashed coloured letter.
 */
export function SourceFavicon({ domain, sourceName }: SourceFaviconProps) {
  const [imageError, setImageError] = useState(false);

  // Extract first letter from source name for badge
  const letter = sourceName.charAt(0).toUpperCase();

  // Deterministic colour based on domain hash
  function hashStringToHue(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 360;
  }

  const hue = hashStringToHue(domain);

  // Generate background colour from hue (using HSL)
  const bgColor = `hsl(${hue}, 65%, 35%)`;
  const textColor = '#ffffff';

  if (imageError) {
    return (
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded border border-[#263241] text-xs font-semibold"
        style={{ backgroundColor: bgColor, color: textColor }}
        title={sourceName}
      >
        {letter}
      </div>
    );
  }

  return (
    // Favicons load from arbitrary third-party hosts (Google s2 + any entity domain); next/image
    // would need every host allow-listed. Plain img is intended.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={faviconUrl(domain, 32)}
      alt={sourceName}
      className="h-8 w-8 shrink-0 rounded border border-[#263241]"
      onError={() => setImageError(true)}
      title={sourceName}
    />
  );
}
