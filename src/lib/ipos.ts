/**
 * IPO intelligence - types + deterministic demo data + helpers.
 *
 * SINGLE-OPERATOR, research software (NOT financial advice). All figures are
 * illustrative demo data. `modelEstimate` is a DETERMINISTIC research scenario
 * (bear/base/bull), never a forecast presented as fact and never a recommendation.
 *
 * A future events/IPO worker will mirror these field names in SQL (table `ipos`)
 * and flip this to live data behind a Finnhub key. Until then this is demo-safe.
 *
 * AI-native content: the editorial seed records live in content/ipos.jsonl (one per
 * line, easy for an agent or human to edit) and are compiled to the imported JSON by
 * scripts/build-content.mjs (runs via predev / prebuild). Edit the JSONL, not this
 * file. `modelEstimate` is NOT stored in the JSONL - it is derived deterministically
 * here by buildEstimate() from each seed.
 */
import iposData from '@/lib/generated/ipos.json';

export type IpoCategory =
  | 'mega_cap_platform'
  | 'ai_infrastructure'
  | 'semiconductor'
  | 'software'
  | 'cloud_data'
  | 'cybersecurity'
  | 'consumer_internet'
  | 'fintech_tech';

export type IpoStatus = 'upcoming' | 'priced' | 'recent';

export interface IpoKeyPerson {
  name: string;
  role: string;
}

export interface IpoModelEstimate {
  bearPrice: number;
  basePrice: number;
  bullPrice: number;
  horizonMonths: number;
  confidence: 'low' | 'medium' | 'high';
  /** Plain-English, deterministic rationale referencing the actual figures. Research only. */
  rationale: string[];
}

export interface IpoCompany {
  symbol: string;
  companyName: string;
  ipoDate: string; // ISO date
  exchange: string;
  category: IpoCategory;
  status: IpoStatus;
  offerPrice: number;
  sharesOfferedM: number; // millions of shares
  proceedsUsdM: number; // capital raised, $M
  valuationUsdM: number; // implied market cap, $M
  firstDayClosePct?: number;
  currentPrice?: number;
  returnSinceIpoPct?: number;
  revenueTtmUsdM?: number;
  revenueGrowthPct?: number;
  grossMarginPct?: number;
  netIncomeUsdM?: number;
  profitable: boolean;
  employees?: number;
  products: string[];
  notableProjects: string[];
  keyPeople: IpoKeyPerson[];
  description: string;
  domain: string;
  modelEstimate: IpoModelEstimate;
}

type IpoSeed = Omit<IpoCompany, 'modelEstimate'>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Deterministic research scenario. NOT a forecast or recommendation.
 * Derives a bear/base/bull range from the reference price, nudged by revenue
 * growth and profitability. Pure function - same input always yields same output.
 */
function buildEstimate(s: IpoSeed): IpoModelEstimate {
  const ref = s.currentPrice ?? s.offerPrice;
  const growthPct = s.revenueGrowthPct ?? 0;
  const g = Math.max(-0.3, Math.min(0.6, growthPct / 100));
  const profBonus = s.profitable ? 0.05 : 0;

  const basePrice = round2(ref * (1 + g * 0.5));
  const bullPrice = round2(ref * (1 + g * 0.5 + 0.25 + profBonus));
  const bearPrice = round2(ref * (1 - 0.22 + (s.profitable ? 0.04 : -0.03)));

  let confidence: IpoModelEstimate['confidence'] = 'low';
  if (s.revenueTtmUsdM && s.profitable && Math.abs(growthPct) < 60) {
    confidence = 'medium';
  }
  if (s.revenueTtmUsdM && s.profitable && growthPct > 0 && growthPct < 35 && s.status !== 'upcoming') {
    confidence = 'high';
  }

  const rationale = [
    `Reference ${ref.toFixed(2)} with TTM revenue ${s.revenueTtmUsdM ? `$${s.revenueTtmUsdM}M` : 'not disclosed'}` +
      `${s.revenueGrowthPct !== undefined ? ` growing ${s.revenueGrowthPct}% YoY` : ''}.`,
    s.profitable
      ? 'Profitable on a TTM basis, which narrows the modelled downside.'
      : 'Not yet profitable, so the model widens the bear case.',
    `Implied valuation at IPO ≈ $${(s.valuationUsdM / 1000).toFixed(1)}B; ${s.employees ? `${s.employees.toLocaleString()} staff.` : 'headcount undisclosed.'}`,
    'Bear/base/bull is a deterministic research range over ~12 months - not a forecast, target, or recommendation.',
  ];

  return { bearPrice, basePrice, bullPrice, horizonMonths: 12, confidence, rationale };
}

// Editorial seed records now live in content/ipos.jsonl (one record per line) and are
// compiled to src/lib/generated/ipos.json by scripts/build-content.mjs. Edit the JSONL,
// not this file. Each line is an IpoSeed (every IpoCompany field except modelEstimate,
// which buildEstimate() derives below).
const IPO_SEEDS: IpoSeed[] = iposData as IpoSeed[];

const ALL_IPOS: IpoCompany[] = IPO_SEEDS.map((s) => ({ ...s, modelEstimate: buildEstimate(s) }))
  .sort((a, b) => b.valuationUsdM - a.valuationUsdM);

/** All IPOs, ranked by implied valuation (the "highest" first). */
export function getIpos(): IpoCompany[] {
  return ALL_IPOS;
}

/** Top N IPOs by valuation. Defaults to the 50 highest. */
export function topIposByValuation(n = 50): IpoCompany[] {
  return ALL_IPOS.slice(0, n);
}

/** Upcoming IPOs only, soonest first. */
export function upcomingIpos(): IpoCompany[] {
  return ALL_IPOS.filter((i) => i.status === 'upcoming').sort((a, b) => a.ipoDate.localeCompare(b.ipoDate));
}

/** Lookup a single IPO by ticker symbol. */
export function getIpoBySymbol(symbol: string): IpoCompany | undefined {
  return ALL_IPOS.find((i) => i.symbol.toLowerCase() === symbol.toLowerCase());
}

export function ipoCategoryLabel(category: IpoCategory): string {
  const labels: Record<IpoCategory, string> = {
    mega_cap_platform: 'Mega-cap Platform',
    ai_infrastructure: 'AI Infrastructure',
    semiconductor: 'Semiconductor',
    software: 'Software',
    cloud_data: 'Cloud & Data',
    cybersecurity: 'Cybersecurity',
    consumer_internet: 'Consumer Internet',
    fintech_tech: 'Fintech',
  };
  return labels[category];
}

export function ipoStatusClass(status: IpoStatus): string {
  const classes: Record<IpoStatus, string> = {
    upcoming: 'border-[#3b5bdb] bg-[#0d1530] text-[#8aa2ff]',
    priced: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
    recent: 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]',
  };
  return classes[status];
}
