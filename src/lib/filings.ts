/**
 * Filings "what changed" - the doc's #1 gap: users want to know what changed in an 8-K,
 * 10-Q or S-1 without reading the whole filing, with the exact supporting passages and
 * freshness. Each entry carries a plain-English "what changed" + sourced excerpts back to
 * EDGAR. Curated illustrative sample (flagged) until the live EDGAR pull wires in. The
 * grounded-copilot discipline applies: show the passage + source + date, never a bare claim.
 */
export type FilingForm = '8-K' | '10-Q' | '10-K' | 'S-1' | '13D';

export interface FilingPassage {
  section: string;
  excerpt: string;
}

export interface Filing {
  id: string;
  symbol: string;
  companyName: string;
  form: FilingForm;
  filedAt: string;
  whatChanged: string;
  passages: FilingPassage[];
  sourceUrl: string;
}

export const FILINGS_SAMPLE = true;
const EDGAR = 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany';

export const FILINGS: Filing[] = [
  {
    id: 'fil-avgo-8k',
    symbol: 'AVGO',
    companyName: 'Broadcom',
    form: '8-K',
    filedAt: '2026-06-11',
    whatChanged: 'Raised FY26 revenue guidance on AI-interconnect demand; new $10B buyback authorised.',
    passages: [
      { section: 'Item 2.02 Results', excerpt: '"...we now expect full-year revenue above the prior range, driven by ultra-high-speed SerDes and custom accelerator demand."' },
      { section: 'Item 8.01 Other', excerpt: '"...the Board authorised the repurchase of up to $10.0 billion of common stock."' },
    ],
    sourceUrl: EDGAR,
  },
  {
    id: 'fil-snow-10q',
    symbol: 'SNOW',
    companyName: 'Snowflake',
    form: '10-Q',
    filedAt: '2026-06-05',
    whatChanged: 'Net revenue retention ticked up; added a going-concern-free liquidity note and raised RPO.',
    passages: [
      { section: 'MD&A', excerpt: '"Net revenue retention rate was 128%, up from 126% in the prior quarter."' },
      { section: 'Note 9 - RPO', excerpt: '"Remaining performance obligations were $5.9 billion, an increase of 31% year over year."' },
    ],
    sourceUrl: EDGAR,
  },
  {
    id: 'fil-openai-s1',
    symbol: '—',
    companyName: 'OpenAI (rumoured)',
    form: 'S-1',
    filedAt: '2026-06-19',
    whatChanged: 'Watch item: an S-1 filing would be the first public financials + use-of-proceeds for the largest AI IPO.',
    passages: [
      { section: 'Status', excerpt: 'No S-1 on EDGAR yet - this row tracks the expected filing so you see it the moment it lands.' },
    ],
    sourceUrl: EDGAR,
  },
  {
    id: 'fil-crwd-8k',
    symbol: 'CRWD',
    companyName: 'CrowdStrike',
    form: '8-K',
    filedAt: '2026-06-02',
    whatChanged: 'Disclosed a new $1B+ federal contract win and reaffirmed net-new ARR guidance.',
    passages: [
      { section: 'Item 1.01 Agreement', excerpt: '"...entered into a multi-year agreement to provide endpoint and identity protection across federal civilian agencies."' },
    ],
    sourceUrl: EDGAR,
  },
  {
    id: 'fil-tsm-6k',
    symbol: 'TSM',
    companyName: 'TSMC',
    form: '10-Q',
    filedAt: '2026-05-28',
    whatChanged: 'Lifted FY capex guidance; advanced-node + advanced-packaging utilisation near full.',
    passages: [
      { section: 'Capex outlook', excerpt: '"Capital expenditures for the year are now expected between $42 and $46 billion, weighted to advanced nodes."' },
    ],
    sourceUrl: EDGAR,
  },
];

export function listFilings(): Filing[] {
  return [...FILINGS].sort((a, b) => b.filedAt.localeCompare(a.filedAt));
}
