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
  baseCurrency?: string | null;
  monthlyContribution?: number | null;
  /** The user's own money goal - the account value they are working toward. Null = milestone ladder. */
  goalTargetAmount?: number | null;
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

// Columns present since the onboarding baseline (migrations 003 + 022). Every one is guaranteed on
// any project that has run the base schema, so this select can never 400 on a missing column.
const CORE_PROFILE_COLUMNS =
  'experience_level, investing_style, preferred_timeframe, risk_comfort, primary_goal, cash_available, monthly_contribution, max_position_size_pct, default_trade_amount, primary_outcome, simulation_enabled, strategy_id, traded_before, beginner_motivation, beginner_knowledge, beginner_involvement, beginner_learning_style, beginner_horizon';

// Columns added by a LATER migration that a given project may not have applied yet (037). These are
// read best-effort and MUST stay out of the core select: if the whole profile read were keyed on one
// unmigrated column it would 400 and null out ALL personalisation across every AI surface. Keeping
// them separate means a missing column degrades that one field, never the entire profile.
// The check:onboarding-contract gate enforces that this split stays honest.
const OPTIONAL_PROFILE_COLUMNS = ['goal_target_amount'] as const;

export async function getUserConstraints(): Promise<UserConstraints | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;

    const { data, error } = await supabase
      .from('operator_profiles')
      .select(CORE_PROFILE_COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as Record<string, unknown>;

    // Best-effort optional columns (e.g. goal_target_amount from migration 037). A project that has
    // not applied the migration simply returns no value here - the rest of the profile is unaffected.
    let goalTargetAmount: number | null = null;
    const { data: optional } = await supabase
      .from('operator_profiles')
      .select(OPTIONAL_PROFILE_COLUMNS.join(', '))
      .eq('user_id', user.id)
      .maybeSingle();
    if (optional) {
      // The optional select is built from a runtime string, so supabase-js cannot infer its row
      // shape - go through unknown to read the column defensively.
      const opt = optional as unknown as Record<string, unknown>;
      const raw = opt.goal_target_amount;
      goalTargetAmount = typeof raw === 'number' ? raw : null;
    }

    // Base currency is owned by profiles (written by the account API), not operator_profiles.
    const { data: profile } = await supabase.from('profiles').select('base_currency').eq('id', user.id).maybeSingle();

    return {
      experienceLevel: (row.experience_level as string) ?? undefined,
      investingStyle: (row.investing_style as string) ?? undefined,
      preferredTimeframe: (row.preferred_timeframe as string) ?? undefined,
      riskComfort: (row.risk_comfort as string) ?? undefined,
      primaryGoal: (row.primary_goal as string) ?? undefined,
      cashAvailable: (row.cash_available as number) ?? null,
      baseCurrency: (profile?.base_currency as string) ?? 'USD',
      monthlyContribution: (row.monthly_contribution as number) ?? null,
      goalTargetAmount,
      maxPositionSizePct: (row.max_position_size_pct as number) ?? null,
      defaultTradeAmount: (row.default_trade_amount as number) ?? null,
      primaryOutcome: (row.primary_outcome as string) ?? null,
      simulationEnabled: (row.simulation_enabled as boolean) ?? null,
      strategyId: (row.strategy_id as string) ?? null,
      tradedBefore: (row.traded_before as string) ?? null,
      beginnerMotivation: (row.beginner_motivation as string) ?? null,
      beginnerKnowledge: (row.beginner_knowledge as string) ?? null,
      beginnerInvolvement: (row.beginner_involvement as string) ?? null,
      beginnerLearningStyle: (row.beginner_learning_style as string) ?? null,
      beginnerHorizon: (row.beginner_horizon as string) ?? null,
    };
  } catch {
    return null;
  }
}

// Plain-English labels for the beginner-branch answers so the model reads intent, not enum codes.
// These are captured in onboarding's beginner branch (tradedBefore === 'no') and MUST reach the
// prompt - otherwise a brand-new user's individual answers are collected then dropped.
const BEGINNER_MOTIVATION_LABEL: Record<string, string> = {
  grow_savings: 'grow their savings',
  extra_income: 'earn extra income',
  learn_investing: 'learn how investing works',
  follow_tech: 'follow the technology they believe in',
  long_term_wealth: 'build long-term wealth',
};
const BEGINNER_KNOWLEDGE_LABEL: Record<string, string> = {
  scratch: 'starting from scratch',
  some_basics: 'knows some basics',
  read_charts: 'can read a chart',
};
const BEGINNER_INVOLVEMENT_LABEL: Record<string, string> = {
  guide_me: 'wants to be guided step by step',
  now_and_then: 'checks in now and then',
  weekly: 'engages weekly',
  daily: 'engages daily',
};
const BEGINNER_LEARNING_LABEL: Record<string, string> = {
  plain_english: 'plain English, no jargon',
  real_examples: 'real worked examples',
  step_by_step: 'step-by-step walkthroughs',
  just_signal: 'just the signal, minimal explanation',
};
const BEGINNER_HORIZON_LABEL: Record<string, string> = {
  few_months: 'a few months',
  year_or_two: 'a year or two',
  many_years: 'many years',
  unsure: 'not sure yet',
};

// The learning style the user asked for, as a concrete instruction to the model. This is what makes
// two beginners with different answers get materially different replies rather than one house style.
const LEARNING_STYLE_INSTRUCTION: Record<string, string> = {
  plain_english: 'Explain in plain English and define any term the first time you use it.',
  real_examples: 'Teach with a concrete worked example (real numbers from their data) before any general point.',
  step_by_step: 'Break guidance into short numbered steps they can follow one at a time.',
  just_signal: 'Keep it brief - lead with the signal or answer and skip the teaching unless they ask.',
};

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
  // The user's own stated money goal - so the copilot can frame ideas as steps toward THEIR number,
  // not a generic milestone ladder.
  if (typeof c.goalTargetAmount === 'number' && c.goalTargetAmount > 0) {
    const gap = cash !== null && c.goalTargetAmount > cash ? ` (${formatCurrency(c.goalTargetAmount - cash)} to go from cash on hand)` : '';
    lines.push(`- Money goal: ${formatCurrency(c.goalTargetAmount)} account value${gap} - relate progress to this target`);
  }
  if (effectiveRisk) lines.push(`- Risk comfort: ${effectiveRisk}`);
  if (c.primaryGoal) lines.push(`- Primary goal: ${c.primaryGoal.replace(/_/g, ' ')}`);
  if (c.primaryOutcome) lines.push(`- Desired outcome: ${c.primaryOutcome}`);
  if (c.investingStyle) lines.push(`- Investing style: ${c.investingStyle.replace(/_/g, ' ')}`);
  if (c.preferredTimeframe) lines.push(`- Preferred timeframe: ${c.preferredTimeframe}`);
  if (effectiveExperience) lines.push(`- Experience: ${effectiveExperience}`);

  // Beginner-branch individualisation. Only populated when tradedBefore === 'no'; each answer earns
  // its own line so the model tailors depth, tone and framing to what THIS beginner told us.
  if (isBrandNew) {
    lines.push('- Brand-new investor (never placed a trade) - explain in plain English, keep ideas conservative, and avoid jargon.');
    if (c.beginnerMotivation && BEGINNER_MOTIVATION_LABEL[c.beginnerMotivation]) {
      lines.push(`- Here to: ${BEGINNER_MOTIVATION_LABEL[c.beginnerMotivation]}`);
    }
    if (c.beginnerKnowledge && BEGINNER_KNOWLEDGE_LABEL[c.beginnerKnowledge]) {
      lines.push(`- Starting point: ${BEGINNER_KNOWLEDGE_LABEL[c.beginnerKnowledge]}`);
    }
    if (c.beginnerInvolvement && BEGINNER_INVOLVEMENT_LABEL[c.beginnerInvolvement]) {
      lines.push(`- Involvement: ${BEGINNER_INVOLVEMENT_LABEL[c.beginnerInvolvement]}`);
    }
    if (c.beginnerHorizon && BEGINNER_HORIZON_LABEL[c.beginnerHorizon]) {
      lines.push(`- Time horizon: ${BEGINNER_HORIZON_LABEL[c.beginnerHorizon]}`);
    }
    if (c.beginnerLearningStyle && LEARNING_STYLE_INSTRUCTION[c.beginnerLearningStyle]) {
      lines.push(`- How they learn best: ${BEGINNER_LEARNING_LABEL[c.beginnerLearningStyle]}. ${LEARNING_STYLE_INSTRUCTION[c.beginnerLearningStyle]}`);
    }
  }
  if (c.simulationEnabled) lines.push('- Paper/simulation mode is ON - no real money is at stake.');

  if (!lines.length) return '';
  return `YOUR PROFILE & CONSTRAINTS (size every idea against these - never suggest more than the max position size, frame suggestions against the available cash, and relate them to the goal):\n${lines.join('\n')}`;
}
