import { describe, it, expect } from 'vitest';
import { computeGoalProgress, nextMilestone, GOAL_MILESTONES } from '@/lib/goal';

describe('nextMilestone', () => {
  it('climbs from the previous rung to the next above the value', () => {
    expect(nextMilestone(6200)).toEqual({ from: 5000, to: 10000 });
    expect(nextMilestone(500)).toEqual({ from: 0, to: 1000 });
  });
  it('doubles past the top rung so the bar keeps meaning', () => {
    const top = GOAL_MILESTONES[GOAL_MILESTONES.length - 1];
    expect(nextMilestone(top + 1)).toEqual({ from: top, to: top * 2 });
  });
});

describe('computeGoalProgress', () => {
  it('measures progress from zero to the next milestone so the bar matches "X of Y"', () => {
    // $6,200 toward the $10k milestone -> 6200/10000 = 62%. fromAnchor still records the previous
    // rung ($5k) for context, but the bar runs from zero so it agrees with "$6.2k of $10k" on screen.
    const g = computeGoalProgress({ equity: 6200, investedBasis: 5000, cashAvailable: 1200 });
    expect(g.target).toBe(10000);
    expect(g.fromAnchor).toBe(5000);
    expect(g.progressPct).toBe(62);
    expect(g.targetIsMilestone).toBe(true);
    expect(g.remaining).toBe(3800);
  });

  it('honours an explicit target above equity and runs progress from zero', () => {
    const g = computeGoalProgress({ equity: 25000, investedBasis: 20000, targetAmount: 100000 });
    expect(g.target).toBe(100000);
    expect(g.targetIsMilestone).toBe(false);
    expect(g.progressPct).toBe(25);
  });

  it('computes return on invested capital, not on cash at rest', () => {
    // equity 11,000 = 10,000 positions + 1,000 cash; invested basis 8,000 -> +2,000 (+25%).
    const g = computeGoalProgress({ equity: 11000, investedBasis: 8000, cashAvailable: 1000 });
    expect(g.totalReturnDollars).toBe(2000);
    expect(g.totalReturnPct).toBe(25);
  });

  it('reports pace from contributions alone and flags a far-off target as behind', () => {
    const g = computeGoalProgress({ equity: 6000, investedBasis: 5000, monthlyContribution: 50 });
    // remaining ~4000 at $50/mo -> 80 months -> behind.
    expect(g.monthsToTargetAtContribution).toBe(80);
    expect(g.pace).toBe('behind');
  });

  it('is unknown pace when no contribution is set', () => {
    const g = computeGoalProgress({ equity: 6000, investedBasis: 5000 });
    expect(g.monthsToTargetAtContribution).toBeNull();
    expect(g.pace).toBe('unknown');
  });
});
