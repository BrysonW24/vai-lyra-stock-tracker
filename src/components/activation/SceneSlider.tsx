'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

interface SceneSliderProps {
  sceneIndex: number;
  children: ReactNode;
  durationMs?: number;
}

/**
 * Direction-aware push/slide transition between activation scenes (PowerPoint "push"
 * feel) - no flash. Forward (next): outgoing slides left, incoming enters from the
 * right. Back (prev): the reverse. Pure CSS. overflow-hidden is only applied during
 * the transition so the parent's vertical scroll still works when idle.
 */
export function SceneSlider({ sceneIndex, children, durationMs = 430 }: SceneSliderProps) {
  const prevIndexRef = useRef(sceneIndex);
  const prevChildrenRef = useRef<ReactNode>(children);
  const [transition, setTransition] = useState<{ node: ReactNode; key: number; dir: 1 | -1 } | null>(null);

  useEffect(() => {
    if (sceneIndex !== prevIndexRef.current) {
      const dir: 1 | -1 = sceneIndex > prevIndexRef.current ? 1 : -1;
      setTransition({ node: prevChildrenRef.current, key: prevIndexRef.current, dir });
      const timer = setTimeout(() => setTransition(null), durationMs);
      prevIndexRef.current = sceneIndex;
      prevChildrenRef.current = children;
      return () => clearTimeout(timer);
    }
    prevChildrenRef.current = children;
  }, [sceneIndex, children, durationMs]);

  const sliding = transition !== null;
  const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const inAnim = transition?.dir === -1 ? 'lyraInLeft' : 'lyraInRight';
  const outAnim = transition?.dir === -1 ? 'lyraOutRight' : 'lyraOutLeft';

  return (
    <div className={`relative w-full ${sliding ? 'overflow-hidden' : ''}`}>
      <div
        key={`scene-${sceneIndex}`}
        className="w-full"
        style={sliding ? { animation: `${inAnim} ${durationMs}ms ${ease} both` } : undefined}
      >
        {children}
      </div>

      {transition && (
        <div
          key={`scene-out-${transition.key}`}
          className="absolute inset-0 w-full"
          style={{ animation: `${outAnim} ${durationMs}ms ${ease} both` }}
        >
          {transition.node}
        </div>
      )}

      <style jsx>{`
        @keyframes lyraInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes lyraInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes lyraOutLeft {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        @keyframes lyraOutRight {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
