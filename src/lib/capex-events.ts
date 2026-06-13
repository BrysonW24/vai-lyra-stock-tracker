/**
 * Capex / physical-expansion tracker - early visibility into factory builds, datacentre
 * expansion, procurement and hiring before it shows up in earnings headlines. The doc
 * flags this as a "Highest priority" gap because the clues are scattered across filings,
 * transcripts, project announcements and permits. Curated illustrative sample (flagged)
 * until live filings/permits/procurement feeds wire in. Research context, never advice.
 */
export type CapexKind = 'fab' | 'datacenter' | 'plant' | 'procurement' | 'hiring' | 'expansion';

export interface CapexEvent {
  id: string;
  recipient: string;
  tickers: string[];
  theme: string;
  kind: CapexKind;
  amount: string;
  location: string;
  date: string;
  summary: string;
  why: string;
  source: string;
  sourceUrl: string;
}

export const CAPEX_SAMPLE = true;

export const KIND_LABEL: Record<CapexKind, string> = {
  fab: 'Fab build',
  datacenter: 'Datacentre',
  plant: 'Plant',
  procurement: 'Procurement',
  hiring: 'Hiring',
  expansion: 'Expansion',
};

export const CAPEX_EVENTS: CapexEvent[] = [
  {
    id: 'capex-tsm-az',
    recipient: 'TSMC Arizona',
    tickers: ['TSM', 'AMAT', 'LRCX'],
    theme: 'semiconductors',
    kind: 'fab',
    amount: '$12B',
    location: 'Phoenix, AZ',
    date: '2026-06-10',
    summary: 'Phase-3 leading-edge fab break-ground; 2nm capacity from 2028.',
    why: 'Fab capex flows to equipment names years before the revenue shows - an early demand signal.',
    source: 'Company release',
    sourceUrl: 'https://pr.tsmc.com/',
  },
  {
    id: 'capex-dc-hyperscale',
    recipient: 'Hyperscaler AI campus',
    tickers: ['NVDA', 'AVGO', 'VRT', 'ANET'],
    theme: 'AGI infrastructure',
    kind: 'datacenter',
    amount: '$8B',
    location: 'Ohio, US',
    date: '2026-06-07',
    summary: 'Multi-GW AI datacentre campus; power + cooling + interconnect procurement underway.',
    why: 'Datacentre buildout pulls compute, networking, power equipment and cooling together - a whole-chain catalyst.',
    source: 'Permit filing',
    sourceUrl: 'https://www.usaspending.gov/',
  },
  {
    id: 'capex-au-gigafactory',
    recipient: 'AU critical-minerals refinery',
    tickers: [],
    theme: 'critical minerals',
    kind: 'plant',
    amount: 'A$1.1B',
    location: 'Western Australia',
    date: '2026-06-03',
    summary: 'Downstream rare-earth separation plant; first output targeted 2027.',
    why: 'Onshoring midstream processing is the bottleneck for magnets, EVs and defence supply.',
    source: 'AusTender',
    sourceUrl: 'https://www.tenders.gov.au/',
  },
  {
    id: 'capex-power-grid',
    recipient: 'Grid + transformer capacity',
    tickers: ['VRT'],
    theme: 'power grid',
    kind: 'procurement',
    amount: '$2.3B',
    location: 'Texas, US',
    date: '2026-05-29',
    summary: 'Large transformer + switchgear procurement to serve new datacentre load.',
    why: 'Transformers are a hard physical bottleneck - lead times gate the whole AI-power buildout.',
    source: 'Procurement notice',
    sourceUrl: 'https://sam.gov/',
  },
  {
    id: 'capex-smr-hiring',
    recipient: 'SMR developer',
    tickers: [],
    theme: 'nuclear',
    kind: 'hiring',
    amount: '+1,200 roles',
    location: 'US (multi-site)',
    date: '2026-05-24',
    summary: 'Step-up in engineering + construction hiring ahead of first SMR deployment.',
    why: 'Hiring surges are an early, hard-to-fake tell that a capex cycle is actually executing.',
    source: 'Company release',
    sourceUrl: 'https://www.energy.gov/',
  },
  {
    id: 'capex-avgo-capacity',
    recipient: 'Broadcom (AVGO)',
    tickers: ['AVGO'],
    theme: 'AGI infrastructure',
    kind: 'expansion',
    amount: '$1.5B',
    location: 'Global',
    date: '2026-05-20',
    summary: 'Capacity expansion for custom AI accelerators + high-speed interconnect.',
    why: 'Capacity adds at AVGO read straight through to hyperscaler AI demand - the group bellwether.',
    source: 'Earnings call',
    sourceUrl: 'https://investors.broadcom.com/',
  },
];

/** Newest first. */
export function listCapex(): CapexEvent[] {
  return [...CAPEX_EVENTS].sort((a, b) => b.date.localeCompare(a.date));
}
