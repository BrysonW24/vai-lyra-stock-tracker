import { describe, it, expect } from 'vitest';
import { recoveryProbability, recoveryBand, recoveryFeatures, RECOVERY_MODEL_META, type RecoverySignal } from '../recovery-probability';
import model from '@/lib/generated/recovery-model.json';

/**
 * Drift guard: the TS inference MUST reproduce the Python model exactly. The trainer exports fixtures
 * (raw inputs -> probability computed by recovery_model.py); if this TS mirror diverges by more than a
 * rounding epsilon, the two implementations have drifted and the build goes red. Same discipline as
 * the Pine strategy mirror.
 */
describe('ml recovery-probability · drift guard vs the Python model', () => {
  const fixtures = (model as { fixtures: Array<{ raw: RecoverySignal; prob: number }> }).fixtures;

  it('has fixtures to check', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
  });

  it('matches the Python-computed probability for every fixture', () => {
    for (const f of fixtures) {
      const got = recoveryProbability(f.raw);
      expect(Math.abs(got - f.prob)).toBeLessThan(1e-6);
    }
  });
});

describe('ml recovery-probability · behaviour', () => {
  const base: RecoverySignal = {
    rsi: 42,
    rsiDelta: 0,
    macdHist: -0.5,
    macdHistDelta: 0,
    distFromLowPct: 8,
    aboveSma200: false,
    volumeRatio: 1,
    score: 50,
  };

  it('always returns a probability in [0,1]', () => {
    for (const s of [base, { ...base, score: 0 }, { ...base, score: 100, rsi: 40, macdHistDelta: 1.5 }]) {
      const p = recoveryProbability(s);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('is monotonic in the composite score (higher score -> not-lower probability)', () => {
    const low = recoveryProbability({ ...base, score: 20 });
    const mid = recoveryProbability({ ...base, score: 50 });
    const high = recoveryProbability({ ...base, score: 85 });
    expect(mid).toBeGreaterThanOrEqual(low);
    expect(high).toBeGreaterThanOrEqual(mid);
  });

  it('rewards improving momentum (a rising MACD histogram lifts the probability)', () => {
    const flat = recoveryProbability({ ...base, macdHistDelta: 0 });
    const improving = recoveryProbability({ ...base, macdHistDelta: 1.2 });
    expect(improving).toBeGreaterThan(flat);
  });

  it('rewards sitting in the reset band vs a washed-out RSI', () => {
    const inBand = recoveryProbability({ ...base, rsi: 42 });
    const washedOut = recoveryProbability({ ...base, rsi: 22 });
    expect(inBand).toBeGreaterThan(washedOut);
  });

  it('bands the probability without false precision', () => {
    expect(recoveryBand(0.75)).toBe('likely');
    expect(recoveryBand(0.5)).toBe('building');
    expect(recoveryBand(0.2)).toBe('unlikely');
  });

  it('exposes an out-of-sample-validated model card (AUC beats chance, Brier beats baseline)', () => {
    expect(RECOVERY_MODEL_META.oosAuc).toBeGreaterThan(0.65);
    expect(RECOVERY_MODEL_META.oosBrier).toBeLessThan(RECOVERY_MODEL_META.baselineBrier);
    expect(RECOVERY_MODEL_META.provenance).toMatch(/research only/i);
  });

  it('feature vector has the declared arity', () => {
    expect(recoveryFeatures(base)).toHaveLength((model as { featureOrder: string[] }).featureOrder.length);
  });
});
