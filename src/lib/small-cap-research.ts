import { listAwards } from '@/lib/gov-awards';
import { SMART_MONEY } from '@/lib/smart-money';
import {
  FILING_CAVEAT,
  getTheme,
  scoreThemeCompanies,
  type ScoredCompany,
  type ThemeCompany,
} from '@/lib/world-radar';
import type { SignalRow } from '@/types/scanner';

export type SmallCapSourceTier = 'official-primary' | 'market-data' | 'news-alt' | 'social-risk';

export interface SmallCapResearchSource {
  id: string;
  name: string;
  url: string;
  tier: SmallCapSourceTier;
  bestFor: string;
  freshness: string;
  integration: 'live-now' | 'next' | 'later';
}

export interface SmallCapResearchScore {
  technicalScore: number;
  buyerVolumeScore: number;
  governmentScore: number;
  evidenceScore: number;
  verticalScore: number;
  riskPenalty: number;
  totalScore: number;
}

export interface PaperBotReadiness {
  eligible: boolean;
  reason: string;
  defaultQuantity: number;
  route: string;
}

export interface SmallCapResearchCandidate {
  symbol: string;
  name: string;
  theme: string;
  vertical: string;
  sizeBucket: ThemeCompany['sizeBucket'];
  whyItMatters: string;
  evidenceSummary: string;
  risks: string[];
  sourceHighlights: string[];
  researchState: string;
  score: SmallCapResearchScore;
  paperBot: PaperBotReadiness;
}

export interface SmallCapResearchBackend {
  generatedAt: string;
  sources: SmallCapResearchSource[];
  candidates: SmallCapResearchCandidate[];
  caveats: string[];
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const SMALL_CAP_RESEARCH_SOURCES: SmallCapResearchSource[] = [
  {
    id: 'usaspending',
    name: 'USAspending.gov API',
    url: 'https://api.usaspending.gov/',
    tier: 'official-primary',
    bestFor: 'US federal contracts, grants, loans and award search by recipient.',
    freshness: 'Official federal award data; endpoint access is public.',
    integration: 'next',
  },
  {
    id: 'sam-awards',
    name: 'SAM.gov Contract Awards API',
    url: 'https://open.gsa.gov/api/contract-awards/',
    tier: 'official-primary',
    bestFor: 'Award/IDV contract data, agency, vendor and procurement signal extraction.',
    freshness: 'Official procurement data; requires SAM/GSA access.',
    integration: 'next',
  },
  {
    id: 'austender',
    name: 'AusTender OCDS API',
    url: 'https://github.com/austender/austender-ocds-api',
    tier: 'official-primary',
    bestFor: 'Australian Government contract notices in Open Contracting Data Standard format.',
    freshness: 'Official AU procurement data; token-gated API.',
    integration: 'next',
  },
  {
    id: 'edgar',
    name: 'SEC EDGAR data APIs',
    url: 'https://data.sec.gov/',
    tier: 'official-primary',
    bestFor: 'Submissions, XBRL company facts, Form 4, 13F, 8-K and filings evidence.',
    freshness: 'Official SEC JSON APIs; fair-access rules apply.',
    integration: 'next',
  },
  {
    id: 'finra-short-interest',
    name: 'FINRA short interest data',
    url: 'https://www.finra.org/finra-data/browse-catalog/equity-short-interest',
    tier: 'official-primary',
    bestFor: 'Short-interest pressure and potential squeeze/risk context.',
    freshness: 'Reported twice monthly under FINRA Rule 4560.',
    integration: 'later',
  },
  {
    id: 'finnhub',
    name: 'Finnhub API',
    url: 'https://finnhub.io/docs/api',
    tier: 'market-data',
    bestFor: 'Price/news/fundamentals and quick live-news extraction.',
    freshness: 'Low-friction market/news API; free tier available.',
    integration: 'live-now',
  },
  {
    id: 'twelvedata',
    name: 'Twelve Data API',
    url: 'https://twelvedata.com/docs',
    tier: 'market-data',
    bestFor: 'Global OHLCV, indicators and mobile-watchlist polling.',
    freshness: 'Free/basic tier can seed watchlists; paid tiers lift limits.',
    integration: 'later',
  },
  {
    id: 'polygon',
    name: 'Polygon/Massive stocks API',
    url: 'https://massive.com/docs/rest/stocks/overview',
    tier: 'market-data',
    bestFor: 'Higher-grade intraday aggregates, trades, quotes and WebSocket feeds.',
    freshness: 'Paid-grade stream/backfill option for high-frequency alerts.',
    integration: 'later',
  },
];

function signalBySymbol(signals: SignalRow[]): Map<string, SignalRow> {
  return new Map(signals.map((signal) => [signal.symbol, signal]));
}

function governmentHighlights(company: ScoredCompany): string[] {
  const symbol = company.symbol.toUpperCase();
  const highlights: string[] = [];

  for (const award of listAwards()) {
    if (award.tickers.includes(symbol) || award.theme.toLowerCase().includes(company.theme.replace(/-/g, ' '))) {
      highlights.push(`${award.source.name}: ${award.summary}`);
    }
  }

  for (const item of SMART_MONEY) {
    if (item.ticker === symbol || item.backer === 'government') {
      if (item.ticker === symbol) highlights.push(`${item.backerName}: ${item.catalyst}`);
    }
  }

  return Array.from(new Set(highlights)).slice(0, 3);
}

function governmentScore(company: ScoredCompany): number {
  const directHighlights = governmentHighlights(company).length;
  const theme = getTheme(company.theme);
  return clamp(company.evidence * 0.55 + (theme?.policySupport ?? 50) * 0.25 + directHighlights * 15);
}

function buyerVolumeScore(signal?: SignalRow): number {
  if (!signal) return 45;
  const volumeRatio = Math.min(3, Math.max(0, signal.volumeRatio || 0));
  const volumeComponent = (volumeRatio / 3) * 70;
  const deltaComponent = Math.max(0, Math.min(30, signal.scoreDelta || 0) * 2);
  return clamp(volumeComponent + deltaComponent);
}

function technicalScore(signal?: SignalRow): number {
  if (!signal) return 50;
  const rsi = signal.rsi || 50;
  const rsiComponent = rsi >= 40 && rsi <= 65 ? 12 : rsi > 78 ? -10 : 0;
  const macdComponent = signal.histogramSlope > 0 ? 10 : signal.macdHistogram > 0 ? 6 : 0;
  return clamp(signal.score * 0.8 + rsiComponent + macdComponent);
}

function verticalScore(company: ScoredCompany): number {
  const theme = getTheme(company.theme);
  return clamp(company.score.themeFit * 0.35 + (theme?.smallCapOpportunity ?? 50) * 0.35 + (theme?.capitalFlow ?? 50) * 0.2 + (theme?.policySupport ?? 50) * 0.1);
}

function riskPenalty(company: ScoredCompany): number {
  return clamp(company.score.riskPenalty + Math.max(0, 45 - company.liquidity) * 0.35);
}

function researchState(totalScore: number, company: ScoredCompany, paperBot: boolean): string {
  if (company.hypeRisk >= 70 || company.dilutionRisk >= 70) return 'Risk review only';
  if (paperBot) return 'Paper-bot research queue';
  if (totalScore >= 66) return 'Deep research candidate';
  if (totalScore >= 56) return 'Watchlist candidate';
  return 'Monitor';
}

function paperBotReadiness(company: ScoredCompany, score: SmallCapResearchScore, signal?: SignalRow): PaperBotReadiness {
  const eligible =
    score.totalScore >= 68 &&
    score.technicalScore >= 60 &&
    score.buyerVolumeScore >= 50 &&
    company.liquidity >= 35 &&
    company.hypeRisk < 70 &&
    company.dilutionRisk < 70 &&
    Boolean(signal);

  if (!eligible) {
    return {
      eligible: false,
      reason: signal ? 'Needs stronger score/liquidity confirmation before a paper proposal.' : 'Not covered by the live signal scanner yet.',
      defaultQuantity: 0,
      route: '/paper-bot',
    };
  }

  const defaultQuantity = score.totalScore >= 78 ? 15 : 10;
  return {
    eligible: true,
    reason: 'Eligible for paper-only proposal review. Manual approval still required.',
    defaultQuantity,
    route: `/paper-bot?symbol=${encodeURIComponent(company.symbol)}&quantity=${defaultQuantity}`,
  };
}

function buildCandidate(company: ScoredCompany, signal?: SignalRow): SmallCapResearchCandidate {
  const technical = technicalScore(signal);
  const buyerVolume = buyerVolumeScore(signal);
  const gov = governmentScore(company);
  const evidence = clamp(company.evidence);
  const vertical = verticalScore(company);
  const risk = riskPenalty(company);
  const totalScore = clamp(
    company.score.total * 0.25 +
      technical * 0.18 +
      buyerVolume * 0.18 +
      gov * 0.18 +
      evidence * 0.12 +
      vertical * 0.14 -
      risk * 0.2,
  );
  const score = {
    technicalScore: technical,
    buyerVolumeScore: buyerVolume,
    governmentScore: gov,
    evidenceScore: evidence,
    verticalScore: vertical,
    riskPenalty: risk,
    totalScore,
  };
  const paperBot = paperBotReadiness(company, score, signal);

  return {
    symbol: company.symbol,
    name: company.name,
    theme: company.theme,
    vertical: getTheme(company.theme)?.name ?? company.theme,
    sizeBucket: company.sizeBucket,
    whyItMatters: company.whyItMatters,
    evidenceSummary: company.evidenceSummary,
    risks: company.risks,
    sourceHighlights: governmentHighlights(company),
    researchState: researchState(totalScore, company, paperBot.eligible),
    score,
    paperBot,
  };
}

export function buildSmallCapResearchBackend(signals: SignalRow[]): SmallCapResearchBackend {
  const signalsBySymbol = signalBySymbol(signals);
  const momentumBySymbol = Object.fromEntries(signals.map((signal) => [signal.symbol, signal.score]));
  const scored = scoreThemeCompanies(undefined, momentumBySymbol).filter(
    (company) => company.sizeBucket === 'small' || company.sizeBucket === 'micro',
  );

  const candidates = scored
    .map((company) => buildCandidate(company, signalsBySymbol.get(company.symbol)))
    .sort((a, b) => b.score.totalScore - a.score.totalScore);

  return {
    generatedAt: new Date().toISOString(),
    sources: SMALL_CAP_RESEARCH_SOURCES,
    candidates,
    caveats: [
      'Research only - not financial advice.',
      'Paper bot candidates are simulated only and still require explicit manual approval.',
      FILING_CAVEAT,
    ],
  };
}
