/**
 * Provider budget guard - ported from the Vivacity agent-runtime and adapted to Lyra. Pure and
 * network-free: given a spend policy and what has been spent, it decides whether the next call is
 * allowed, should warn, or must block. Most-restrictive-window-wins, warns at 80%, and FAILS CLOSED
 * on an invalid policy (a malformed ceiling blocks rather than waves the call through).
 *
 * This is the cost backstop that complements the auth-gate + per-user rate limit: even an
 * authenticated caller cannot run the hosted key past the configured spend ceilings.
 */

export interface BudgetPolicy {
  /** Max spend (in whatever unit the caller tracks - tokens or cents) per single run. */
  perRun?: number;
  /** Max spend per rolling day. */
  perDay?: number;
  /** Max spend per rolling month. */
  perMonth?: number;
}

export interface BudgetSpent {
  run?: number;
  day?: number;
  month?: number;
}

export type BudgetDecision = 'allow' | 'warn' | 'block';

export interface BudgetVerdict {
  decision: BudgetDecision;
  /** The window that drove the decision, when not a plain allow. */
  window?: 'run' | 'day' | 'month' | 'policy';
  reason?: string;
  /** 0-1 fraction of the binding ceiling that would be consumed after this call. */
  utilisation?: number;
}

const WARN_AT = 0.8;

function isBadCeiling(v: number | undefined): boolean {
  return v !== undefined && (!Number.isFinite(v) || v < 0);
}

/**
 * Evaluate whether a call costing `estimatedCost` is within budget given prior `spent`. Checks each
 * configured window and returns the most restrictive verdict. Undefined ceilings are unlimited.
 */
export function evaluateProviderBudget(policy: BudgetPolicy, estimatedCost: number, spent: BudgetSpent = {}): BudgetVerdict {
  // Fail closed on a malformed policy or a nonsensical cost.
  if (isBadCeiling(policy.perRun) || isBadCeiling(policy.perDay) || isBadCeiling(policy.perMonth) || !Number.isFinite(estimatedCost) || estimatedCost < 0) {
    return { decision: 'block', window: 'policy', reason: 'invalid budget policy or cost' };
  }

  const windows: Array<{ window: 'run' | 'day' | 'month'; ceiling?: number; already: number }> = [
    { window: 'run', ceiling: policy.perRun, already: 0 },
    { window: 'day', ceiling: policy.perDay, already: spent.day ?? 0 },
    { window: 'month', ceiling: policy.perMonth, already: spent.month ?? 0 },
  ];

  let worst: BudgetVerdict = { decision: 'allow' };
  for (const w of windows) {
    if (w.ceiling === undefined) continue;
    const projected = w.already + estimatedCost;
    const utilisation = w.ceiling === 0 ? Infinity : projected / w.ceiling;
    let decision: BudgetDecision = 'allow';
    let reason: string | undefined;
    if (projected > w.ceiling) {
      decision = 'block';
      reason = `${w.window} budget exceeded: ${projected} > ${w.ceiling}`;
    } else if (utilisation >= WARN_AT) {
      decision = 'warn';
      reason = `${w.window} budget at ${Math.round(utilisation * 100)}%`;
    }
    // Most restrictive wins (block > warn > allow).
    if (decision === 'block' || (decision === 'warn' && worst.decision === 'allow')) {
      worst = { decision, window: w.window, reason, utilisation: Number.isFinite(utilisation) ? utilisation : 1 };
    }
  }
  return worst;
}
