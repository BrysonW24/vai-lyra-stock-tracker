/**
 * World Radar - the thematic intelligence layer on top of the deterministic scanner.
 *
 * Lyra's expansion thesis: do not just scan stocks - scan the real-world causal chain
 * behind future returns (themes -> physical bottlenecks -> supply-chain nodes ->
 * companies -> evidence). The deterministic engine owns every score here; AI only ever
 * explains. Research software, not financial advice - no output is a buy/sell call.
 *
 * AI-native content: all editorial records live in content/*.jsonl (themes,
 * supply-chain-nodes, theme-companies, capital-events, investors), compiled to the
 * imported JSON by scripts/build-content.mjs. Edit the JSONL, not this file.
 */
import themesData from '@/lib/generated/themes.json';
import nodesData from '@/lib/generated/supply-chain-nodes.json';
import companiesData from '@/lib/generated/theme-companies.json';
import eventsData from '@/lib/generated/capital-events.json';
import investorsData from '@/lib/generated/investors.json';

/* ------------------------------------------------------------------ types */

export type ThemeMaturity = 'early' | 'accelerating' | 'crowded' | 'bubble-risk' | 'cooling';

export interface Theme {
  slug: string;
  name: string;
  emoji: string;
  /** One-sentence thesis. */
  thesis: string;
  /** Long-form research thesis (a paragraph). */
  thesisLong: string;
  /** e.g. "2025-2032". */
  horizon: string;
  maturity: ThemeMaturity;
  /** 0-100 conviction that the thesis is real. */
  confidence: number;
  momentum: number;
  capitalFlow: number;
  policySupport: number;
  smallCapOpportunity: number;
  crowdingRisk: number;
  newsVelocity: number;
  /** Top physical/economic bottlenecks, plain names. */
  bottlenecks: string[];
  whyNow: string;
  /** What would prove this thesis wrong. */
  falsifier: string;
  risks: string[];
  etfs?: string[];
}

export interface SupplyChainNode {
  /** Stable id, e.g. "agi-power-generation". */
  id: string;
  /** Parent theme slug. */
  theme: string;
  /** Ordering: 1 = demand end, higher = deeper into physical inputs. */
  layer: number;
  name: string;
  description: string;
  whyItMatters: string;
  scarcity: number;
  bottleneck: number;
  pricingPower: number;
  /** Commodity names this node consumes (matches content/commodities.jsonl where possible). */
  commodities: string[];
  risks: string[];
}

export type SizeBucket = 'mega' | 'large' | 'mid' | 'small' | 'micro';
export type ExposureType = 'direct' | 'supplier' | 'second-order';

export interface ThemeCompany {
  symbol: string;
  name: string;
  /** Primary theme slug. */
  theme: string;
  /** Supply-chain node ids this company touches. */
  nodes: string[];
  sizeBucket: SizeBucket;
  exposure: ExposureType;
  whyItMatters: string;
  /** 0-100: real contracts / revenue / capacity / government support on record. */
  evidence: number;
  evidenceSummary: string;
  financialQuality: number;
  liquidity: number;
  /** 0-100, higher = the trade is more crowded/obvious. */
  crowding: number;
  hypeRisk: number;
  dilutionRisk: number;
  risks: string[];
}

export interface CapitalEvent {
  id: string;
  /** ISO date. */
  date: string;
  /** 'capex' | 'contract' | 'grant' | 'ppa' | 'offtake' | 'ma' | 'investment' | 'expansion'. */
  type: string;
  /** Who is committing the capital (company or government body). */
  actor: string;
  beneficiary?: string;
  /** Beneficiary's ticker if public. */
  symbol?: string;
  theme: string;
  node?: string;
  /** USD millions, when disclosed. */
  amountUsdM?: number;
  geography?: string;
  summary: string;
  sourceName: string;
  relevance: number;
  smallCapRelevance: number;
}

export type InvestorAction = 'new' | 'increase' | 'reduce' | 'exit' | 'hold';

export interface InvestorMove {
  symbol: string;
  name: string;
  action: InvestorAction;
  weightPct?: number;
  note?: string;
}

export interface Investor {
  id: string;
  name: string;
  firm: string;
  strategy: string;
  /** Theme slugs this manager is known for. */
  themes: string[];
  filingType: string;
  filingDate: string;
  periodEnd: string;
  moves: InvestorMove[];
}

/* -------------------------------------------------------------- accessors */

export const THEMES: Theme[] = themesData as Theme[];
export const SUPPLY_CHAIN_NODES: SupplyChainNode[] = nodesData as SupplyChainNode[];
export const THEME_COMPANIES: ThemeCompany[] = companiesData as ThemeCompany[];
export const CAPITAL_EVENTS: CapitalEvent[] = eventsData as CapitalEvent[];
export const INVESTORS: Investor[] = investorsData as Investor[];

/**
 * Threshold tone for a company opportunity total (0-100) - one scale everywhere.
 * The radar cards used to hardcode green for every total while the dossier toned by
 * band, so 45 read strong on one surface and neutral on the next (2026-08-14 audit).
 */
export function scoreTone(total: number): string {
  if (total >= 70) return 'text-positive';
  if (total >= 55) return 'text-accent';
  return 'text-ink-2';
}

export function getThemes(): Theme[] {
  return THEMES;
}

export function getTheme(slug: string): Theme | undefined {
  return THEMES.find((t) => t.slug === slug);
}

/** Nodes for a theme, sorted demand-end first (layer ascending). */
export function getNodesForTheme(slug: string): SupplyChainNode[] {
  return SUPPLY_CHAIN_NODES.filter((n) => n.theme === slug).sort((a, b) => a.layer - b.layer);
}

export function getNode(id: string): SupplyChainNode | undefined {
  return SUPPLY_CHAIN_NODES.find((n) => n.id === id);
}

export function getThemeCompanies(slug?: string): ThemeCompany[] {
  return slug ? THEME_COMPANIES.filter((c) => c.theme === slug) : THEME_COMPANIES;
}

export function getSmallCapCompanies(): ThemeCompany[] {
  return THEME_COMPANIES.filter((c) => c.sizeBucket === 'small' || c.sizeBucket === 'micro');
}

/** Capital events, newest first; optionally scoped to a theme. */
export function getCapitalEvents(theme?: string): CapitalEvent[] {
  const events = theme ? CAPITAL_EVENTS.filter((e) => e.theme === theme) : [...CAPITAL_EVENTS];
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export function getInvestors(): Investor[] {
  return INVESTORS;
}

export function getInvestorsForTheme(slug: string): Investor[] {
  return INVESTORS.filter((i) => i.themes.includes(slug));
}

/** Every disclosed move across tracked investors touching a symbol. */
export function getMovesForSymbol(symbol: string): { investor: Investor; move: InvestorMove }[] {
  const out: { investor: Investor; move: InvestorMove }[] = [];
  for (const investor of INVESTORS) {
    for (const move of investor.moves) {
      if (move.symbol === symbol) out.push({ investor, move });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- scoring */

export type OpportunityState =
  | 'Deep research candidate'
  | 'Watchlist candidate'
  | 'Momentum confirmed'
  | 'High quality but crowded'
  | 'Early but unproven'
  | 'Interesting but risky'
  | 'Avoid - hype/dilution risk'
  | 'Monitor';

/** Research-only action labels. Never 'buy' or 'sell'. */
export type ResearchAction = 'Research' | 'Watch' | 'Monitor' | 'Review risk';

export interface OpportunityBreakdown {
  themeFit: number;
  bottleneck: number;
  evidence: number;
  momentum: number;
  financialQuality: number;
  capitalFlow: number;
  liquidity: number;
  /** Combined crowding/hype/dilution drag, already applied to total. */
  riskPenalty: number;
  total: number;
  state: OpportunityState;
  action: ResearchAction;
}

export interface ScoredCompany extends ThemeCompany {
  score: OpportunityBreakdown;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

const EXPOSURE_FIT: Record<ExposureType, number> = { direct: 90, supplier: 72, 'second-order': 52 };

/**
 * Deterministic opportunity score. Rewards evidence and bottleneck exposure; penalises
 * hype, dilution and crowding. `momentum` joins the existing signal engine's 0-100 score
 * by symbol (neutral 50 when the scanner does not cover the name).
 */
export function scoreCompany(
  company: ThemeCompany,
  momentum: number | undefined,
  events: CapitalEvent[] = CAPITAL_EVENTS,
): OpportunityBreakdown {
  const theme = getTheme(company.theme);
  const nodes = company.nodes.map(getNode).filter((n): n is SupplyChainNode => Boolean(n));

  const themeFit = clamp(EXPOSURE_FIT[company.exposure] + Math.min(8, Math.max(0, nodes.length - 1) * 4));
  const bottleneck = clamp(nodes.length ? Math.max(...nodes.map((n) => n.bottleneck)) : 30);
  const mom = clamp(momentum ?? 50);

  const isBeneficiary = events.some((e) => e.symbol === company.symbol);
  const capitalFlow = clamp((theme?.capitalFlow ?? 50) + (isBeneficiary ? 12 : 0));

  const riskPenalty = clamp((company.crowding + company.hypeRisk + company.dilutionRisk) / 3) * 0.25;

  const positives =
    themeFit * 0.15 +
    bottleneck * 0.15 +
    company.evidence * 0.2 +
    mom * 0.1 +
    company.financialQuality * 0.15 +
    capitalFlow * 0.1 +
    company.liquidity * 0.05 +
    (theme?.confidence ?? 50) * 0.1;

  const total = clamp(positives - riskPenalty);

  let state: OpportunityState;
  if (company.hypeRisk >= 70 || company.dilutionRisk >= 70) state = 'Avoid - hype/dilution risk';
  else if (company.evidence < 40 && company.hypeRisk >= 50) state = 'Interesting but risky';
  else if (company.evidence < 40) state = 'Early but unproven';
  else if (company.evidence >= 60 && company.crowding >= 70) state = 'High quality but crowded';
  else if (total >= 72) state = 'Deep research candidate';
  else if (mom >= 70 && company.evidence >= 50) state = 'Momentum confirmed';
  else if (total >= 58) state = 'Watchlist candidate';
  else state = 'Monitor';

  const action: ResearchAction =
    state === 'Avoid - hype/dilution risk' || state === 'Interesting but risky'
      ? 'Review risk'
      : state === 'Deep research candidate'
        ? 'Research'
        : state === 'Watchlist candidate' || state === 'Momentum confirmed'
          ? 'Watch'
          : 'Monitor';

  return {
    themeFit,
    bottleneck,
    evidence: clamp(company.evidence),
    momentum: mom,
    financialQuality: clamp(company.financialQuality),
    capitalFlow,
    liquidity: clamp(company.liquidity),
    riskPenalty: Math.round(riskPenalty),
    total,
    state,
    action,
  };
}

/** Score and rank companies (optionally per theme), best opportunity first. */
export function scoreThemeCompanies(
  slug: string | undefined,
  momentumBySymbol: Record<string, number>,
): ScoredCompany[] {
  return getThemeCompanies(slug)
    .map((c) => ({ ...c, score: scoreCompany(c, momentumBySymbol[c.symbol]) }))
    .sort((a, b) => b.score.total - a.score.total);
}

/* ---------------------------------------------------- small-cap discovery */

export interface SmallCapBucket {
  bucket: string;
  blurb: string;
  items: ScoredCompany[];
}

/** Deterministic discovery buckets. A company lands in its first matching bucket. */
export function bucketSmallCaps(scored: ScoredCompany[]): SmallCapBucket[] {
  const defs: { bucket: string; blurb: string; match: (c: ScoredCompany) => boolean }[] = [
    {
      bucket: 'Avoid - dilution/hype risk',
      blurb: 'Narrative-heavy or balance-sheet-risky names. Listed so you do not chase them.',
      match: (c) => c.hypeRisk >= 70 || c.dilutionRisk >= 70,
    },
    {
      bucket: 'Emerging opportunities',
      blurb: 'Real evidence + bottleneck exposure, before the trade is obvious.',
      match: (c) => c.score.total >= 62 && c.evidence >= 50,
    },
    {
      bucket: 'High theme fit, low awareness',
      blurb: 'Directly exposed to a theme but not yet a crowded trade.',
      match: (c) => c.score.themeFit >= 70 && c.crowding <= 40,
    },
    {
      bucket: 'Strong fundamentals, no momentum yet',
      blurb: 'Quality names the market has not re-rated. Patience candidates.',
      match: (c) => c.financialQuality >= 60 && c.score.momentum < 55,
    },
    {
      bucket: 'Strong chart, weak fundamentals',
      blurb: 'Momentum without financial quality. Trade-only territory; know the difference.',
      match: (c) => c.score.momentum >= 60 && c.financialQuality < 45,
    },
    {
      bucket: 'Watch, do not chase',
      blurb: 'Interesting exposure but crowded or still light on evidence.',
      match: () => true,
    },
  ];

  const used = new Set<string>();
  return defs
    .map((d) => {
      const items = scored.filter((c) => !used.has(c.symbol) && d.match(c));
      items.forEach((c) => used.add(c.symbol));
      return { bucket: d.bucket, blurb: d.blurb, items };
    })
    .filter((b) => b.items.length > 0);
}

/* ------------------------------------------------------------- ui helpers */

export const MATURITY_TONE: Record<ThemeMaturity, string> = {
  early: 'border-[#2a4a7a] bg-[#0f1a2c] text-[#7fb0ff]',
  accelerating: 'border-[#1f5132] bg-[#0f2417] text-[#5fd08a]',
  crowded: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
  'bubble-risk': 'border-[#7a2630] bg-[#260f12] text-[#f0758a]',
  cooling: 'border-[#3a4754] bg-[#0d141c] text-[#a8b5c2]',
};

export const ACTION_TONE: Record<ResearchAction, string> = {
  Research: 'border-[#1f5132] bg-[#0f2417] text-[#5fd08a]',
  Watch: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
  Monitor: 'border-[#3a4754] bg-[#0d141c] text-[#a8b5c2]',
  'Review risk': 'border-[#7a2630] bg-[#260f12] text-[#f0758a]',
};

export const SIZE_LABEL: Record<SizeBucket, string> = {
  mega: 'Mega cap',
  large: 'Large cap',
  mid: 'Mid cap',
  small: 'Small cap',
  micro: 'Micro cap',
};

/** Standing caveat for all fund-filing surfaces. Show it wherever 13F data renders. */
export const FILING_CAVEAT =
  '13F filings are delayed (up to 45 days after quarter end) and incomplete: they show long US-listed positions only - no shorts, no private holdings, and positions may have changed since. Research context, never copy-trading.';
