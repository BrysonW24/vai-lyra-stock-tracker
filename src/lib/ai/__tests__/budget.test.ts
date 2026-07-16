import { describe, it, expect } from 'vitest';
import { evaluateProviderBudget, type BudgetPolicy } from '../budget';

describe('ai budget · evaluateProviderBudget', () => {
  it('allows a call comfortably under every ceiling', () => {
    const policy: BudgetPolicy = { perRun: 100, perDay: 1000, perMonth: 10_000 };
    const v = evaluateProviderBudget(policy, 10, { day: 100, month: 1000 });
    expect(v.decision).toBe('allow');
    expect(v.window).toBeUndefined();
  });

  it('treats undefined ceilings as unlimited', () => {
    const v = evaluateProviderBudget({}, 1_000_000, { day: 999_999, month: 999_999 });
    expect(v.decision).toBe('allow');
  });

  it('warns at 80% utilisation of the binding window', () => {
    const v = evaluateProviderBudget({ perDay: 100 }, 30, { day: 55 }); // projected 85 / 100 = 85%
    expect(v.decision).toBe('warn');
    expect(v.window).toBe('day');
    expect(v.utilisation).toBeCloseTo(0.85, 5);
  });

  it('does not warn just below the threshold', () => {
    const v = evaluateProviderBudget({ perDay: 100 }, 10, { day: 69 }); // 79%
    expect(v.decision).toBe('allow');
  });

  it('blocks when a call would exceed the run ceiling', () => {
    const v = evaluateProviderBudget({ perRun: 50 }, 60);
    expect(v.decision).toBe('block');
    expect(v.window).toBe('run');
    expect(v.reason).toMatch(/run budget exceeded/);
  });

  it('per-run ignores prior spend (a run window starts fresh each call)', () => {
    // Even with huge day/month spend, a single run at cost 10 under a perRun of 50 is fine on the run axis.
    const v = evaluateProviderBudget({ perRun: 50 }, 10, { day: 9999, month: 9999 });
    expect(v.decision).toBe('allow');
  });

  it('blocks when the day window is exceeded even if the run window is fine', () => {
    const v = evaluateProviderBudget({ perRun: 100, perDay: 200 }, 50, { day: 180 }); // day 230 > 200
    expect(v.decision).toBe('block');
    expect(v.window).toBe('day');
  });

  it('picks the most restrictive window (block beats warn)', () => {
    // day would only warn (85%), month would block (exceeded).
    const v = evaluateProviderBudget({ perDay: 100, perMonth: 100 }, 30, { day: 55, month: 90 });
    expect(v.decision).toBe('block');
    expect(v.window).toBe('month');
  });

  it('exact-ceiling projection is allowed, not blocked', () => {
    const v = evaluateProviderBudget({ perDay: 100 }, 45, { day: 55 }); // exactly 100
    expect(v.decision).toBe('warn'); // 100% >= 80% warn, but not > ceiling
    expect(v.utilisation).toBeCloseTo(1, 5);
  });

  it('fails closed on a negative ceiling', () => {
    const v = evaluateProviderBudget({ perDay: -5 }, 1);
    expect(v.decision).toBe('block');
    expect(v.window).toBe('policy');
  });

  it('fails closed on a non-finite ceiling', () => {
    const v = evaluateProviderBudget({ perMonth: Number.POSITIVE_INFINITY }, 1);
    expect(v.decision).toBe('block');
    expect(v.window).toBe('policy');
  });

  it('fails closed on a non-finite or negative cost', () => {
    expect(evaluateProviderBudget({ perDay: 100 }, Number.NaN).decision).toBe('block');
    expect(evaluateProviderBudget({ perDay: 100 }, -1).decision).toBe('block');
  });

  it('a zero ceiling blocks any positive-cost call', () => {
    const v = evaluateProviderBudget({ perDay: 0 }, 1);
    expect(v.decision).toBe('block');
    expect(v.window).toBe('day');
  });
});
