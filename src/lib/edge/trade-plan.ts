/**
 * The trade plan - a deterministic, cost-aware, expectancy-aware sizing sketch at the moment
 * of decision, built for a SMALL account.
 *
 * Every ingredient already existed in Lyra but sat disconnected: position sizing lived on a
 * standalone calculator page, the cost model lived in the paper engine, and win rates were
 * shown without expectancy. This composes them against the user's REAL capital: it floors to
 * whole shares, tells a small account when an entry price is simply out of reach, nets the
 * expected value against realistic round-trip friction, and raises neutral flags where a
 * beginner would otherwise get hurt (oversizing, over-concentration, cost eating the edge,
 * negative expectancy, illiquid names, lottery-tier stages).
 *
 * Pure and deterministic. Research only: it describes sizing and cost math, and it never emits
 * a buy/sell instruction. A long entry is assumed (stop below entry); the plan degrades
 * gracefully when a stop, target, or outcome base rate is missing.
 */
import { computeExpectancy, type Expectancy, type ExpectancyInput } from './expectancy';
import { computeTradeCost, DEFAULT_COST_MODEL, type CostModel, type TradeCost } from './costs';

export type TradePlanFlag =
  | 'stop-missing'
  | 'capital-too-small'
  | 'exceeds-account'
  | 'over-concentration'
  | 'portfolio-heat-high'
  | 'theme-concentration'
  | 'cost-drag-high'
  | 'cost-exceeds-edge'
  | 'negative-expectancy'
  | 'illiquid-for-size'
  | 'wide-stop'
  | 'lottery-tier';

export interface TradePlanInput {
  symbol: string;
  entryPrice: number;
  stopPrice?: number;
  targetPrice?: number;
  /** Real available capital in the account base currency. */
  accountSize: number;
  /** Risk budget per trade as % of the account (e.g. 1). */
  riskPercentPerTrade: number;
  /** Concentration cap as % of the account a single position may occupy (default 20). */
  maxPositionPct?: number;
  /** Floor sizing to whole shares (default true - most basic accounts cannot buy fractions). */
  wholeSharesOnly?: boolean;
  /** True when the ticker trades in a currency other than the account base. */
  crossCurrency?: boolean;
  /** 0-100 liquidity/depth score for the name. */
  liquidity?: number;
  /** Lifecycle stage - a 'concept' stage is flagged lottery-tier. */
  lifecycleStage?: string;
  /** Measured or illustrative base rates for expectancy. Null when there is no history. */
  outcome?: ExpectancyInput | null;
  /** Where the outcome base rate came from - drives the honesty label. */
  provenance?: 'measured' | 'illustrative';
  costModel?: CostModel;
  /** Value already deployed in OTHER open positions (excludes this name). Enables portfolio-heat. */
  openPositionsValue?: number;
  /** Value already deployed in the SAME theme/cohort as this name. Enables theme-concentration. */
  sameThemeValue?: number;
  /** Human label for the theme/cohort, used in the concentration note. */
  themeLabel?: string;
}

export interface TradePlan {
  symbol: string;
  entryPrice: number;
  stopPrice: number | null;
  targetPrice: number | null;
  riskPercentPerTrade: number;
  riskDollars: number;
  /** Stop distance as % below entry (null when no stop). */
  stopDistancePct: number | null;
  /** Ideal (fractional) share count before whole-share flooring. */
  rawShares: number;
  /** Actual shares the plan can take (whole when wholeSharesOnly). */
  shares: number;
  positionValue: number;
  positionPctOfAccount: number;
  /** Total account deployed after this position (open positions + this one) as % of account. Null when unknown. */
  portfolioHeatPct: number | null;
  /** Same-theme exposure after this position as % of account. Null when unknown. */
  themeExposurePct: number | null;
  /** Worst-case loss if the stop is hit, including entry-side friction. Null when no stop. */
  worstCaseLossDollars: number | null;
  /** Reward-to-risk to the target (null when no target/stop). */
  rMultipleToTarget: number | null;
  /** Win rate the R:R would need to break even (null when no target/stop). */
  breakEvenWinRatePct: number | null;
  cost: TradeCost;
  expectancy: Expectancy | null;
  /** Expected value per trade net of round-trip friction (null when no outcome). */
  expectancyNetPct: number | null;
  provenance: 'measured' | 'illustrative' | 'none';
  flags: TradePlanFlag[];
  notes: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampPos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

const COST_DRAG_HIGH_PCT = 2; // round-trip friction above this is a serious drag on a small account
const WIDE_STOP_PCT = 25; // a stop this far below entry risks a large loss per share
const ILLIQUID_BELOW = 40; // liquidity score under this is thin for a retail fill
const MAX_PORTFOLIO_HEAT_PCT = 80; // total account deployed above this leaves little dry powder / diversification
const MAX_THEME_EXPOSURE_PCT = 40; // same-theme exposure above this is a correlated concentration risk

/**
 * Build a full trade plan. Sizing is risk-first (risk$ / stop distance), then capped by the
 * concentration limit and by available cash, then floored to whole shares.
 */
export function buildTradePlan(input: TradePlanInput): TradePlan {
  const flags: TradePlanFlag[] = [];
  const notes: string[] = [];

  const entryPrice = clampPos(input.entryPrice);
  const accountSize = clampPos(input.accountSize);
  const riskPercent = Math.max(0, input.riskPercentPerTrade || 0);
  const maxPositionPct = input.maxPositionPct && input.maxPositionPct > 0 ? input.maxPositionPct : 20;
  const wholeSharesOnly = input.wholeSharesOnly !== false;

  const riskDollars = round2((accountSize * riskPercent) / 100);
  const stopPrice = input.stopPrice && input.stopPrice > 0 && input.stopPrice < entryPrice ? input.stopPrice : null;
  const stopDistancePerShare = stopPrice ? entryPrice - stopPrice : 0;
  const stopDistancePct = stopPrice ? round2((stopDistancePerShare / entryPrice) * 100) : null;

  if (!stopPrice) {
    flags.push('stop-missing');
    notes.push('No stop below entry was provided, so risk-based sizing cannot be computed. Sizing falls back to the concentration cap.');
  }
  if (stopDistancePct !== null && stopDistancePct > WIDE_STOP_PCT) {
    flags.push('wide-stop');
    notes.push(`The stop is ${stopDistancePct}% below entry - a wide stop means each share risks a large move.`);
  }

  // Sizing: risk-first when a stop exists, otherwise the concentration cap governs.
  const sharesByRisk = stopDistancePerShare > 0 ? riskDollars / stopDistancePerShare : Infinity;
  const sharesByConcentration = entryPrice > 0 ? (accountSize * maxPositionPct) / 100 / entryPrice : 0;
  const sharesByCash = entryPrice > 0 ? accountSize / entryPrice : 0;
  const rawShares = Math.max(0, Math.min(sharesByRisk, sharesByConcentration, sharesByCash));
  const shares = wholeSharesOnly ? Math.floor(rawShares) : round2(rawShares);

  if (shares <= 0) {
    flags.push('capital-too-small');
    notes.push(
      `At a ${entryPrice} entry, ${maxPositionPct}% of a ${accountSize} account is under one whole share - this name is priced out of reach for this capital at this risk budget.`,
    );
  }
  if (sharesByRisk < sharesByConcentration && Number.isFinite(sharesByRisk) && shares > 0 && Math.floor(sharesByConcentration) > shares) {
    notes.push('Risk-based sizing (not the concentration cap) is the binding limit here - the stop distance sets the size.');
  }
  if (Number.isFinite(sharesByRisk) && sharesByRisk > sharesByConcentration && shares > 0) {
    flags.push('over-concentration');
    notes.push(`The risk budget would buy more than the ${maxPositionPct}% single-position cap allows; size is capped to protect against concentration.`);
  }

  const positionValue = round2(shares * entryPrice);
  const positionPctOfAccount = accountSize > 0 ? round2((positionValue / accountSize) * 100) : 0;
  if (positionValue > accountSize && accountSize > 0) {
    flags.push('exceeds-account');
    notes.push('The position value exceeds the account balance - this would require leverage the plan does not assume.');
  }

  // Portfolio-level guards: a plan that is safe in isolation can still over-concentrate the book.
  // Total heat = capital already in other open positions + this one; theme heat = same-cohort exposure.
  const openPositionsValue = clampPos(input.openPositionsValue ?? 0);
  const portfolioHeatPct =
    accountSize > 0 && input.openPositionsValue !== undefined
      ? round2(((openPositionsValue + positionValue) / accountSize) * 100)
      : null;
  if (portfolioHeatPct !== null && portfolioHeatPct > MAX_PORTFOLIO_HEAT_PCT && positionValue > 0) {
    flags.push('portfolio-heat-high');
    notes.push(
      `Adding this position takes total deployed capital to ${portfolioHeatPct}% of the account (over ${MAX_PORTFOLIO_HEAT_PCT}%) - little dry powder is left and the book is under-diversified.`,
    );
  }

  const sameThemeValue = clampPos(input.sameThemeValue ?? 0);
  const themeExposurePct =
    accountSize > 0 && input.sameThemeValue !== undefined
      ? round2(((sameThemeValue + positionValue) / accountSize) * 100)
      : null;
  if (themeExposurePct !== null && themeExposurePct > MAX_THEME_EXPOSURE_PCT && positionValue > 0) {
    flags.push('theme-concentration');
    const theme = input.themeLabel ? `the ${input.themeLabel} theme` : 'this theme';
    notes.push(
      `Same-theme exposure would reach ${themeExposurePct}% of the account (over ${MAX_THEME_EXPOSURE_PCT}%). Correlated names in ${theme} tend to fall together, so this concentrates risk rather than spreading it.`,
    );
  }

  const cost = computeTradeCost({
    notional: positionValue,
    crossCurrency: input.crossCurrency,
    liquidity: input.liquidity,
    model: input.costModel ?? DEFAULT_COST_MODEL,
  });
  const entrySideCost = round2(cost.roundTripCost / 2);
  const worstCaseLossDollars = stopPrice ? round2(shares * stopDistancePerShare + entrySideCost) : null;

  if (cost.breakEvenMovePct > COST_DRAG_HIGH_PCT && positionValue > 0) {
    flags.push('cost-drag-high');
    notes.push(`Round-trip friction is ${cost.breakEvenMovePct}% of the position - the price must rise that much just to break even before any profit.`);
  }
  if ((input.liquidity ?? 60) < ILLIQUID_BELOW) {
    flags.push('illiquid-for-size');
    notes.push('This name scores thin on liquidity - real fills can be worse than modelled and a stop can gap through.');
  }
  if (input.lifecycleStage === 'concept') {
    flags.push('lottery-tier');
    notes.push('This is a concept-stage name - highest upside but highest chance of going to zero. Treat as a lottery-tier position, not a core holding.');
  }

  // Reward-to-risk to the target.
  let rMultipleToTarget: number | null = null;
  let breakEvenWinRatePct: number | null = null;
  if (stopPrice && input.targetPrice && input.targetPrice > entryPrice) {
    const reward = input.targetPrice - entryPrice;
    rMultipleToTarget = round2(reward / stopDistancePerShare);
    breakEvenWinRatePct = round2((stopDistancePerShare / (reward + stopDistancePerShare)) * 100);
  }

  // Expectancy, net of friction.
  let expectancy: Expectancy | null = null;
  let expectancyNetPct: number | null = null;
  const provenance: TradePlan['provenance'] = input.outcome ? input.provenance ?? 'illustrative' : 'none';
  if (input.outcome) {
    expectancy = computeExpectancy(input.outcome);
    expectancyNetPct = round2(expectancy.expectedValuePct - cost.breakEvenMovePct);
    if (expectancy.edge === 'negative') {
      flags.push('negative-expectancy');
      notes.push('On these base rates the setup has negative expectancy before costs - the average outcome loses money.');
    } else if (expectancy.edge === 'positive' && expectancyNetPct <= 0) {
      flags.push('cost-exceeds-edge');
      notes.push('The gross edge is positive but round-trip friction wipes it out - after costs there is nothing left for this account size.');
    }
    if (provenance === 'illustrative') {
      notes.push('The expectancy uses ILLUSTRATIVE base rates (no measured live history yet), not proven results - treat it as a placeholder, not evidence.');
    }
  }

  return {
    symbol: input.symbol,
    entryPrice: round2(entryPrice),
    stopPrice,
    targetPrice: input.targetPrice ?? null,
    riskPercentPerTrade: riskPercent,
    riskDollars,
    stopDistancePct,
    rawShares: round2(rawShares),
    shares,
    positionValue,
    positionPctOfAccount,
    portfolioHeatPct,
    themeExposurePct,
    worstCaseLossDollars,
    rMultipleToTarget,
    breakEvenWinRatePct,
    cost,
    expectancy,
    expectancyNetPct,
    provenance,
    flags,
    notes,
  };
}

/**
 * A plain-English, research-only rendering of a plan - used for the AI tool citation and the
 * copy-paste trade ticket. No advice verbs; every line is a computed fact.
 */
export function renderTradePlanText(plan: TradePlan): string {
  const lines: string[] = [];
  lines.push(`Trade plan sketch for ${plan.symbol} (research only, not advice):`);
  lines.push(`- Entry ${plan.entryPrice}${plan.stopPrice ? `, stop ${plan.stopPrice}` : ', no stop set'}${plan.targetPrice ? `, target ${plan.targetPrice}` : ''}.`);
  if (plan.shares > 0) {
    lines.push(`- Size: ${plan.shares} share(s) = ${plan.positionValue} (${plan.positionPctOfAccount}% of the account) at ${plan.riskPercentPerTrade}% risk.`);
  } else {
    lines.push('- Size: below one whole share for this account and risk budget - this entry price is out of reach.');
  }
  if (plan.worstCaseLossDollars !== null) {
    lines.push(`- Worst case if the stop is hit: about ${plan.worstCaseLossDollars} (risk budget ${plan.riskDollars}).`);
  }
  if (plan.rMultipleToTarget !== null) {
    lines.push(`- Reward-to-risk to target: ${plan.rMultipleToTarget} to 1 (needs a ${plan.breakEvenWinRatePct}% win rate to break even).`);
  }
  lines.push(`- Round-trip friction: ${plan.cost.roundTripCost} (${plan.cost.breakEvenMovePct}% of the position must be recovered before any profit).`);
  if (plan.expectancy) {
    lines.push(`- Expectancy (${plan.provenance}): ${plan.expectancy.expectedValuePct}% per trade gross, ${plan.expectancyNetPct}% net of friction.`);
  }
  if (plan.flags.length > 0) {
    lines.push(`- Flags: ${plan.flags.join(', ')}.`);
  }
  return lines.join('\n');
}
