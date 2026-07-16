import { describe, it, expect } from 'vitest';
import { getOutcomeDistribution, formatOutcomeSummary, expectancyFromOutcome } from '../outcomes';

describe('outcomes honesty', () => {
  it('stamps demo distributions as illustrative, never measured', () => {
    const dist = getOutcomeDistribution('momentum_recovery_v1', 'strong_setup');
    expect(dist).not.toBeNull();
    expect(dist?.provenance).toBe('illustrative');
  });

  it('labels an illustrative summary so it is not mistaken for measured history', () => {
    const dist = getOutcomeDistribution('momentum_recovery_v1', 'strong_setup');
    const summary = formatOutcomeSummary(dist);
    expect(summary.toLowerCase()).toContain('illustrative');
    expect(summary.toLowerCase()).toContain('no measured history');
  });

  it('co-displays expectancy so a high win rate is not read as edge on its own', () => {
    const dist = getOutcomeDistribution('momentum_recovery_v1', 'strong_setup');
    const summary = formatOutcomeSummary(dist);
    expect(summary.toLowerCase()).toContain('expectancy');
  });

  it('derives expectancy inputs from the distribution as a documented proxy', () => {
    const dist = getOutcomeDistribution('momentum_recovery_v1', 'strong_setup');
    const exp = expectancyFromOutcome(dist);
    expect(exp).not.toBeNull();
    expect(exp?.winRatePct).toBe(dist?.return20dWinRate);
    expect(exp?.avgWinPct).toBe(dist?.maxUpsideMedian);
    expect(exp?.avgLossPct).toBe(Math.abs(dist?.worstDrawdownMin ?? 0));
  });

  it('returns null for an unknown signal key', () => {
    expect(getOutcomeDistribution('nope', 'nope')).toBeNull();
    expect(formatOutcomeSummary(null)).toBe('Insufficient historical data.');
    expect(expectancyFromOutcome(null)).toBeNull();
  });
});
