import { describe, it, expect } from 'vitest';
import {
  SETUP_PATHS,
  effectiveStepsFor,
  calculateSetupCompleteness,
  calculateCompletion,
  getNextStep,
  getPreviousStep,
  createInitialOnboardingState,
  type OnboardingState,
} from '@/lib/onboarding';
import { resolveOnboardingAlertMode } from '@/lib/alert-prefs';

/**
 * 2026-07-27 audit V7: the onboarding navigation + completeness logic (step lists, the never-traded
 * disqualifier, the 60/40 completeness math, and the handleFinish alert-mode mapping) shipped with no
 * unit test. These pin those user-critical flow invariants so they cannot regress silently.
 */

describe('SETUP_PATHS step arrays (the navigation contract)', () => {
  it('quick_start skips watchlist + portfolio', () => {
    expect(SETUP_PATHS.quick_start.steps).toEqual([1, 2, 3, 10, 9]);
    expect(SETUP_PATHS.quick_start.skipWatchlist).toBe(true);
    expect(SETUP_PATHS.quick_start.skipPortfolio).toBe(true);
  });

  it('watchlist_first includes the watchlist beat and skips portfolio', () => {
    expect(SETUP_PATHS.watchlist_first.steps).toEqual([1, 2, 3, 4, 10, 9]);
    expect(SETUP_PATHS.watchlist_first.skipPortfolio).toBe(true);
  });

  it('full_setup is the complete beat list', () => {
    expect(SETUP_PATHS.full_setup.steps).toEqual([1, 2, 3, 4, 5, 10, 6, 7, 8, 9]);
  });
});

describe('effectiveStepsFor (never-traded disqualifier)', () => {
  it('drops the Holdings (5) and Snapshots (6) beats for a never-traded user', () => {
    expect(effectiveStepsFor('full_setup', true)).toEqual([1, 2, 3, 4, 10, 7, 8, 9]);
    expect(effectiveStepsFor('portfolio_first', true)).toEqual([1, 2, 3, 4, 10, 7, 8, 9]);
  });

  it('returns the full step list for a user who has traded', () => {
    expect(effectiveStepsFor('full_setup', false)).toEqual(SETUP_PATHS.full_setup.steps);
  });

  it('returns a fresh array (never a reference to the shared SETUP_PATHS steps)', () => {
    expect(effectiveStepsFor('quick_start', false)).not.toBe(SETUP_PATHS.quick_start.steps);
  });
});

describe('calculateSetupCompleteness (60/40 core/enrichment)', () => {
  // Deliberately-degenerate states cast through unknown so the boundary math can be pinned directly.
  it('is 0% for an empty state with no earned core or enrichment', () => {
    const state = {
      ...createInitialOnboardingState('full_setup'),
      profile: undefined,
      marketUniverse: { selectedCategories: [], customTickers: [] },
      strategy: undefined,
      alerts: { strongSetupAlerts: false, portfolioRiskAlerts: false, dailyDigest: false },
      watchlist: [],
      portfolio: [],
      capital: undefined,
    } as unknown as OnboardingState;
    expect(calculateSetupCompleteness(state).percentage).toBe(0);
  });

  it('is 60% when all core items are earned but no enrichment', () => {
    const state = {
      ...createInitialOnboardingState('full_setup'),
      profile: { experienceLevel: 'intermediate' },
      marketUniverse: { selectedCategories: ['tech'], customTickers: [] },
      strategy: { strategyId: 'lyra_recovery' },
      alerts: { strongSetupAlerts: true, portfolioRiskAlerts: false, dailyDigest: false },
      watchlist: [],
      portfolio: [],
      capital: undefined,
    } as unknown as OnboardingState;
    expect(calculateSetupCompleteness(state).percentage).toBe(60);
  });

  it('reports the missing enrichment items', () => {
    const state = { ...createInitialOnboardingState('full_setup'), watchlist: [], portfolio: [] } as OnboardingState;
    const { missing } = calculateSetupCompleteness(state);
    expect(missing).toContain('watchlist');
    expect(missing).toContain('portfolio');
  });
});

describe('nav helpers', () => {
  it('calculateCompletion is completed/required as a percentage', () => {
    const state = createInitialOnboardingState('quick_start'); // 5 steps
    state.completedSteps = [1, 2, 3];
    expect(calculateCompletion(state)).toBe(60); // 3/5
  });

  it('getNextStep returns the first uncompleted step in the path', () => {
    const state = createInitialOnboardingState('quick_start'); // [1,2,3,10,9]
    state.completedSteps = [1, 2];
    expect(getNextStep(state)).toBe(3);
  });

  it('getPreviousStep walks back through the path order', () => {
    const state = createInitialOnboardingState('quick_start'); // [1,2,3,10,9]
    expect(getPreviousStep(state, 10)).toBe(3);
    expect(getPreviousStep(state, 1)).toBeNull();
  });
});

describe('resolveOnboardingAlertMode (handleFinish alert-mode mapping)', () => {
  it('is muted in Solo/demo regardless of choices (no background delivery)', () => {
    expect(resolveOnboardingAlertMode({ localMode: true, strongSetupAlerts: true })).toBe('muted');
  });

  it('is live when any instant alert is on (account mode)', () => {
    expect(resolveOnboardingAlertMode({ localMode: false, portfolioRiskAlerts: true })).toBe('live');
  });

  it('is quiet for a digest-only choice', () => {
    expect(resolveOnboardingAlertMode({ localMode: false, dailyDigest: true })).toBe('quiet');
  });

  it('is muted when nothing is chosen', () => {
    expect(resolveOnboardingAlertMode({ localMode: false })).toBe('muted');
  });
});
