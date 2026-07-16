import { describe, it, expect } from 'vitest';
import { reconcileStatedVsRevealed } from '@/lib/twin/reconcile';
import type { RevealedRisk } from '@/lib/twin/model';

const base: RevealedRisk = {
  tradeCount: 4,
  avgNotional: 1000,
  avgSizePctOfCap: 10,
  sizeAfterLossDeltaPct: 0,
  topThemeConcentrationPct: 40,
  lateStageChasePct: 45,
  stageLean: 'mixed',
};

const NO_ADVICE = /\b(should|buy|sell|recommend|advice)\b/i;

describe('twin · reconcile stated vs revealed', () => {
  it('flags trading bolder than a cautious stated posture', () => {
    const r = reconcileStatedVsRevealed(
      { riskComfort: 'conservative', maxPositionSizePct: 10 },
      { ...base, avgSizePctOfCap: 15, lateStageChasePct: 75, sizeAfterLossDeltaPct: 78 },
    );
    expect(r.statedRisk).toBe('cautious');
    expect(r.revealedRisk).toBe('bold');
    expect(r.gap).toBe('bolder-than-stated');
    expect(r.factors.length).toBeGreaterThan(0);
    expect(r.summary).not.toMatch(NO_ADVICE);
  });

  it('reports aligned when behaviour matches the stated band', () => {
    const r = reconcileStatedVsRevealed(
      { riskComfort: 'balanced', maxPositionSizePct: 10 },
      { ...base, avgSizePctOfCap: 9, lateStageChasePct: 40, sizeAfterLossDeltaPct: 5 },
    );
    expect(r.statedRisk).toBe('balanced');
    expect(r.revealedRisk).toBe('balanced');
    expect(r.gap).toBe('aligned');
    expect(r.summary).not.toMatch(NO_ADVICE);
  });

  it('flags trading more cautious than an aggressive stated posture', () => {
    const r = reconcileStatedVsRevealed(
      { riskComfort: 'aggressive', maxPositionSizePct: 20 },
      { ...base, tradeCount: 5, avgSizePctOfCap: 5, lateStageChasePct: 20, sizeAfterLossDeltaPct: -20 },
    );
    expect(r.statedRisk).toBe('bold');
    expect(r.revealedRisk).toBe('cautious');
    expect(r.gap).toBe('more-cautious-than-stated');
    expect(r.summary).not.toMatch(NO_ADVICE);
  });

  it('returns insufficient-data with too few trades', () => {
    const r = reconcileStatedVsRevealed(
      { riskComfort: 'balanced', maxPositionSizePct: 10 },
      { ...base, tradeCount: 1 },
    );
    expect(r.revealedRisk).toBe('unknown');
    expect(r.gap).toBe('insufficient-data');
    expect(r.summary).toMatch(/not enough trading history/i);
  });

  it('is insufficient-data when the stated posture is unknown', () => {
    const r = reconcileStatedVsRevealed({ riskComfort: undefined, maxPositionSizePct: 10 }, base);
    expect(r.statedRisk).toBe('unknown');
    expect(r.gap).toBe('insufficient-data');
  });
});
