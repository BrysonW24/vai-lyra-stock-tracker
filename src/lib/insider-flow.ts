/**
 * Insider flow - SEC Form 4 transactions WITH context, the gap the doc flags: retail apps
 * surface insider trades as isolated events; what matters is whether a buy is open-market,
 * clustered, repeated, or merely administrative. Each row carries that interpretation.
 * Curated illustrative sample (flagged) until the live Form 3/4/5 feed wires in. Research
 * context, never advice - and Form 4 is prompt (filed within ~2 business days) but a single
 * filing proves little on its own.
 */
export type InsiderTxType = 'open_market_buy' | 'open_market_sell' | 'option_exercise' | 'planned_10b5_1' | 'gift';

export interface InsiderTx {
  id: string;
  symbol: string;
  companyName: string;
  insider: string;
  role: string;
  txType: InsiderTxType;
  shares: number;
  valueUsd: number;
  date: string;
  /** Part of a cluster of insider activity in a short window. */
  clustered: boolean;
  /** Short pattern read, e.g. "3rd open-market buy in 60d". */
  pattern: string;
  /** What it does / does not signal. */
  context: string;
  sourceUrl: string;
}

export const INSIDER_FLOW_SAMPLE = true;

const SEC = 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany';

/** Plain-English label + whether it leans bullish / bearish / neutral for tone. */
export const TX_META: Record<InsiderTxType, { label: string; tone: 'pos' | 'neg' | 'neutral' }> = {
  open_market_buy: { label: 'Open-market buy', tone: 'pos' },
  open_market_sell: { label: 'Open-market sell', tone: 'neg' },
  option_exercise: { label: 'Option exercise', tone: 'neutral' },
  planned_10b5_1: { label: 'Planned (10b5-1)', tone: 'neutral' },
  gift: { label: 'Gift / transfer', tone: 'neutral' },
};

export const INSIDER_FLOW: InsiderTx[] = [
  {
    id: 'ins-avgo-cluster',
    symbol: 'AVGO',
    companyName: 'Broadcom',
    insider: 'Two directors + CFO',
    role: 'Board + CFO',
    txType: 'open_market_buy',
    shares: 18500,
    valueUsd: 24_600_000,
    date: '2026-06-11',
    clustered: true,
    pattern: 'Cluster: 3 insiders bought within 6 days',
    context: 'Open-market cluster buying is the highest-conviction insider signal - real cash, multiple insiders, no plan.',
    sourceUrl: SEC,
  },
  {
    id: 'ins-snow-ceo',
    symbol: 'SNOW',
    companyName: 'Snowflake',
    insider: 'CEO',
    role: 'Chief Executive',
    txType: 'open_market_buy',
    shares: 12000,
    valueUsd: 2_790_000,
    date: '2026-06-09',
    clustered: false,
    pattern: '1st open-market buy in 12 months',
    context: 'A first open-market CEO buy after a long gap is notable - but one filing is a data point, not a thesis.',
    sourceUrl: SEC,
  },
  {
    id: 'ins-nvda-plan',
    symbol: 'NVDA',
    companyName: 'Nvidia',
    insider: 'CEO',
    role: 'Chief Executive',
    txType: 'planned_10b5_1',
    shares: 60000,
    valueUsd: 12_300_000,
    date: '2026-06-06',
    clustered: false,
    pattern: 'Scheduled under a 10b5-1 plan',
    context: 'Pre-scheduled sales carry low signal - set in advance, mechanical, not a view on price.',
    sourceUrl: SEC,
  },
  {
    id: 'ins-crm-sell',
    symbol: 'CRM',
    companyName: 'Salesforce',
    insider: 'EVP',
    role: 'Executive VP',
    txType: 'open_market_sell',
    shares: 8000,
    valueUsd: 1_320_000,
    date: '2026-06-04',
    clustered: false,
    pattern: 'Isolated sell, < 10% of holdings',
    context: 'A small isolated sell is usually liquidity/diversification, not a signal - context and size matter.',
    sourceUrl: SEC,
  },
  {
    id: 'ins-amd-cluster',
    symbol: 'AMD',
    companyName: 'Advanced Micro Devices',
    insider: 'CFO + director',
    role: 'CFO + Board',
    txType: 'open_market_buy',
    shares: 9500,
    valueUsd: 4_860_000,
    date: '2026-06-02',
    clustered: true,
    pattern: '2nd cluster buy this quarter',
    context: 'Repeated cluster buying compounds the signal - insiders adding again into the same name.',
    sourceUrl: SEC,
  },
  {
    id: 'ins-pltr-option',
    symbol: 'PLTR',
    companyName: 'Palantir',
    insider: 'Director',
    role: 'Board',
    txType: 'option_exercise',
    shares: 40000,
    valueUsd: 1_010_000,
    date: '2026-05-30',
    clustered: false,
    pattern: 'Exercise + hold (no sale)',
    context: 'An exercise where shares are held (not sold) is mildly constructive; an exercise-and-dump is not.',
    sourceUrl: SEC,
  },
];

/** Newest first. */
export function listInsiderFlow(): InsiderTx[] {
  return [...INSIDER_FLOW].sort((a, b) => b.date.localeCompare(a.date));
}
