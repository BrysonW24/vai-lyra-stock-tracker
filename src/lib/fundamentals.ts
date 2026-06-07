/**
 * Fundamentals Library
 *
 * Defines types and deterministic demo data for business-quality metrics.
 * All values are realistic but clearly labeled as demo data.
 *
 * Quality Score (0-100): Composite measure of growth momentum, profitability,
 * and cash generation. Formula: (revGrowthYoY * 0.4) + (grossMargin * 0.3) +
 * (min(freeCashFlowMargin, 100) * 0.3), clamped to [0, 100].
 *
 * Valuation Read: Simple PEG-style comparison of forward P/E to earnings growth.
 * - 'rich': Forward P/E > (earnings growth * 1.2)
 * - 'cheap': Forward P/E < (earnings growth * 0.8)
 * - 'fair': Everything else
 */

export interface TickerFundamentals {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;

  // Scale: billions USD
  marketCap: number;
  enterpriseValue: number;

  // Income statement (annual, USD millions)
  revenue: number;
  revenueGrowthYoY: number; // percent
  grossMargin: number; // percent
  operatingMargin: number; // percent
  netIncome: number;

  // Cash flow (annual, USD millions)
  freeCashFlow: number;
  ebitda: number;

  // Balance sheet (USD millions)
  cash: number;
  debt: number;

  // Valuation multiples
  pe: number; // trailing P/E
  forwardPe: number;
  priceToSales: number;
  evToEbitda: number;
  evToRevenue: number;

  // Growth (percent YoY)
  epsGrowth: number;
}

export interface FundamentalsReport extends TickerFundamentals {
  qualityScore: number; // 0-100
  valuationRead: 'rich' | 'fair' | 'cheap';
}

/**
 * Calculate quality score (0-100) from fundamentals.
 * Weights: revGrowthYoY 40%, grossMargin 30%, FCF margin 30%.
 * FCF margin = freeCashFlow / revenue.
 */
export function calculateQualityScore(ticker: TickerFundamentals): number {
  const revGrowthComponent = Math.min(ticker.revenueGrowthYoY, 50); // cap at 50
  const marginComponent = ticker.grossMargin;
  const fcfMargin = (ticker.freeCashFlow / ticker.revenue) * 100;
  const fcfComponent = Math.min(Math.max(fcfMargin, 0), 100); // 0-100 range

  const score =
    revGrowthComponent * 0.4 + marginComponent * 0.3 + fcfComponent * 0.3;

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Determine valuation read from P/E, forward P/E, and earnings growth.
 * Simple PEG-style rule: P/E relative to growth.
 */
export function getValuationRead(
  ticker: TickerFundamentals
): 'rich' | 'fair' | 'cheap' {
  const growthThreshold = ticker.epsGrowth;

  // Rich if forward P/E > growth * 1.2
  if (ticker.forwardPe > growthThreshold * 1.2) {
    return 'rich';
  }

  // Cheap if forward P/E < growth * 0.8
  if (ticker.forwardPe < growthThreshold * 0.8) {
    return 'cheap';
  }

  return 'fair';
}

/**
 * Generate a FundamentalsReport (quality score + valuation read).
 */
export function getFundamentalsReport(
  ticker: TickerFundamentals
): FundamentalsReport {
  return {
    ...ticker,
    qualityScore: calculateQualityScore(ticker),
    valuationRead: getValuationRead(ticker),
  };
}

/**
 * Demo fundamentals for 12 tech tickers.
 * All values are realistic but clearly demo-labeled.
 */
export const demoFundamentals: TickerFundamentals[] = [
  {
    symbol: 'NVDA',
    companyName: 'Nvidia',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 3100,
    enterpriseValue: 3050,
    revenue: 60200,
    revenueGrowthYoY: 126,
    grossMargin: 71.2,
    operatingMargin: 52.1,
    netIncome: 25500,
    freeCashFlow: 28100,
    ebitda: 35200,
    cash: 28500,
    debt: 1200,
    pe: 67.3,
    forwardPe: 48.2,
    priceToSales: 50.8,
    evToEbitda: 86.5,
    evToRevenue: 50.2,
    epsGrowth: 143,
  },
  {
    symbol: 'MSFT',
    companyName: 'Microsoft',
    sector: 'Technology',
    industry: 'Software',
    marketCap: 3050,
    enterpriseValue: 2920,
    revenue: 245122,
    revenueGrowthYoY: 16.3,
    grossMargin: 69.8,
    operatingMargin: 46.2,
    netIncome: 88188,
    freeCashFlow: 80200,
    ebitda: 128400,
    cash: 68900,
    debt: 45600,
    pe: 39.2,
    forwardPe: 34.8,
    priceToSales: 12.1,
    evToEbitda: 22.3,
    evToRevenue: 10.9,
    epsGrowth: 10,
  },
  {
    symbol: 'AAPL',
    companyName: 'Apple',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    marketCap: 2900,
    enterpriseValue: 2750,
    revenue: 394328,
    revenueGrowthYoY: 2.1,
    grossMargin: 46.1,
    operatingMargin: 30.5,
    netIncome: 96995,
    freeCashFlow: 110543,
    ebitda: 130100,
    cash: 29941,
    debt: 106599,
    pe: 35.8,
    forwardPe: 33.2,
    priceToSales: 7.4,
    evToEbitda: 20.9,
    evToRevenue: 6.8,
    epsGrowth: 4,
  },
  {
    symbol: 'GOOGL',
    companyName: 'Alphabet',
    sector: 'Technology',
    industry: 'Internet Services',
    marketCap: 2150,
    enterpriseValue: 2010,
    revenue: 307394,
    revenueGrowthYoY: 13.5,
    grossMargin: 56.3,
    operatingMargin: 22.4,
    netIncome: 64741,
    freeCashFlow: 68900,
    ebitda: 95200,
    cash: 110815,
    debt: 13200,
    pe: 28.1,
    forwardPe: 24.6,
    priceToSales: 6.9,
    evToEbitda: 21.1,
    evToRevenue: 6.5,
    epsGrowth: 18,
  },
  {
    symbol: 'AMZN',
    companyName: 'Amazon',
    sector: 'Technology',
    industry: 'E-commerce',
    marketCap: 1950,
    enterpriseValue: 1880,
    revenue: 575149,
    revenueGrowthYoY: 11.1,
    grossMargin: 42.8,
    operatingMargin: 9.2,
    netIncome: 30345,
    freeCashFlow: 55100,
    ebitda: 71200,
    cash: 61074,
    debt: 43000,
    pe: 58.2,
    forwardPe: 49.8,
    priceToSales: 3.4,
    evToEbitda: 26.4,
    evToRevenue: 3.3,
    epsGrowth: 12,
  },
  {
    symbol: 'META',
    companyName: 'Meta',
    sector: 'Technology',
    industry: 'Internet Services',
    marketCap: 1850,
    enterpriseValue: 1810,
    revenue: 134902,
    revenueGrowthYoY: 22.1,
    grossMargin: 80.2,
    operatingMargin: 38.5,
    netIncome: 23200,
    freeCashFlow: 27100,
    ebitda: 60300,
    cash: 65317,
    debt: 5100,
    pe: 34.2,
    forwardPe: 28.9,
    priceToSales: 13.7,
    evToEbitda: 29.9,
    evToRevenue: 13.4,
    epsGrowth: 35,
  },
  {
    symbol: 'NVDA',
    companyName: 'Nvidia',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 3100,
    enterpriseValue: 3050,
    revenue: 60200,
    revenueGrowthYoY: 126,
    grossMargin: 71.2,
    operatingMargin: 52.1,
    netIncome: 25500,
    freeCashFlow: 28100,
    ebitda: 35200,
    cash: 28500,
    debt: 1200,
    pe: 67.3,
    forwardPe: 48.2,
    priceToSales: 50.8,
    evToEbitda: 86.5,
    evToRevenue: 50.2,
    epsGrowth: 143,
  },
  {
    symbol: 'AMD',
    companyName: 'Advanced Micro Devices',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 245,
    enterpriseValue: 235,
    revenue: 26600,
    revenueGrowthYoY: -4.1,
    grossMargin: 47.8,
    operatingMargin: 2.1,
    netIncome: 1800,
    freeCashFlow: 2100,
    ebitda: 1700,
    cash: 5900,
    debt: 2100,
    pe: 132.4,
    forwardPe: 24.3,
    priceToSales: 9.2,
    evToEbitda: 138.2,
    evToRevenue: 8.8,
    epsGrowth: -89,
  },
  {
    symbol: 'CRM',
    companyName: 'Salesforce',
    sector: 'Technology',
    industry: 'Enterprise Software',
    marketCap: 345,
    enterpriseValue: 340,
    revenue: 33600,
    revenueGrowthYoY: 8.5,
    grossMargin: 73.6,
    operatingMargin: 9.8,
    netIncome: 2100,
    freeCashFlow: 4300,
    ebitda: 5100,
    cash: 8600,
    debt: 5200,
    pe: 158.9,
    forwardPe: 45.2,
    priceToSales: 10.3,
    evToEbitda: 66.7,
    evToRevenue: 10.1,
    epsGrowth: 20,
  },
  {
    symbol: 'NOW',
    companyName: 'ServiceNow',
    sector: 'Technology',
    industry: 'Enterprise Software',
    marketCap: 320,
    enterpriseValue: 310,
    revenue: 9290,
    revenueGrowthYoY: 27.2,
    grossMargin: 77.3,
    operatingMargin: 3.2,
    netIncome: 250,
    freeCashFlow: 1100,
    ebitda: 600,
    cash: 2800,
    debt: 1900,
    pe: 1256.0,
    forwardPe: 42.8,
    priceToSales: 34.4,
    evToEbitda: 516.7,
    evToRevenue: 33.4,
    epsGrowth: 32,
  },
  {
    symbol: 'CRWD',
    companyName: 'CrowdStrike',
    sector: 'Technology',
    industry: 'Cybersecurity',
    marketCap: 345,
    enterpriseValue: 340,
    revenue: 2700,
    revenueGrowthYoY: 30.5,
    grossMargin: 80.1,
    operatingMargin: 22.4,
    netIncome: 400,
    freeCashFlow: 640,
    ebitda: 650,
    cash: 3200,
    debt: 400,
    pe: 857.5,
    forwardPe: 58.3,
    priceToSales: 127.8,
    evToEbitda: 523.1,
    evToRevenue: 125.9,
    epsGrowth: 48,
  },
  {
    symbol: 'SNOW',
    companyName: 'Snowflake',
    sector: 'Technology',
    industry: 'Cloud Data',
    marketCap: 180,
    enterpriseValue: 175,
    revenue: 1700,
    revenueGrowthYoY: 33.3,
    grossMargin: 68.2,
    operatingMargin: -12.5,
    netIncome: -250,
    freeCashFlow: -180,
    ebitda: -150,
    cash: 2100,
    debt: 50,
    pe: -681.0,
    forwardPe: 52.1,
    priceToSales: 105.9,
    evToEbitda: -1166.7,
    evToRevenue: 102.9,
    epsGrowth: -115,
  },
];

/**
 * Get demo fundamental reports for all tickers.
 */
export function getDemoFundamentalReports(): FundamentalsReport[] {
  return demoFundamentals.map(getFundamentalsReport);
}

/**
 * Get demo fundamental report for a specific ticker.
 */
export function getDemoFundamentalReport(
  symbol: string
): FundamentalsReport | null {
  const ticker = demoFundamentals.find((t) => t.symbol === symbol);
  if (!ticker) return null;
  return getFundamentalsReport(ticker);
}
