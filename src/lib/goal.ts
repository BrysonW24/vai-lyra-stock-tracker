/**
 * Goal engine - turns the user's capital, contributions and holdings into a single, visible
 * "where am I against my goal" read. This is the spine of the goal-oriented experience: the app
 * should never make you hunt for whether you are winning. Deterministic and pure - no I/O, no
 * predictions, no advice. It states standing, progress and pace from real numbers; it never
 * promises a return.
 *
 * Target: an explicit user target if one is set, otherwise the next rung on a milestone ladder, so
 * there is ALWAYS a concrete next number to climb toward (and a motivating progress bar) without
 * fabricating a goal the user never stated.
 */

/** The milestone ladder - the default "next number to climb to" when no explicit target is set. */
export const GOAL_MILESTONES = [1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1_000_000, 2_500_000, 5_000_000];

export type GoalPace = 'ahead' | 'on_track' | 'behind' | 'unknown';

export interface GoalInput {
  /** Total account value now = holdings market value + uninvested cash. */
  equity: number;
  /** Sum of cost basis of open holdings (for the return calculation). */
  investedBasis: number;
  /** Uninvested cash available to deploy. */
  cashAvailable?: number | null;
  /** Recurring monthly top-up, if any - drives the pace-to-target estimate. */
  monthlyContribution?: number | null;
  /** Explicit user target amount, if set. Overrides the milestone ladder. */
  targetAmount?: number | null;
  /** Freeform goal label from onboarding (e.g. "grow_portfolio"), for the headline. */
  primaryGoal?: string | null;
}

export interface GoalProgress {
  equity: number;
  /** The number being climbed to - explicit target or the next milestone above equity. */
  target: number;
  /** The number climbed FROM - the previous milestone (or 0 for an explicit target). */
  fromAnchor: number;
  targetIsMilestone: boolean;
  /** 0-100 progress from the anchor to the target. */
  progressPct: number;
  /** Target minus equity (never negative). */
  remaining: number;
  totalReturnDollars: number;
  totalReturnPct: number;
  /** Months to reach the target from contributions ALONE (no assumed market growth). Null when unknown. */
  monthsToTargetAtContribution: number | null;
  pace: GoalPace;
  /** Plain-English one-liner: where you stand against the goal. */
  headline: string;
  /** Plain-English second line: what would move you toward it. */
  subline: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** The next milestone strictly above `value` (or the top rung when already past the ladder). */
export function nextMilestone(value: number): { from: number; to: number } {
  for (let i = 0; i < GOAL_MILESTONES.length; i += 1) {
    if (value < GOAL_MILESTONES[i]) {
      return { from: i === 0 ? 0 : GOAL_MILESTONES[i - 1], to: GOAL_MILESTONES[i] };
    }
  }
  // Past the top rung: climb toward the next round doubling so the bar keeps meaning.
  const top = GOAL_MILESTONES[GOAL_MILESTONES.length - 1];
  return { from: top, to: top * 2 };
}

const fmt = (n: number) => {
  if (n >= 1_000_000) return `$${round2(n / 1_000_000)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
};

/**
 * Compute the full goal read. When an explicit target is set, progress runs from 0 to it; otherwise
 * from the previous milestone to the next, so the bar reflects the current climb rather than always
 * looking near-empty.
 */
export function computeGoalProgress(input: GoalInput): GoalProgress {
  const equity = Math.max(0, Number.isFinite(input.equity) ? input.equity : 0);
  const investedBasis = Math.max(0, Number.isFinite(input.investedBasis) ? input.investedBasis : 0);
  const monthly = Math.max(0, Number(input.monthlyContribution) || 0);

  const hasExplicit = typeof input.targetAmount === 'number' && input.targetAmount > equity;
  let target: number;
  let fromAnchor: number;
  let targetIsMilestone: boolean;
  if (hasExplicit) {
    target = input.targetAmount as number;
    fromAnchor = 0;
    targetIsMilestone = false;
  } else {
    const m = nextMilestone(equity);
    target = m.to;
    fromAnchor = m.from;
    targetIsMilestone = true;
  }

  const span = Math.max(1, target - fromAnchor);
  const progressPct = clampPct(((equity - fromAnchor) / span) * 100);
  const remaining = Math.max(0, round2(target - equity));

  // Return is measured on invested capital only (cash at rest earns nothing here).
  const investedReturnDollars = round2(equity - (Number(input.cashAvailable) || 0) - investedBasis);
  const totalReturnPct = investedBasis > 0 ? round2((investedReturnDollars / investedBasis) * 100) : 0;

  const monthsToTargetAtContribution = monthly > 0 ? Math.ceil(remaining / monthly) : null;

  // Pace: with contributions we can only speak to the contribution path honestly (no market growth
  // assumed). Behind if it would take a long time on top-ups alone; ahead if remaining is tiny.
  let pace: GoalPace = 'unknown';
  if (monthly > 0) {
    if (monthsToTargetAtContribution !== null && monthsToTargetAtContribution <= 12) pace = 'ahead';
    else if (monthsToTargetAtContribution !== null && monthsToTargetAtContribution <= 36) pace = 'on_track';
    else pace = 'behind';
  }

  const goalLabel = input.primaryGoal ? input.primaryGoal.replace(/_/g, ' ') : null;
  const headline = `${fmt(equity)} of ${fmt(target)}${targetIsMilestone ? ' (next milestone)' : ' target'} - ${progressPct}% there`;
  const returnBit = investedBasis > 0 ? `${investedReturnDollars >= 0 ? '+' : ''}${fmt(Math.abs(investedReturnDollars))} (${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct}%) on invested capital` : 'no positions open yet';
  const paceBit =
    monthsToTargetAtContribution !== null
      ? `${fmt(remaining)} to go - about ${monthsToTargetAtContribution} month${monthsToTargetAtContribution === 1 ? '' : 's'} on your top-ups alone.`
      : `${fmt(remaining)} to go. Set a monthly top-up to see a pace to target.`;
  const subline = `${returnBit}. ${paceBit}${goalLabel ? ` Goal: ${goalLabel}.` : ''}`;

  return {
    equity: round2(equity),
    target,
    fromAnchor,
    targetIsMilestone,
    progressPct,
    remaining,
    totalReturnDollars: investedReturnDollars,
    totalReturnPct,
    monthsToTargetAtContribution,
    pace,
    headline,
    subline,
  };
}
