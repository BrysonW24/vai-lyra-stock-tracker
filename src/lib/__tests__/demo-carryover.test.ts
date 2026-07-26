import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  saveDemoCarryover,
  loadDemoCarryover,
  hasDemoCarryover,
  clearDemoCarryover,
} from '@/lib/demo-carryover';
import { createInitialOnboardingState, type OnboardingState } from '@/lib/onboarding';

const KEY = 'lyra_demo_carryover_v1';

function stubStorage(initial: Record<string, string> = {}, failWrite = false) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failWrite) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        store.set(k, v);
      },
      removeItem: (k: string) => void store.delete(k),
    },
  });
  return store;
}

/** A realistic full demo setup: strategy, universe, watchlist AND portfolio. */
function fullSetup(): OnboardingState {
  return {
    ...createInitialOnboardingState('full_setup'),
    strategy: { strategyId: 'momentum-recovery', overrides: {} },
    marketUniverse: { selectedCategories: [], customTickers: ['NVDA'] },
    watchlist: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }],
    portfolio: [{ symbol: 'TSLA', quantity: 10, averageBuyPrice: 200 }],
  };
}

describe('demo-carryover snapshot', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips the FULL onboarding state, not just holdings/watchlist', () => {
    const store = stubStorage();
    const state = fullSetup();
    expect(saveDemoCarryover(state, '2026-07-26T00:00:00.000Z')).toBe(true);
    expect(store.has(KEY)).toBe(true);

    const loaded = loadDemoCarryover();
    expect(loaded).not.toBeNull();
    expect(loaded?.strategy?.strategyId).toBe('momentum-recovery');
    expect(loaded?.marketUniverse?.customTickers).toEqual(['NVDA']);
    expect(loaded?.watchlist.map((w) => w.symbol)).toEqual(['AAPL', 'MSFT']);
    expect(loaded?.portfolio[0]).toMatchObject({ symbol: 'TSLA', quantity: 10, averageBuyPrice: 200 });
  });

  it('hasDemoCarryover reflects presence, and clear removes it', () => {
    stubStorage();
    expect(hasDemoCarryover()).toBe(false);
    saveDemoCarryover(fullSetup(), 'ts');
    expect(hasDemoCarryover()).toBe(true);
    clearDemoCarryover();
    expect(hasDemoCarryover()).toBe(false);
    expect(loadDemoCarryover()).toBeNull();
  });

  it('treats a shape-invalid or corrupt snapshot as absent (never throws on mount)', () => {
    // Missing the required arrays -> not a usable carryover.
    stubStorage({ [KEY]: JSON.stringify({ state: { path: 'full_setup' } }) });
    expect(loadDemoCarryover()).toBeNull();
    // Non-JSON garbage.
    stubStorage({ [KEY]: 'not-json{' });
    expect(loadDemoCarryover()).toBeNull();
  });

  it('degrades to false on a storage write failure (private mode / quota), never throws', () => {
    stubStorage({}, true);
    expect(saveDemoCarryover(fullSetup(), 'ts')).toBe(false);
  });

  it('is inert during SSR (no window) rather than crashing', () => {
    vi.stubGlobal('window', undefined);
    expect(saveDemoCarryover(fullSetup(), 'ts')).toBe(false);
    expect(loadDemoCarryover()).toBeNull();
    expect(hasDemoCarryover()).toBe(false);
    expect(() => clearDemoCarryover()).not.toThrow();
  });
});
