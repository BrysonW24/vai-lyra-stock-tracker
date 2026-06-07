'use client';

import { useEffect, useState } from 'react';

interface SceneWipeProps {
  active: boolean;
  duration?: number;
  onComplete?: () => void;
}

/**
 * SceneWipe: A translucent gradient sheet that sweeps right→left between scenes.
 * Uses CSS animation with a subtle blue-cyan gradient for visual cohesion.
 */
export function SceneWipe({ active, duration = 700, onComplete }: SceneWipeProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (active) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [active, duration, onComplete]);

  if (!isAnimating) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        animation: `sceneWipeAnimation ${duration}ms ease-in-out forwards`,
      }}
    >
      <style jsx>{`
        @keyframes sceneWipeAnimation {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(4,10,25,0) 0%, rgba(21,74,255,0.22) 35%, rgba(103,232,249,0.28) 55%, rgba(4,10,25,0.92) 100%)',
        }}
      />
    </div>
  );
}
