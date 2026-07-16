/**
 * Pure deterministic capital-planning math for trade simulation.
 * NO AI, NO randomness, NO network - only position sizing, risk/reward, scenario outcomes, and compounding.
 */

import type { PortfolioHolding } from '@/types/scanner';

// =============================================================================
// TYPES
// =============================================================================

export interface TradeInputs {
  availableCash: number;
  ticker: string;
  tradeAmount: number; // Amount of capital to risk/allocate to this trade
  entryPrice: number;
  stopPercent: number; // Stop loss as % below entry (e.g., 6 for 6%)
  targetPercent: number; // Take profit as % above entry (e.g., 14 for 14%)
  holdingPeriodDays: number; // For context/notes
}

export interface PositionSizing {
  shares: number; // Shares to purchase = tradeAmount / entryPrice
  riskDollar: number; // Loss if stopped out = shares * (entryPrice - stopPrice)
  riskPercent: number; // Risk as % of available cash
  stopPrice: number;
  targetPrice: number;
}

export interface RiskRewardAnalysis {
  riskDollar: number;
  riskPercent: number; // Risk as % of available capital
  rewardDollar: number; // Profit if target hit = shares * (targetPrice - entryPrice)
  riskRewardRatio: number; // rewardDollar / riskDollar
  positionWeightPercent: number; // tradeAmount as % of total capital after trade
}

export interface ScenarioOutcome {
  label: string; // "Bull (+X%)", "Base (entry)", "Bear (-Y%)"
  priceMove: number; // Percentage move from entry
  resultPrice: number;
  pnlDollar: number;
  pnlPercent: number; // (resultPrice - entryPrice) / entryPrice * 100
  status: 'won' | 'lost' | 'breakeven'; // Based on stop/target
}

export interface ExposureImpact {
  newPositionWeight: number; // Trade amount as % of new total capital
  sectorExposureChange?: {
    sector: string;
    currentWeight: number;
    afterTradeWeight: number;
  };
  totalExposureAfterTrade: number; // Sum of all positions as % of capital
}

export interface CompoundingProjection {
  month: number;
  startBalance: number;
  monthlyReturn: number; // Target monthly % return
  endBalance: number;
  totalReturn: number; // (endBalance - startBalance) / startBalance * 100
}

export interface WinRateCalculation {
  avgWinDollar: number;
  avgLossDollar: number;
  expectedValuePerTrade: number; // avgWin * winRate - avgLoss * (1 - winRate)
  requiredWinRate: number; // Breakeven win rate for given avg win/loss
  requiredWinRatePercent: number; // As percentage 0-100
}

// =============================================================================
// POSITION SIZING
// =============================================================================

/**
 * Calculate shares, stop price, and risk exposure.
 *
 * Formulas:
 * - shares = tradeAmount / entryPrice (capital divided by entry price)
 * - stopPrice = entryPrice * (1 - stopPercent/100)
 * - riskDollar = shares * (entryPrice - stopPrice)
 * - riskPercent = riskDollar / availableCash * 100
 */
export function calculatePositionSizing(inputs: TradeInputs): PositionSizing {
  const shares = inputs.tradeAmount / inputs.entryPrice;
  const stopPrice = inputs.entryPrice * (1 - inputs.stopPercent / 100);
  const targetPrice = inputs.entryPrice * (1 + inputs.targetPercent / 100);
  const riskDollar = shares * (inputs.entryPrice - stopPrice);
  const riskPercent = (riskDollar / inputs.availableCash) * 100;

  return {
    shares,
    riskDollar,
    riskPercent,
    stopPrice,
    targetPrice,
  };
}

// =============================================================================
// RISK / REWARD ANALYSIS
// =============================================================================

/**
 * Calculate risk/reward ratio and potential P/L.
 *
 * Formulas:
 * - rewardDollar = shares * (targetPrice - entryPrice)
 * - riskRewardRatio = rewardDollar / riskDollar
 * - positionWeightPercent = tradeAmount / (availableCash + tradeAmount) * 100
 */
export function calculateRiskReward(inputs: TradeInputs, sizing: PositionSizing): RiskRewardAnalysis {
  const rewardDollar = sizing.shares * (sizing.targetPrice - inputs.entryPrice);
  const riskRewardRatio = sizing.riskDollar > 0 ? rewardDollar / sizing.riskDollar : 0;
  const newTotalCapital = inputs.availableCash + inputs.tradeAmount;
  const positionWeightPercent = (inputs.tradeAmount / newTotalCapital) * 100;
  const riskPercent = (sizing.riskDollar / inputs.availableCash) * 100;

  return {
    riskDollar: sizing.riskDollar,
    riskPercent,
    rewardDollar,
    riskRewardRatio,
    positionWeightPercent,
  };
}

// =============================================================================
// SCENARIO OUTCOMES
// =============================================================================

/**
 * Generate bull/base/bear scenarios showing P/L at each price level.
 *
 * Formulas:
 * - resultPrice = entryPrice * (1 + priceMove/100)
 * - pnlDollar = (resultPrice - entryPrice) * shares
 * - pnlPercent = (resultPrice - entryPrice) / entryPrice * 100
 * - Status: 'won' if above targetPrice, 'lost' if below stopPrice, else 'breakeven'
 */
export function calculateScenarioOutcomes(
  inputs: TradeInputs,
  sizing: PositionSizing,
  bullMove = 20,
  bearMove = -15
): ScenarioOutcome[] {
  const scenarios: ScenarioOutcome[] = [];

  const priceMovesPercent = [bullMove, 0, bearMove];
  const labels = [`Bull +${bullMove}%`, 'Base (entry)', `Bear ${bearMove}%`];

  for (let i = 0; i < priceMovesPercent.length; i++) {
    const move = priceMovesPercent[i];
    const resultPrice = inputs.entryPrice * (1 + move / 100);
    const pnlDollar = (resultPrice - inputs.entryPrice) * sizing.shares;
    const pnlPercent = (move); // Same as move since P/L % from entry

    let status: 'won' | 'lost' | 'breakeven' = 'breakeven';
    if (resultPrice >= sizing.targetPrice) {
      status = 'won';
    } else if (resultPrice <= sizing.stopPrice) {
      status = 'lost';
    }

    scenarios.push({
      label: labels[i],
      priceMove: move,
      resultPrice,
      pnlDollar,
      pnlPercent,
      status,
    });
  }

  return scenarios;
}

// =============================================================================
// EXPOSURE IMPACT (with portfolio context)
// =============================================================================

/**
 * Calculate portfolio weight after trade and sector exposure shift.
 *
 * Formulas:
 * - newPositionWeight = tradeAmount / (availableCash + tradeAmount) * 100
 * - totalExposureAfterTrade = sum of (marketValue for all holdings + new position) / total capital
 * - sectorExposureChange: if current holdings exist for the same sector, show before/after weight
 */
export function calculateExposureImpact(
  inputs: TradeInputs,
  portfolio: PortfolioHolding[] | null
): ExposureImpact {
  const newTotalCapital = inputs.availableCash + inputs.tradeAmount;
  const newPositionWeight = (inputs.tradeAmount / newTotalCapital) * 100;

  let sectorExposureChange: ExposureImpact['sectorExposureChange'] | undefined;
  let totalExposureAfterTrade = newPositionWeight;

  if (portfolio && portfolio.length > 0) {
    const totalPortfolioValue = portfolio.reduce((sum, h) => sum + h.marketValue, 0);
    totalExposureAfterTrade = ((totalPortfolioValue + inputs.tradeAmount) / newTotalCapital) * 100;

    // Optional: Track sector exposure if we had sector data
    // For now, just note the new position weight
  }

  return {
    newPositionWeight,
    sectorExposureChange,
    totalExposureAfterTrade,
  };
}

// =============================================================================
// COMPOUNDING PROJECTION
// =============================================================================

/**
 * Project account balance over N months with fixed monthly return target.
 *
 * Formulas:
 * - Month 0: balance = startingCapital
 * - Each month: endBalance = startBalance * (1 + monthlyReturnPercent/100)
 * - Next month startBalance = previous endBalance
 */
export function calculateCompoundingProjection(
  startingCapital: number,
  monthlyReturnPercent: number,
  numberOfMonths: number
): CompoundingProjection[] {
  const projection: CompoundingProjection[] = [];

  let currentBalance = startingCapital;

  for (let month = 0; month <= numberOfMonths; month++) {
    const startBalance = currentBalance;
    const monthlyReturnDollar = startBalance * (monthlyReturnPercent / 100);
    const endBalance = startBalance + monthlyReturnDollar;
    const totalReturn = ((endBalance - startingCapital) / startingCapital) * 100;

    projection.push({
      month,
      startBalance,
      monthlyReturn: monthlyReturnPercent,
      endBalance,
      totalReturn,
    });

    currentBalance = endBalance;
  }

  return projection;
}

// =============================================================================
// WIN RATE & EXPECTANCY
// =============================================================================

/**
 * Calculate required win rate given average win and average loss.
 *
 * Formula (breakeven win rate):
 * - avgWin * winRate = avgLoss * (1 - winRate)
 * - avgWin * winRate = avgLoss - avgLoss * winRate
 * - avgWin * winRate + avgLoss * winRate = avgLoss
 * - winRate * (avgWin + avgLoss) = avgLoss
 * - requiredWinRate = avgLoss / (avgWin + avgLoss)
 *
 * Expected value:
 * - expectedValuePerTrade = (avgWin * winRate) - (avgLoss * (1 - winRate))
 */
export function calculateWinRate(
  avgWinDollar: number,
  avgLossDollar: number,
  _targetExpectancy?: number
): WinRateCalculation {
  const totalDollarSwing = avgWinDollar + avgLossDollar;
  const requiredWinRate = totalDollarSwing > 0 ? avgLossDollar / totalDollarSwing : 0.5;
  const requiredWinRatePercent = requiredWinRate * 100;

  // Calculate expected value at required breakeven win rate
  const expectedValuePerTrade =
    avgWinDollar * requiredWinRate - avgLossDollar * (1 - requiredWinRate);

  return {
    avgWinDollar,
    avgLossDollar,
    expectedValuePerTrade,
    requiredWinRate,
    requiredWinRatePercent,
  };
}

// =============================================================================
// CONVENIENCE BATCH CALCULATOR
// =============================================================================

/**
 * All-in-one: Given trade inputs and portfolio, return complete analysis.
 */
export function fullSimulationAnalysis(inputs: TradeInputs, portfolio: PortfolioHolding[] | null) {
  const sizing = calculatePositionSizing(inputs);
  const riskReward = calculateRiskReward(inputs, sizing);
  const scenarios = calculateScenarioOutcomes(inputs, sizing);
  const exposure = calculateExposureImpact(inputs, portfolio);

  return {
    inputs,
    sizing,
    riskReward,
    scenarios,
    exposure,
  };
}
