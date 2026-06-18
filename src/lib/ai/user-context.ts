import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/format';

/**
 * Signed-in user constraints from operator_profiles. This lets Lyra size suggestions against the
 * user's cash, max position size, risk, and goal instead of giving generic market commentary.
 */
export interface UserConstraints {
  experienceLevel?: string;
  investingStyle?: string;
  preferredTimeframe?: string;
  riskComfort?: string;
  primaryGoal?: string;
  cashAvailable?: number | null;
  monthlyContribution?: number | null;
  maxPositionSizePct?: number | null;
  defaultTradeAmount?: number | null;
  primaryOutcome?: string | null;
  simulationEnabled?: boolean | null;
  strategyId?: string | null;
  // Beginner branch answers (onboarding writes these when the user has never traded).
  tradedBefore?: string | null;
  beginnerMotivation?: string | null;
  beginnerKnowledge?: string | null;
  beginnerInvolvement?: string | null;
  beginnerLearningStyle?: string | null;
  beginnerHorizon?: string | null;
}

export async function getUserConstraints(): Promise<UserConstraints | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;

    const { data, error } = await supabase
      .from('operator_profiles')
      .select(
        'experience_level, investing_style, preferred_timeframe, risk_comfort, primary_goal, cash_available, monthly_contribution, max_position_size_pct, default_trade_amount, primary_outcome, simulation_enabled, strategy_id, traded_before, beginner_motivation, beginner_knowledge, beginner_involvement, beginner_learning_style, beginner_horizon',
      )
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      experienceLevel: data.experience_level ?? undefined,
      investingStyle: data.investing_style ?? undefined,
      preferredTimeframe: data.preferred_timeframe ?? undefined,
      riskComfort: data.risk_comfort ?? undefined,
      primaryGoal: data.primary_goal ?? undefined,
      cashAvailable: data.cash_available,
      monthlyContribution: data.monthly_contribution,
      maxPositionSizePct: data.max_position_size_pct,
      defaultTradeAmount: data.default_trade_amount,
      primaryOutcome: data.primary_outcome,
      simulationEnabled: data.simulation_enabled,
      strategyId: data.strategy_id,
      tradedBefore: data.traded_before,
      beginnerMotivation: data.beginner_motivation,
      beginnerKnowledge: data.beginner_knowledge,
      beginnerInvolvement: data.beginner_involvement,
      beginnerLearningStyle: data.beginner_learning_style,
      beginnerHorizon: data.beginner_horizon,
    };
  } catch {
    return null;
  }
}

export function buildConstraintsBlock(c: UserConstraints): string {
  const lines: string[] = [];
  const cash = typeof c.cashAvailable === 'number' && c.cashAvailable > 0 ? c.cashAvailable : null;

  // A user who answered "never traded before" is a brand-new beginner. Treat experience as
  // beginner and lean conservative regardless of the intermediate/balanced form defaults, so
  // suggestions are not pitched above their head.
  const isBrandNew = c.tradedBefore === 'no';
  const effectiveExperience = isBrandNew ? 'beginner' : c.experienceLevel;
  const effectiveRisk = isBrandNew ? 'conservative' : c.riskComfort;

  if (cash !== null) lines.push(`- Cash available to deploy: ${formatCurrency(cash)}`);
  if (typeof c.maxPositionSizePct === 'number' && c.maxPositionSizePct > 0) {
    const ceiling = cash !== null ? ` (= ${formatCurrency(cash * (c.maxPositionSizePct / 100))} max per position)` : '';
    lines.push(`- Max position size: ${c.maxPositionSizePct}% of cash${ceiling}`);
  }
  if (typeof c.defaultTradeAmount === 'number' && c.defaultTradeAmount > 0) lines.push(`- Typical trade size: ${formatCurrency(c.defaultTradeAmount)}`);
  if (typeof c.monthlyContribution === 'number' && c.monthlyContribution > 0) lines.push(`- Monthly top-up: ${formatCurrency(c.monthlyContribution)}`);
  if (effectiveRisk) lines.push(`- Risk comfort: ${effectiveRisk}`);
  if (c.primaryGoal) lines.push(`- Primary goal: ${c.primaryGoal.replace(/_/g, ' ')}`);
  if (c.primaryOutcome) lines.push(`- Desired outcome: ${c.primaryOutcome}`);
  if (c.investingStyle) lines.push(`- Investing style: ${c.investingStyle.replace(/_/g, ' ')}`);
  if (c.preferredTimeframe) lines.push(`- Preferred timeframe: ${c.preferredTimeframe}`);
  if (effectiveExperience) lines.push(`- Experience: ${effectiveExperience}`);
  if (isBrandNew) {
    lines.push('- Brand-new investor (never placed a trade) - explain in plain English, keep ideas conservative, and avoid jargon.');
  }
  if (c.simulationEnabled) lines.push('- Paper/simulation mode is ON - no real money is at stake.');

  if (!lines.length) return '';
  return `YOUR PROFILE & CONSTRAINTS (size every idea against these - never suggest more than the max position size, frame suggestions against the available cash, and relate them to the goal):\n${lines.join('\n')}`;
}
