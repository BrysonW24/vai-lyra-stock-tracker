/**
 * Animation timing constants for the Signal Calibration activation sequence.
 * All durations in milliseconds.
 */

export const ANIMATION_TIMING = {
  // Scene 1: Choose your market
  scene1: {
    searchFadeIn: 300,
    chipGlideDelay: 200,
    chipGlideDuration: 600,
    cardSlideDelay: 800,
    cardSlideDuration: 600,
    radarPulseDuration: 2000,
    totalDuration: 2800,
  },

  // Scene 2: Read the momentum
  scene2: {
    priceLine: {
      drawDelay: 200,
      drawDuration: 1200,
    },
    rsiPanel: {
      fadeInDelay: 400,
      fadeInDuration: 400,
      lineDrawDelay: 600,
      lineDrawDuration: 1000,
    },
    macdPanel: {
      fadeInDelay: 600,
      fadeInDuration: 400,
      barsDelay: 800,
      barsDuration: 1200,
    },
    badgeDelay: 1800,
    badgeDuration: 400,
    totalDuration: 3800,
  },

  // Scene 3: Act from the console
  scene3: {
    panelsGlideDelay: 200,
    panelsGlideDuration: 600,
    tableSlideDelay: 400,
    tableSlideDuration: 800,
    alertSlideDelay: 600,
    alertSlideDuration: 700,
    totalDuration: 3200,
  },

  // Scene transitions
  sceneWipe: {
    duration: 700,
  },

  // Final scene timing
  final: {
    fadeIn: 400,
    ctas: 0,
  },

  // Auto-advance
  sceneAutoAdvanceDelay: (totalDuration: number): number => totalDuration + 500,
} as const;

/**
 * Get prefers-reduced-motion status.
 * When true, skip all timers and render static explanation cards.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
