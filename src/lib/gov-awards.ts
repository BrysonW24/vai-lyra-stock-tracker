/**
 * Government awards - contracts + grants from official US and Australian sources, tied to
 * tickers and themes. A doc "Highest priority" whitespace: official spend can move the
 * outlook before consensus models adjust. Curated illustrative sample for now (flagged);
 * the live pull from USAspending / SAM.gov / Grants.gov and AusTender / GrantConnect /
 * data.gov.au is the credential-gated next step. Research context, never advice.
 */
export type AwardRegion = 'US' | 'AU';
export type AwardKind = 'contract' | 'grant';

export interface AwardSource {
  name: string;
  domain: string;
  url: string;
}

export interface GovAward {
  id: string;
  region: AwardRegion;
  kind: AwardKind;
  agency: string;
  recipient: string;
  /** Public tickers with exposure (may be empty for private recipients). */
  tickers: string[];
  /** World Radar theme this feeds. */
  theme: string;
  /** Pre-formatted amount with its own currency. */
  amount: string;
  /** ISO date the award was announced. */
  date: string;
  summary: string;
  why: string;
  source: AwardSource;
}

export const GOV_AWARDS_SAMPLE = true;

const AUSTENDER: AwardSource = { name: 'AusTender', domain: 'tenders.gov.au', url: 'https://www.tenders.gov.au/' };
const GRANTCONNECT: AwardSource = { name: 'GrantConnect', domain: 'grants.gov.au', url: 'https://www.grants.gov.au/' };
const ARENA: AwardSource = { name: 'ARENA', domain: 'arena.gov.au', url: 'https://arena.gov.au/' };
const DATA_GOV_AU: AwardSource = { name: 'data.gov.au', domain: 'data.gov.au', url: 'https://data.gov.au/' };
const USASPENDING: AwardSource = { name: 'USAspending', domain: 'usaspending.gov', url: 'https://www.usaspending.gov/' };
const SAM_GOV: AwardSource = { name: 'SAM.gov', domain: 'sam.gov', url: 'https://sam.gov/' };
const GRANTS_GOV: AwardSource = { name: 'Grants.gov', domain: 'grants.gov', url: 'https://www.grants.gov/' };

export const GOV_AWARDS: GovAward[] = [
  // --- Australia (first-class, per the brief) ---
  {
    id: 'au-defence-aukus',
    region: 'AU',
    kind: 'contract',
    agency: 'Dept of Defence (Australia)',
    recipient: 'AUKUS advanced-capabilities primes',
    tickers: [],
    theme: 'defence / advanced compute',
    amount: 'A$4.6B',
    date: '2026-06-09',
    summary: 'Pillar II funding for AI, hypersonics and undersea autonomy under the AUKUS program.',
    why: 'AU defence spend pulls demand into AI compute + sensing - read-through for the semis/AI-infra complex.',
    source: AUSTENDER,
  },
  {
    id: 'au-arena-grid',
    region: 'AU',
    kind: 'grant',
    agency: 'ARENA',
    recipient: 'Grid-scale storage + transmission projects',
    tickers: [],
    theme: 'power grid',
    amount: 'A$1.2B',
    date: '2026-06-05',
    summary: 'Renewable firming + transmission grants accelerating the National Electricity Market build-out.',
    why: 'Grid capex is the bottleneck for electrification + datacentre load - watch power-equipment names.',
    source: ARENA,
  },
  {
    id: 'au-critical-minerals',
    region: 'AU',
    kind: 'grant',
    agency: 'AusIndustry / Critical Minerals Facility',
    recipient: 'Rare-earth + lithium processing',
    tickers: [],
    theme: 'critical minerals',
    amount: 'A$840M',
    date: '2026-05-28',
    summary: 'Downstream processing grants to onshore critical-mineral refining capacity.',
    why: 'Critical-mineral supply is upstream of semis, EVs and defence - a genuine supply-chain lever.',
    source: GRANTCONNECT,
  },
  {
    id: 'au-quantum',
    region: 'AU',
    kind: 'grant',
    agency: 'Dept of Industry, Science (AU)',
    recipient: 'National Quantum + AI research',
    tickers: [],
    theme: 'AGI infrastructure',
    amount: 'A$470M',
    date: '2026-05-19',
    summary: 'Sovereign quantum + AI compute capability grants.',
    why: 'Signals AU sovereign-compute intent - tailwind for the global AI-infrastructure narrative.',
    source: DATA_GOV_AU,
  },
  // --- United States ---
  {
    id: 'us-dod-aicompute',
    region: 'US',
    kind: 'contract',
    agency: 'US Dept of Defense',
    recipient: 'AI compute + networking suppliers',
    tickers: ['NVDA', 'AVGO', 'ANET'],
    theme: 'AGI infrastructure',
    amount: '$3.1B',
    date: '2026-06-10',
    summary: 'Multi-year award for AI training clusters + secure datacentre interconnect.',
    why: 'Direct demand into the AI-compute primes - the cleanest official read on defence AI spend.',
    source: USASPENDING,
  },
  {
    id: 'us-doe-nuclear',
    region: 'US',
    kind: 'grant',
    agency: 'US Dept of Energy',
    recipient: 'SMR + grid modernisation programs',
    tickers: [],
    theme: 'nuclear / power grid',
    amount: '$1.9B',
    date: '2026-06-03',
    summary: 'Small modular reactor demonstration + transmission upgrade grants.',
    why: 'Datacentre power demand is forcing nuclear back on the table - watch the nuclear + grid names.',
    source: GRANTS_GOV,
  },
  {
    id: 'us-nasa-space',
    region: 'US',
    kind: 'contract',
    agency: 'NASA',
    recipient: 'Launch + in-space logistics providers',
    tickers: [],
    theme: 'space economy',
    amount: '$2.4B',
    date: '2026-05-30',
    summary: 'Cargo + crewed launch services and in-space refuelling contracts.',
    why: 'Anchors launch-cadence economics - the spillover catalyst behind the space-economy thesis.',
    source: SAM_GOV,
  },
  {
    id: 'us-chips-fab',
    region: 'US',
    kind: 'grant',
    agency: 'US Dept of Commerce (CHIPS)',
    recipient: 'Leading-edge fab + packaging',
    tickers: ['TSM', 'MU', 'AMAT'],
    theme: 'semiconductors',
    amount: '$5.2B',
    date: '2026-05-22',
    summary: 'CHIPS Act disbursement for domestic leading-edge fab + advanced packaging.',
    why: 'Onshoring capex flows straight to equipment + foundry names - a multi-year demand signal.',
    source: GRANTS_GOV,
  },
];

/** Awards sorted newest-first, optionally filtered by region. */
export function listAwards(region?: AwardRegion): GovAward[] {
  const items = region ? GOV_AWARDS.filter((a) => a.region === region) : GOV_AWARDS;
  return [...items].sort((a, b) => b.date.localeCompare(a.date));
}
