// Deterministic financial calculator functions - research software only, not investment advice

/**
 * Compound Interest Result
 * For projecting growth of an initial investment with regular contributions and compounding
 */
export interface CompoundInterestResult {
  finalBalance: number;
  totalContributed: number;
  totalInterest: number;
  periodBalances: Array<{ period: number; balance: number; interest: number }>;
}

/**
 * Calculate compound interest with regular contributions
 * Formula: FV = PV(1 + r/n)^(nt) + PMT * [((1 + r/n)^(nt) - 1) / (r/n)]
 * @param principal Initial amount in dollars
 * @param monthlyContribution Monthly contribution in dollars
 * @param annualRatePercent Annual interest rate as percentage (e.g., 5 for 5%)
 * @param years Investment time horizon
 * @param compoundingPeriodsPerYear Compounding frequency (12 = monthly, 4 = quarterly, 1 = annual)
 */
export function calculateCompoundInterest(
  principal: number,
  monthlyContribution: number,
  annualRatePercent: number,
  years: number,
  compoundingPeriodsPerYear: number = 12
): CompoundInterestResult {
  const rateDecimal = annualRatePercent / 100;
  const periodRate = rateDecimal / compoundingPeriodsPerYear;
  const totalPeriods = compoundingPeriodsPerYear * years;
  const contributionsPerYear = 12; // always monthly contributions
  const contributionPerPeriod = monthlyContribution * (compoundingPeriodsPerYear / contributionsPerYear);

  const periodBalances: CompoundInterestResult['periodBalances'] = [];
  let balance = principal;
  let totalContributed = principal;

  for (let period = 1; period <= totalPeriods; period++) {
    // Apply interest to current balance
    balance = balance * (1 + periodRate);
    // Add contribution
    balance += contributionPerPeriod;
    totalContributed += contributionPerPeriod;

    // Record every month for charting (convert period back to months)
    const monthIndex = period;
    if (monthIndex % (compoundingPeriodsPerYear / 12 || 1) === 0) {
      periodBalances.push({
        period: Math.floor(monthIndex / (compoundingPeriodsPerYear / 12)),
        balance: Math.round(balance * 100) / 100,
        interest: Math.round((balance - totalContributed) * 100) / 100,
      });
    }
  }

  const totalInterest = balance - totalContributed;

  return {
    finalBalance: Math.round(balance * 100) / 100,
    totalContributed: Math.round(totalContributed * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    periodBalances,
  };
}

/**
 * Dividend Calculator Result
 */
export interface DividendResult {
  year1Income: number;
  yieldOnCost: number;
  projectedIncome: Array<{ year: number; income: number; shareCount: number; portfolioValue: number }>;
  totalProjectedIncome: number;
  finalShareCount: number;
  finalPortfolioValue: number;
}

/**
 * Calculate dividend income and growth with optional DRIP
 * @param initialInvestment Initial investment in dollars
 * @param sharePrice Current share price
 * @param annualDividendYieldPercent Dividend yield as percentage (e.g., 3.5 for 3.5%)
 * @param years Projection period
 * @param enableDrip Enable automatic dividend reinvestment
 * @param annualDividendGrowthPercent Optional annual dividend growth rate (e.g., 5 for 5%)
 */
export function calculateDividends(
  initialInvestment: number,
  sharePrice: number,
  annualDividendYieldPercent: number,
  years: number,
  enableDrip: boolean = false,
  annualDividendGrowthPercent: number = 0
): DividendResult {
  const yieldDecimal = annualDividendYieldPercent / 100;
  const growthDecimal = annualDividendGrowthPercent / 100;

  let shareCount = initialInvestment / sharePrice;
  let currentYield = yieldDecimal;
  const projections: DividendResult['projectedIncome'] = [];
  let totalProjectedIncome = 0;

  for (let year = 1; year <= years; year++) {
    const annualDividendPerShare = sharePrice * currentYield;
    const annualIncome = shareCount * annualDividendPerShare;
    totalProjectedIncome += annualIncome;

    const portfolioValue = shareCount * sharePrice;

    projections.push({
      year,
      income: Math.round(annualIncome * 100) / 100,
      shareCount: Math.round(shareCount * 1000) / 1000,
      portfolioValue: Math.round(portfolioValue * 100) / 100,
    });

    // Apply DRIP: reinvest dividends into new shares
    if (enableDrip) {
      const newShares = annualIncome / sharePrice;
      shareCount += newShares;
    }

    // Grow the dividend yield
    currentYield = currentYield * (1 + growthDecimal);
  }

  const year1Income = projections[0]?.income || 0;
  const year1PortfolioValue = projections[0]?.portfolioValue || initialInvestment;
  const yieldOnCost = year1Income / initialInvestment;

  return {
    year1Income: Math.round(year1Income * 100) / 100,
    yieldOnCost: Math.round(yieldOnCost * 10000) / 100, // as percentage
    projectedIncome: projections,
    totalProjectedIncome: Math.round(totalProjectedIncome * 100) / 100,
    finalShareCount: Math.round(shareCount * 1000) / 1000,
    finalPortfolioValue: Math.round(shareCount * sharePrice * 100) / 100,
  };
}

/**
 * Position Sizing Result
 */
export interface PositionSizingResult {
  positionSizeDollars: number;
  positionSizeShares: number;
  riskDollars: number;
  rMultiple: number;
  maxShares: number;
}

/**
 * Calculate position size based on risk management
 * Formula: Position Size = (Risk $ / Distance to stop) * Entry Price
 * @param accountSize Total account size in dollars
 * @param riskPercentPerTrade Risk as percentage of account (e.g., 1 for 1%)
 * @param entryPrice Entry price per share
 * @param stopLossPrice Stop loss price per share
 */
export function calculatePositionSizing(
  accountSize: number,
  riskPercentPerTrade: number,
  entryPrice: number,
  stopLossPrice: number
): PositionSizingResult {
  const riskDollars = accountSize * (riskPercentPerTrade / 100);
  const distanceToStop = Math.abs(entryPrice - stopLossPrice);

  // Position size in shares = Risk $ / (Entry - Stop)
  const positionSizeShares = distanceToStop > 0 ? riskDollars / distanceToStop : 0;
  const positionSizeDollars = positionSizeShares * entryPrice;

  // R-multiple: how many risk units
  const rMultiple = distanceToStop > 0 ? riskDollars / distanceToStop : 0;

  return {
    positionSizeDollars: Math.round(positionSizeDollars * 100) / 100,
    positionSizeShares: Math.round(positionSizeShares * 10000) / 10000,
    riskDollars: Math.round(riskDollars * 100) / 100,
    rMultiple: Math.round(rMultiple * 100) / 100,
    maxShares: Math.floor(accountSize / entryPrice),
  };
}

/**
 * CAGR Result
 */
export interface CAGRResult {
  cagr: number; // as percentage
  annualGrowthRate: number;
}

/**
 * Calculate Compound Annual Growth Rate
 * Formula: CAGR = (End Value / Start Value)^(1/Years) - 1
 * @param startValue Beginning value
 * @param endValue Ending value
 * @param years Number of years
 */
export function calculateCAGR(startValue: number, endValue: number, years: number): CAGRResult {
  if (startValue <= 0 || years <= 0) {
    return { cagr: 0, annualGrowthRate: 0 };
  }

  const cagr = Math.pow(endValue / startValue, 1 / years) - 1;

  return {
    cagr: Math.round(cagr * 10000) / 100, // as percentage
    annualGrowthRate: cagr,
  };
}

/**
 * Rule of 72 Result
 */
export interface Rule72Result {
  doublingTimeYears: number;
}

/**
 * Calculate doubling time using Rule of 72
 * Formula: Doubling Time = 72 / Annual Rate (%)
 * @param annualRatePercent Annual growth rate as percentage (e.g., 5 for 5%)
 */
export function calculateRule72(annualRatePercent: number): Rule72Result {
  const doublingTime = annualRatePercent > 0 ? 72 / annualRatePercent : Infinity;

  return {
    doublingTimeYears: isFinite(doublingTime) ? Math.round(doublingTime * 100) / 100 : 0,
  };
}

/**
 * Dollar-Cost Averaging Result
 */
export interface DCAResult {
  totalUnits: number;
  totalInvested: number;
  averageCostPerUnit: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  purchases: Array<{ period: number; unitsPurchased: number; costPerUnit: number; totalCost: number }>;
}

/**
 * Calculate DCA outcome
 * @param periodicAmount Amount invested per period in dollars
 * @param numberOfPeriods Number of periods
 * @param prices Array of prices per period (length must equal numberOfPeriods)
 * @param currentPrice Current price per unit
 */
export function calculateDCA(
  periodicAmount: number,
  numberOfPeriods: number,
  prices: number[],
  currentPrice: number
): DCAResult {
  const purchases: DCAResult['purchases'] = [];
  let totalUnits = 0;
  let totalInvested = 0;

  for (let period = 0; period < numberOfPeriods; period++) {
    const priceAtPeriod = prices[period] || prices[prices.length - 1] || currentPrice;
    const unitsPurchased = periodicAmount / priceAtPeriod;
    totalUnits += unitsPurchased;
    totalInvested += periodicAmount;

    purchases.push({
      period: period + 1,
      unitsPurchased: Math.round(unitsPurchased * 10000) / 10000,
      costPerUnit: Math.round(priceAtPeriod * 100) / 100,
      totalCost: Math.round(periodicAmount * 100) / 100,
    });
  }

  const averageCostPerUnit = totalInvested / totalUnits;
  const currentValue = totalUnits * currentPrice;
  const gainLoss = currentValue - totalInvested;
  const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

  return {
    totalUnits: Math.round(totalUnits * 10000) / 10000,
    totalInvested: Math.round(totalInvested * 100) / 100,
    averageCostPerUnit: Math.round(averageCostPerUnit * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    gainLoss: Math.round(gainLoss * 100) / 100,
    gainLossPercent: Math.round(gainLossPercent * 100) / 100,
    purchases,
  };
}

/**
 * Profit Target / Risk-Reward Result
 */
export interface ProfitTargetResult {
  targetPrice: number;
  breakEvenPrice: number;
  riskRewardRatio: number;
  winRateRequired: number; // percentage for break-even
  profitAtTarget: number;
  profitPercentAtTarget: number;
}

/**
 * Calculate profit target and risk-reward analysis
 * Formula: Win Rate Required = Loss Risk / (Win Profit + Loss Risk)
 * @param entryPrice Entry price per share
 * @param profitTargetPercent Profit target as percentage (e.g., 10 for 10%)
 * @param stopLossPercent Stop loss as percentage (e.g., 5 for 5%)
 * @param positionSizeShares Position size in shares
 */
export function calculateProfitTarget(
  entryPrice: number,
  profitTargetPercent: number,
  stopLossPercent: number,
  positionSizeShares: number
): ProfitTargetResult {
  const targetPrice = entryPrice * (1 + profitTargetPercent / 100);
  const breakEvenPrice = entryPrice;
  const stopPrice = entryPrice * (1 - stopLossPercent / 100);

  const profitAtTarget = (targetPrice - entryPrice) * positionSizeShares;
  const profitPercentAtTarget = profitTargetPercent;

  const winProfit = profitTargetPercent;
  const lossRisk = stopLossPercent;

  // Win rate needed = risk / (profit + risk)
  const winRateRequired = (lossRisk / (winProfit + lossRisk)) * 100;

  const riskRewardRatio = winProfit > 0 ? winProfit / lossRisk : 0;

  return {
    targetPrice: Math.round(targetPrice * 100) / 100,
    breakEvenPrice: Math.round(breakEvenPrice * 100) / 100,
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
    winRateRequired: Math.round(winRateRequired * 100) / 100,
    profitAtTarget: Math.round(profitAtTarget * 100) / 100,
    profitPercentAtTarget: Math.round(profitPercentAtTarget * 100) / 100,
  };
}
