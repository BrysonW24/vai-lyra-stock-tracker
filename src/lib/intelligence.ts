/**
 * Intelligence Feed - market and company news augmenting technical signals.
 * Dense ticker-tagged feed with source, sentiment, relevance, hype signals.
 */

export type IntelligenceCategory =
  | 'Earnings'
  | 'Product launch'
  | 'AI announcement'
  | 'Analyst upgrade'
  | 'Analyst downgrade'
  | 'Partnership'
  | 'Regulatory'
  | 'Macro'
  | 'Litigation'
  | 'Guidance'
  | 'M&A';

export type Sentiment = 'positive' | 'neutral' | 'negative';
export type Relevance = 'high' | 'medium' | 'low';
export type HypeImpact = 'rising' | 'steady' | 'cooling';
export type Confidence = 'high' | 'medium' | 'low';

export interface IntelligenceItem {
  id: string;
  tickers: string[];
  sourceType: 'earnings' | 'press_release' | 'analyst' | 'news' | 'sec_filing' | 'industry' | 'macro';
  sourceName: string;
  sourceDomain: string;
  category: IntelligenceCategory;
  headline: string;
  summary: string; // One line
  publishedAt: string; // ISO date
  sentiment: Sentiment;
  relevance: Relevance;
  hypeImpact: HypeImpact;
  confidence: Confidence;
}

export interface TickerHype {
  ticker: string;
  hypeScore: number; // 0-100
  recentCount: number;
  trend: HypeImpact;
}

/**
 * Demo intelligence feed - ~25 items across key tickers.
 * Each item is deterministic; no randomness.
 */
export const demoIntelligenceFeed: IntelligenceItem[] = [
  {
    id: 'intel-001',
    tickers: ['NVDA'],
    sourceType: 'analyst',
    sourceName: 'Goldman Sachs',
    sourceDomain: 'goldmansachs.com',
    category: 'Analyst upgrade',
    headline: 'NVDA raised to conviction buy on H100 demand strength',
    summary: 'Goldman elevates NVDA to conviction buy; datacentre GPU orders at capacity through Q4.',
    publishedAt: '2026-06-03T08:30:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-002',
    tickers: ['NVDA', 'AMD'],
    sourceType: 'news',
    sourceName: 'Reuters',
    sourceDomain: 'reuters.com',
    category: 'AI announcement',
    headline: 'TSMC accelerates HBM3 production for AI chip demand surge',
    summary: 'TSMC commits additional capacity to HBM3; both NVDA and AMD see supply benefits.',
    publishedAt: '2026-06-03T07:15:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-003',
    tickers: ['MSFT'],
    sourceType: 'press_release',
    sourceName: 'Microsoft IR',
    sourceDomain: 'microsoft.com',
    category: 'Product launch',
    headline: 'Copilot Pro enterprise tier launches with custom LLM support',
    summary: 'Microsoft rolls out Copilot Pro for Fortune 500 enterprises; early adoption strong.',
    publishedAt: '2026-06-02T22:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-004',
    tickers: ['SNOW'],
    sourceType: 'earnings',
    sourceName: 'Snowflake Inc.',
    sourceDomain: 'snowflake.com',
    category: 'Earnings',
    headline: 'SNOW Q1 revenue beat; raises FY guidance on AI Analytics adoption',
    summary: 'Snowflake reports 34% YoY growth; AI-powered analytics module driving expansion.',
    publishedAt: '2026-06-02T20:30:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-005',
    tickers: ['PANW'],
    sourceType: 'analyst',
    sourceName: 'Morgan Stanley',
    sourceDomain: 'morganstanley.com',
    category: 'Analyst upgrade',
    headline: 'PANW maintains overweight; AI-driven threat detection market expanding',
    summary: 'Morgan Stanley sees 25% CAGR in security AI; PANW leadership position strengthening.',
    publishedAt: '2026-06-02T14:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'steady',
    confidence: 'high',
  },
  {
    id: 'intel-006',
    tickers: ['CRWD'],
    sourceType: 'news',
    sourceName: 'Bloomberg',
    sourceDomain: 'bloomberg.com',
    category: 'AI announcement',
    headline: 'CrowdStrike unveils real-time adversary intel powered by Claude API',
    summary: 'CRWD integrates Claude to accelerate threat hunting; reduces MTTR by 40%.',
    publishedAt: '2026-06-02T10:45:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-007',
    tickers: ['AVGO'],
    sourceType: 'press_release',
    sourceName: 'Broadcom IR',
    sourceDomain: 'broadcom.com',
    category: 'Guidance',
    headline: 'AVGO raises FY26 guidance on AI datacenter interconnect strength',
    summary: 'Broadcom lifts revenue guidance $500M+ driven by ultra-high-speed SerDes demand.',
    publishedAt: '2026-06-02T09:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-008',
    tickers: ['AMD'],
    sourceType: 'earnings',
    sourceName: 'AMD Inc.',
    sourceDomain: 'amd.com',
    category: 'Earnings',
    headline: 'AMD Q1 data centre CPUs exceed expectations; EPYC adoption accelerating',
    summary: 'AMD reports 35% YoY server CPU growth; EPYC market share gains vs. Intel steady.',
    publishedAt: '2026-06-01T21:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'steady',
    confidence: 'high',
  },
  {
    id: 'intel-009',
    tickers: ['CRM'],
    sourceType: 'analyst',
    sourceName: 'Barclays',
    sourceDomain: 'barclays.com',
    category: 'Analyst downgrade',
    headline: 'CRM downgraded to equal weight on valuation concerns post-rally',
    summary: 'Barclays cuts CRM rating; stock has priced in Slack momentum already.',
    publishedAt: '2026-06-01T14:30:00Z',
    sentiment: 'negative',
    relevance: 'medium',
    hypeImpact: 'cooling',
    confidence: 'medium',
  },
  {
    id: 'intel-010',
    tickers: ['GOOGL'],
    sourceType: 'news',
    sourceName: 'CNBC',
    sourceDomain: 'cnbc.com',
    category: 'Regulatory',
    headline: 'DOJ antitrust trial witness testimony weakens Google defence position',
    summary: 'Competitive pressures from Perplexity and OpenAI cited; search market share debate continues.',
    publishedAt: '2026-06-01T12:00:00Z',
    sentiment: 'negative',
    relevance: 'medium',
    hypeImpact: 'steady',
    confidence: 'high',
  },
  {
    id: 'intel-011',
    tickers: ['MSFT', 'GOOGL'],
    sourceType: 'macro',
    sourceName: 'Federal Reserve',
    sourceDomain: 'federalreserve.gov',
    category: 'Macro',
    headline: 'Fed signals pauses rate hikes; tech valuations stabilising',
    summary: 'Powell commentary supports extended pause in rate hikes; benefits high-growth tech.',
    publishedAt: '2026-06-01T10:15:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-012',
    tickers: ['NOW'],
    sourceType: 'earnings',
    sourceName: 'ServiceNow Inc.',
    sourceDomain: 'servicenow.com',
    category: 'Earnings',
    headline: 'NOW Q1 RPO grows 19% YoY; AI workflow automation accelerating customer expansion',
    summary: 'ServiceNow sees strong ACV expansion in AI vertical; guidance slightly raised.',
    publishedAt: '2026-05-31T20:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-013',
    tickers: ['DDOG'],
    sourceType: 'analyst',
    sourceName: 'Oppenheimer',
    sourceDomain: 'oppenheimer.com',
    category: 'Analyst upgrade',
    headline: 'DDOG outperform maintained; observability moat widening vs. peers',
    summary: 'Oppenheimer confident Datadog edge in LLM/AI workload monitoring grows margins.',
    publishedAt: '2026-05-31T16:45:00Z',
    sentiment: 'positive',
    relevance: 'medium',
    hypeImpact: 'steady',
    confidence: 'medium',
  },
  {
    id: 'intel-014',
    tickers: ['ADBE'],
    sourceType: 'news',
    sourceName: 'The Verge',
    sourceDomain: 'theverge.com',
    category: 'Product launch',
    headline: 'Adobe Firefly 3.0 gen-fill feature beats Midjourney in user testing',
    summary: 'User preference survey shows Adobe catching up in generative quality; Creative Cloud stickiness rising.',
    publishedAt: '2026-05-31T11:30:00Z',
    sentiment: 'positive',
    relevance: 'medium',
    hypeImpact: 'rising',
    confidence: 'medium',
  },
  {
    id: 'intel-015',
    tickers: ['PANW', 'CRWD'],
    sourceType: 'industry',
    sourceName: 'Gartner',
    sourceDomain: 'gartner.com',
    category: 'AI announcement',
    headline: 'Gartner: PANW, CRWD among top 3 in AI-powered security magic quadrant',
    summary: 'Both leaders recognised for threat detection AI; market consolidating around feature-rich platforms.',
    publishedAt: '2026-05-31T09:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'steady',
    confidence: 'high',
  },
  {
    id: 'intel-016',
    tickers: ['NVDA'],
    sourceType: 'macro',
    sourceName: 'Semicon News',
    sourceDomain: 'semiconductorengineering.com',
    category: 'Macro',
    headline: 'Taiwan production capacity hits record; NVDA/TSMC extended partnership signals confidence',
    summary: 'TSMC double-shifts N3; NVIDIA contract commitments through 2027 announced.',
    publishedAt: '2026-05-30T15:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-017',
    tickers: ['SNOW', 'DDOG'],
    sourceType: 'news',
    sourceName: 'Forbes',
    sourceDomain: 'forbes.com',
    category: 'Partnership',
    headline: 'Snowflake and Datadog integrate; customers can monitor SNOW workloads natively',
    summary: 'New partnership deepens integration; benefits both platforms in enterprise stickiness.',
    publishedAt: '2026-05-30T12:30:00Z',
    sentiment: 'positive',
    relevance: 'medium',
    hypeImpact: 'steady',
    confidence: 'medium',
  },
  {
    id: 'intel-018',
    tickers: ['CRM'],
    sourceType: 'sec_filing',
    sourceName: 'SEC (8-K)',
    sourceDomain: 'sec.gov',
    category: 'M&A',
    headline: 'Salesforce acquires workflow automation startup Mindy; $200M+ deal',
    summary: 'CRM expands AI workflow capabilities; Mindy founders join AI chief office.',
    publishedAt: '2026-05-30T08:00:00Z',
    sentiment: 'positive',
    relevance: 'medium',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-019',
    tickers: ['GOOGL'],
    sourceType: 'press_release',
    sourceName: 'Google AI',
    sourceDomain: 'google.com',
    category: 'AI announcement',
    headline: 'Google Gemini 2.0 API now public; enterprise adoption accelerating',
    summary: 'Gemini API open to all developers; billions in inference volume expected by Q4.',
    publishedAt: '2026-05-29T20:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-020',
    tickers: ['MSFT'],
    sourceType: 'analyst',
    sourceName: 'Wedbush',
    sourceDomain: 'wedbush.com',
    category: 'Analyst upgrade',
    headline: 'MSFT price target raised to $475 on Copilot monetisation runway',
    summary: 'Wedbush confident MSFT can extract premium pricing as CoPilot adoption widens.',
    publishedAt: '2026-05-29T14:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-021',
    tickers: ['AMD'],
    sourceType: 'news',
    sourceName: 'TechCrunch',
    sourceDomain: 'techcrunch.com',
    category: 'Product launch',
    headline: 'AMD Ryzen AI 300-series mobile chips beat expected specs; OEM pre-orders strong',
    summary: 'New Ryzen AI chips show 15% perf boost vs. Qualcomm; Dell, Lenovo confirm orders.',
    publishedAt: '2026-05-29T10:45:00Z',
    sentiment: 'positive',
    relevance: 'medium',
    hypeImpact: 'rising',
    confidence: 'medium',
  },
  {
    id: 'intel-022',
    tickers: ['AVGO'],
    sourceType: 'analyst',
    sourceName: 'Citi',
    sourceDomain: 'citi.com',
    category: 'Analyst upgrade',
    headline: 'AVGO buy rating reaffirmed; AI interconnect TAM expanding faster than expected',
    summary: 'Citi raises TAM estimate to $50B by 2030; AVGO position strengthening.',
    publishedAt: '2026-05-28T13:15:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-023',
    tickers: ['PANW'],
    sourceType: 'news',
    sourceName: 'SecurityWeek',
    sourceDomain: 'securityweek.com',
    category: 'Litigation',
    headline: 'PANW settles data breach class-action for $49M; no admission of wrongdoing',
    summary: 'Settlement covers 2023 supply chain incident; reputational risk contained.',
    publishedAt: '2026-05-28T11:00:00Z',
    sentiment: 'neutral',
    relevance: 'medium',
    hypeImpact: 'cooling',
    confidence: 'high',
  },
  {
    id: 'intel-024',
    tickers: ['NOW'],
    sourceType: 'analyst',
    sourceName: 'Evercore',
    sourceDomain: 'evercoreisI.com',
    category: 'Analyst upgrade',
    headline: 'NOW stock: Evercore upgrades to outperform on workflow AI momentum',
    summary: 'Evercore sees now as best-in-class SaaS workflow platform; raises PT to $310.',
    publishedAt: '2026-05-27T15:30:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'rising',
    confidence: 'high',
  },
  {
    id: 'intel-025',
    tickers: ['CRWD'],
    sourceType: 'news',
    sourceName: 'Wall Street Journal',
    sourceDomain: 'wsj.com',
    category: 'Guidance',
    headline: 'CrowdStrike expects record Q2 as enterprise shifts to modern EDR architecture',
    summary: 'CRWD CFO guidance raises confidence in sustained 40%+ growth rate.',
    publishedAt: '2026-05-27T09:00:00Z',
    sentiment: 'positive',
    relevance: 'high',
    hypeImpact: 'steady',
    confidence: 'high',
  },
];

/**
 * ILLUSTRATIVE sample hype scores for the demo feed - authored, hand-picked literals, NOT
 * a live measurement. The live worker (workers/intelligence_worker/hype_engine.py) computes
 * the real number as high-relevance item count x sentiment x recency and persists it to the
 * hype_scores table; intelligence-live.ts reads that. These demo values only appear behind
 * the "illustrative sample" banner so they are never presented as a computed signal.
 */
export const demoTickerHypeMap: Record<string, TickerHype> = {
  NVDA: { ticker: 'NVDA', hypeScore: 92, recentCount: 3, trend: 'rising' },
  AMD: { ticker: 'AMD', hypeScore: 78, recentCount: 3, trend: 'steady' },
  MSFT: { ticker: 'MSFT', hypeScore: 85, recentCount: 3, trend: 'rising' },
  GOOGL: { ticker: 'GOOGL', hypeScore: 62, recentCount: 2, trend: 'steady' },
  SNOW: { ticker: 'SNOW', hypeScore: 75, recentCount: 2, trend: 'rising' },
  CRWD: { ticker: 'CRWD', hypeScore: 88, recentCount: 3, trend: 'steady' },
  PANW: { ticker: 'PANW', hypeScore: 81, recentCount: 3, trend: 'steady' },
  AVGO: { ticker: 'AVGO', hypeScore: 76, recentCount: 2, trend: 'rising' },
  CRM: { ticker: 'CRM', hypeScore: 54, recentCount: 2, trend: 'cooling' },
  NOW: { ticker: 'NOW', hypeScore: 72, recentCount: 2, trend: 'rising' },
  DDOG: { ticker: 'DDOG', hypeScore: 68, recentCount: 2, trend: 'steady' },
  ADBE: { ticker: 'ADBE', hypeScore: 58, recentCount: 1, trend: 'rising' },
};

/**
 * Sort feed by relevance and recency.
 */
export function sortIntelligenceFeed(items: IntelligenceItem[]): IntelligenceItem[] {
  const relevanceOrder: Record<Relevance, number> = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => {
    const relevanceDiff = relevanceOrder[a.relevance] - relevanceOrder[b.relevance];
    if (relevanceDiff !== 0) return relevanceDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

/**
 * Filter feed by criteria.
 */
export function filterIntelligenceFeed(
  items: IntelligenceItem[],
  filters: {
    ticker?: string;
    category?: IntelligenceCategory;
    sentiment?: Sentiment;
    relevance?: Relevance;
  },
): IntelligenceItem[] {
  return items.filter((item) => {
    if (filters.ticker && !item.tickers.includes(filters.ticker)) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.sentiment && item.sentiment !== filters.sentiment) return false;
    if (filters.relevance && item.relevance !== filters.relevance) return false;
    return true;
  });
}
