/**
 * Transcript evidence stacks - earnings-call passages with the exact quote, speaker, topic
 * and freshness, not an abstract AI summary. The doc: users do not trust surface-level
 * answers; they want the supporting passage + source. Curated illustrative sample (flagged)
 * until the live transcript feed wires in. Research context, never advice.
 */
export type PassageSentiment = 'positive' | 'neutral' | 'negative';

export interface TranscriptPassage {
  id: string;
  symbol: string;
  companyName: string;
  quarter: string;
  speaker: string;
  role: string;
  topic: string;
  quote: string;
  sentiment: PassageSentiment;
  date: string;
  sourceUrl: string;
}

export const TRANSCRIPTS_SAMPLE = true;

export const TRANSCRIPT_PASSAGES: TranscriptPassage[] = [
  {
    id: 'tr-avgo-ai',
    symbol: 'AVGO',
    companyName: 'Broadcom',
    quarter: 'Q2 FY26',
    speaker: 'CEO',
    role: 'Chief Executive',
    topic: 'AI revenue',
    quote: '"AI revenue is now tracking ahead of our prior outlook, and we see custom-accelerator demand extending through next year."',
    sentiment: 'positive',
    date: '2026-06-11',
    sourceUrl: 'https://investors.broadcom.com/',
  },
  {
    id: 'tr-nvda-supply',
    symbol: 'NVDA',
    companyName: 'Nvidia',
    quarter: 'Q1 FY27',
    speaker: 'CFO',
    role: 'Chief Financial Officer',
    topic: 'Supply / lead times',
    quote: '"Supply visibility has improved, but advanced packaging remains the gating constraint into the second half."',
    sentiment: 'neutral',
    date: '2026-06-05',
    sourceUrl: 'https://investor.nvidia.com/',
  },
  {
    id: 'tr-snow-nrr',
    symbol: 'SNOW',
    companyName: 'Snowflake',
    quarter: 'Q1 FY27',
    speaker: 'CEO',
    role: 'Chief Executive',
    topic: 'Consumption trends',
    quote: '"Consumption re-accelerated through the quarter as customers moved more AI workloads onto the platform."',
    sentiment: 'positive',
    date: '2026-06-05',
    sourceUrl: 'https://investors.snowflake.com/',
  },
  {
    id: 'tr-amd-mi',
    symbol: 'AMD',
    companyName: 'Advanced Micro Devices',
    quarter: 'Q1 2026',
    speaker: 'CEO',
    role: 'Chief Executive',
    topic: 'Data-centre GPU',
    quote: '"Data-centre GPU revenue exceeded expectations; we are raising our full-year outlook for the segment."',
    sentiment: 'positive',
    date: '2026-06-04',
    sourceUrl: 'https://ir.amd.com/',
  },
  {
    id: 'tr-crm-margin',
    symbol: 'CRM',
    companyName: 'Salesforce',
    quarter: 'Q1 FY27',
    speaker: 'CFO',
    role: 'Chief Financial Officer',
    topic: 'Margins / guidance',
    quote: '"We are prioritising disciplined growth; operating margin guidance moves up, but bookings were softer than planned."',
    sentiment: 'neutral',
    date: '2026-05-29',
    sourceUrl: 'https://investor.salesforce.com/',
  },
];

export function listTranscripts(): TranscriptPassage[] {
  return [...TRANSCRIPT_PASSAGES].sort((a, b) => b.date.localeCompare(a.date));
}
