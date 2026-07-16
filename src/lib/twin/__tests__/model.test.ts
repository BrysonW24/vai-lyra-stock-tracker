import { describe, it, expect } from 'vitest';
import {
  computeTwinProfile,
  TWIN_MODEL_VERSION,
  MIN_TWIN_EVENTS,
  type TwinInputs,
} from '@/lib/twin/model';

// Fixed clock so recency (and therefore every weight) is deterministic.
const NOW = Date.parse('2026-07-16T00:00:00Z');

/**
 * A deliberately-shaped history: Space & Defence heavy, late-stage tilting, and the size on the
 * trade opened right after a losing close is larger than baseline (the "size up after a loss" tell).
 */
const FIXTURE: TwinInputs = {
  capital: 10000,
  trades: [
    { symbol: 'rklb', theme: 'Space & Defence', signalKinds: ['gov-award'], stage: 'funded', openedAt: '2026-07-10', closedAt: '2026-07-12', notional: 1000, realisedPnl: -50 },
    { symbol: 'lmt', theme: 'Space & Defence', signalKinds: ['gov-award', 'big-tech-backing'], stage: 'scaling', openedAt: '2026-07-13', notional: 1600, realisedPnl: null },
    { symbol: 'nvda', theme: 'AI', signalKinds: ['momentum'], stage: 'crowded', openedAt: '2026-07-05', closedAt: '2026-07-06', notional: 900, realisedPnl: 120 },
    { symbol: 'pltr', theme: 'AI', signalKinds: ['institutional'], stage: 'scaling', openedAt: '2026-07-08', notional: 800, realisedPnl: null },
  ],
  watches: [
    { symbol: 'rklb', theme: 'Space & Defence', stage: 'funded', addedAt: '2026-07-14' },
    { symbol: 'asts', theme: 'Space & Defence', stage: 'concept', addedAt: '2026-07-15' },
  ],
};

describe('twin model · computeTwinProfile', () => {
  const p = computeTwinProfile(FIXTURE, NOW);

  it('stamps the version and counts every behavioural event', () => {
    expect(p.version).toBe(TWIN_MODEL_VERSION);
    expect(p.interactions).toBe(6);
    expect(p.hasEnoughData).toBe(true);
  });

  it('surfaces the dominant theme deterministically', () => {
    expect(p.themes[0].key).toBe('Space & Defence');
    expect(p.themes[0].sharePct).toBeGreaterThan(0);
    // Shares across a dimension sum to ~100.
    const total = p.themes.reduce((s, t) => s + t.sharePct, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
  });

  it('uppercases + aggregates symbol affinity (rklb watched AND traded)', () => {
    const rklb = p.symbols.find((s) => s.key === 'RKLB');
    expect(rklb).toBeDefined();
    expect(rklb?.count).toBe(2); // one trade + one watch
  });

  it('captures the signal kinds the user leans into', () => {
    expect(p.signalKinds.map((k) => k.key)).toContain('gov-award');
  });

  it('derives revealed sizing as a % of capital', () => {
    expect(p.revealedRisk.tradeCount).toBe(4);
    expect(p.revealedRisk.avgNotional).toBe(1075); // (1000+1600+900+800)/4
    expect(p.revealedRisk.avgSizePctOfCap).toBe(10.8); // 10.75 rounded to 1dp
  });

  it('detects sizing up after a losing close', () => {
    // after-loss avg (1600) vs baseline avg (900) = +77.8%
    expect(p.revealedRisk.sizeAfterLossDeltaPct).toBe(77.8);
  });

  it('measures late-stage chase over stage-tagged entries', () => {
    // scaling + scaling + crowded of 4 trades = 75% late
    expect(p.revealedRisk.lateStageChasePct).toBe(75);
    expect(p.revealedRisk.stageLean).not.toBeNull();
  });

  it('reports concentration as the top theme share', () => {
    expect(p.revealedRisk.topThemeConcentrationPct).toBe(p.themes[0].sharePct);
  });
});

describe('twin model · attention capture', () => {
  it('folds opt-in attention into affinities and the interaction count', () => {
    const p = computeTwinProfile(
      {
        trades: [],
        watches: [],
        attention: [
          { symbol: 'RKLB', theme: 'Space & Defence', at: '2026-07-15' },
          { theme: 'Space & Defence', at: '2026-07-15' },
          { symbol: 'NVDA', theme: 'AI', at: '2026-07-15' },
        ],
      },
      NOW,
    );
    expect(p.interactions).toBe(3);
    expect(p.hasEnoughData).toBe(true);
    expect(p.themes[0].key).toBe('Space & Defence');
    expect(p.symbols.find((s) => s.key === 'RKLB')).toBeDefined();
    // Attention has no trades -> revealed risk stays empty.
    expect(p.revealedRisk.tradeCount).toBe(0);
  });
});

describe('twin model · thin / empty history', () => {
  it('an empty history is a valid but not-enough profile', () => {
    const empty = computeTwinProfile({ trades: [], watches: [] }, NOW);
    expect(empty.interactions).toBe(0);
    expect(empty.hasEnoughData).toBe(false);
    expect(empty.themes).toEqual([]);
    expect(empty.revealedRisk.tradeCount).toBe(0);
    expect(empty.revealedRisk.avgSizePctOfCap).toBeNull();
    expect(empty.revealedRisk.sizeAfterLossDeltaPct).toBeNull();
  });

  it('respects the MIN_TWIN_EVENTS threshold', () => {
    const two = computeTwinProfile(
      { trades: [{ symbol: 'A', addedAt: null } as never], watches: [{ symbol: 'B' }] },
      NOW,
    );
    expect(two.interactions).toBe(2);
    expect(two.hasEnoughData).toBe(MIN_TWIN_EVENTS <= 2);
  });
});
