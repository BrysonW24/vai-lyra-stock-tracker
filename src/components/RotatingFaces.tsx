'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * RotatingFaces - a tile that rolls through N "sides" with a smooth vertical
 * slot-machine animation: the active face rolls up and out while the next rolls
 * up and in. Pauses on hover, honours prefers-reduced-motion (static first face),
 * and staggers via offsetMs so a grid of tiles does not flip in unison.
 *
 * The first face also renders invisibly in normal flow as the sizer, so the tile
 * keeps its height while the visible faces animate absolutely on top of it -
 * faces must share the same structure/height.
 */
export function RotatingFaces({
  faces,
  intervalMs = 5200,
  offsetMs = 0,
  className = '',
}: {
  faces: ReactNode[];
  intervalMs?: number;
  offsetMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    try {
      setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (faces.length < 2 || reduced) return;
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        if (!pausedRef.current) setIndex((i) => (i + 1) % faces.length);
      }, intervalMs);
    }, offsetMs);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [faces.length, intervalMs, offsetMs, reduced]);

  if (faces.length === 0) return null;
  if (faces.length === 1 || reduced) return <div className={className}>{faces[0]}</div>;

  const prev = (index - 1 + faces.length) % faces.length;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      {/* Sizer - keeps the tile's height; the animated faces overlay it. */}
      <div className="invisible" aria-hidden>
        {faces[0]}
      </div>
      {faces.map((face, i) => {
        const cls =
          i === index
            ? 'translate-y-0 opacity-100 transition-all duration-500 ease-out'
            : i === prev
              ? '-translate-y-full opacity-0 transition-all duration-500 ease-out'
              : 'translate-y-full opacity-0 transition-none';
        return (
          <div key={i} className={`absolute inset-0 ${cls}`} aria-hidden={i !== index}>
            {face}
          </div>
        );
      })}
    </div>
  );
}
