/**
 * Hosted-key budget tracker - evaluateProviderBudget finally has a production caller; this
 * pins the wiring: per-run ceiling, per-day accumulation, block-does-not-charge, day rollover.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chargeHostedBudget, resetHostedBudgetForTests } from '../budget-tracker';

const NOW = new Date('2026-07-16T12:00:00Z');

describe('chargeHostedBudget', () => {
  beforeEach(() => {
    resetHostedBudgetForTests();
    process.env.LYRA_HOSTED_TOKENS_PER_RUN = '1000';
    process.env.LYRA_HOSTED_TOKENS_PER_DAY = '2500';
  });
  afterEach(() => {
    delete process.env.LYRA_HOSTED_TOKENS_PER_RUN;
    delete process.env.LYRA_HOSTED_TOKENS_PER_DAY;
    resetHostedBudgetForTests();
  });

  it('allows within budget and blocks once the day ceiling is hit', () => {
    expect(chargeHostedBudget('hosted_openai', 700, NOW).decision).toBe('allow');
    expect(chargeHostedBudget('hosted_openai', 700, NOW).decision).toBe('allow');
    // 1400 spent; 700 more = 84% of the 2500 day ceiling - a warn, still charged.
    expect(chargeHostedBudget('hosted_openai', 700, NOW).decision).toBe('warn');
    // 2100 spent; 700 more would breach 2500.
    const fourth = chargeHostedBudget('hosted_openai', 700, NOW);
    expect(fourth.decision).toBe('block');
    expect(fourth.window).toBe('day');
    // The blocked call was NOT charged - a smaller call still fits.
    expect(chargeHostedBudget('hosted_openai', 300, NOW).decision).not.toBe('block');
  });

  it('blocks a single run above the per-run ceiling', () => {
    const verdict = chargeHostedBudget('hosted_openai', 1500, NOW);
    expect(verdict.decision).toBe('block');
    expect(verdict.window).toBe('run');
  });

  it('resets the day window on rollover and tracks sources independently', () => {
    for (let call = 0; call < 3; call++) {
      expect(chargeHostedBudget('hosted_openai', 800, NOW).decision).not.toBe('block');
    }
    // 2400 spent; 800 more would breach the 2500 day ceiling.
    expect(chargeHostedBudget('hosted_openai', 800, NOW).decision).toBe('block');
    // Different source: its own counter (800/1000 per-run = an 80% warn, never a block).
    expect(chargeHostedBudget('shared_google', 800, NOW).decision).not.toBe('block');
    // Next day: counter resets.
    const tomorrow = new Date('2026-07-17T12:00:00Z');
    expect(chargeHostedBudget('hosted_openai', 800, tomorrow).decision).not.toBe('block');
  });
});
