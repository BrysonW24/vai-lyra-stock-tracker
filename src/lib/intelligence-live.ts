/**
 * Server-side intelligence reads: the Supabase `news_items` + `ticker_news_map` +
 * `hype_scores` tables (filled nightly by workers/intelligence_worker, LIVE providers
 * only) with the bundled demo feed as fallback. Same contract as calendar-live.ts and
 * kept out of intelligence.ts so that module stays importable from client components.
 *
 * Fallback contract: unconfigured, empty tables, or any error degrades to the demo feed
 * with source 'sample' - never a throw to the page. Crucially the intelligence worker only
 * persists when its provider is LIVE (workers/intelligence_worker/main.py is_live gate), so
 * a deployment with no FINNHUB_API_KEY has empty tables and honestly renders 'sample'
 * rather than surfacing fabricated demo rows as real market news.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  demoIntelligenceFeed,
  demoTickerHypeMap,
  type Confidence,
  type HypeImpact,
  type IntelligenceCategory,
  type IntelligenceItem,
  type Relevance,
  type Sentiment,
  type TickerHype,
} from '@/lib/intelligence';

export interface IntelligenceDataset {
  feed: IntelligenceItem[];
  hypeMap: Record<string, TickerHype>;
  /** 'live' = rows from the nightly sync; 'sample' = bundled illustrative demo feed. */
  source: 'live' | 'sample';
  updatedAt: string | null;
}

const SAMPLE: () => IntelligenceDataset = () => ({
  feed: demoIntelligenceFeed,
  hypeMap: demoTickerHypeMap,
  source: 'sample',
  updatedAt: null,
});

const CATEGORIES: ReadonlySet<string> = new Set<IntelligenceCategory>([
  'Earnings', 'Product launch', 'AI announcement', 'Analyst upgrade', 'Analyst downgrade',
  'Partnership', 'Regulatory', 'Macro', 'Litigation', 'Guidance', 'M&A',
]);
const SENTIMENTS: ReadonlySet<string> = new Set<Sentiment>(['positive', 'neutral', 'negative']);
const RELEVANCES: ReadonlySet<string> = new Set<Relevance>(['high', 'medium', 'low']);
const HYPE_TRENDS: ReadonlySet<string> = new Set<HypeImpact>(['rising', 'steady', 'cooling']);

function asCategory(raw: unknown): IntelligenceCategory {
  return typeof raw === 'string' && CATEGORIES.has(raw) ? (raw as IntelligenceCategory) : 'Macro';
}
function asSentiment(raw: unknown): Sentiment {
  return typeof raw === 'string' && SENTIMENTS.has(raw) ? (raw as Sentiment) : 'neutral';
}
function asRelevance(raw: unknown): Relevance {
  return typeof raw === 'string' && RELEVANCES.has(raw) ? (raw as Relevance) : 'medium';
}
function asTrend(raw: unknown): HypeImpact {
  return typeof raw === 'string' && HYPE_TRENDS.has(raw) ? (raw as HypeImpact) : 'steady';
}

/** Derive a source type from the stored category (the worker does not store one). */
function sourceTypeFor(category: IntelligenceCategory): IntelligenceItem['sourceType'] {
  switch (category) {
    case 'Earnings':
    case 'Guidance':
      return 'earnings';
    case 'Analyst upgrade':
    case 'Analyst downgrade':
      return 'analyst';
    case 'Product launch':
    case 'AI announcement':
      return 'press_release';
    case 'Regulatory':
    case 'Litigation':
    case 'M&A':
      return 'sec_filing';
    case 'Macro':
      return 'macro';
    default:
      return 'news';
  }
}

interface NewsRow {
  headline?: string | null;
  summary?: string | null;
  source?: string | null;
  source_domain?: string | null;
  category?: string | null;
  published_at?: string | null;
  sentiment?: string | null;
  relevance?: string | null;
  updated_at?: string | null;
}

interface TickerMapRow {
  ticker?: string | null;
  headline?: string | null;
  source?: string | null;
}

interface HypeRow {
  ticker?: string | null;
  hype_score?: number | string | null;
  recent_count?: number | string | null;
  trend?: string | null;
  computed_at?: string | null;
}

function slugId(headline: string, source: string): string {
  return `live-${(source + '-' + headline).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`;
}

/**
 * All intelligence for the feed: live tables when configured + populated, bundled demo
 * feed otherwise. Rows with no ticker mapping are dropped (the feed is ticker-tagged); if
 * nothing maps, the whole dataset degrades to the demo sample.
 */
export async function getIntelligenceLive(): Promise<IntelligenceDataset> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return SAMPLE();

  try {
    const [news, map, hype] = await Promise.all([
      supabase.from('news_items').select('*').order('published_at', { ascending: false }).limit(120),
      supabase.from('ticker_news_map').select('ticker, headline, source').limit(600),
      supabase.from('hype_scores').select('ticker, hype_score, recent_count, trend, computed_at').order('hype_score', { ascending: false }).limit(50),
    ]);
    if (news.error) return SAMPLE();

    const newsRows = (news.data ?? []) as NewsRow[];
    if (newsRows.length === 0) return SAMPLE();

    // headline+source -> tickers
    const tickersByKey = new Map<string, string[]>();
    if (!map.error) {
      for (const row of (map.data ?? []) as TickerMapRow[]) {
        if (!row.ticker || !row.headline || !row.source) continue;
        const key = `${row.headline}::${row.source}`;
        const list = tickersByKey.get(key) ?? [];
        if (!list.includes(row.ticker)) list.push(row.ticker);
        tickersByKey.set(key, list);
      }
    }

    const hypeMap: Record<string, TickerHype> = {};
    if (!hype.error) {
      for (const row of (hype.data ?? []) as HypeRow[]) {
        if (!row.ticker) continue;
        hypeMap[row.ticker] = {
          ticker: row.ticker,
          hypeScore: Math.round(Number(row.hype_score ?? 0)),
          recentCount: Math.round(Number(row.recent_count ?? 0)),
          trend: asTrend(row.trend),
        };
      }
    }

    const feed: IntelligenceItem[] = [];
    for (const row of newsRows) {
      if (!row.headline || !row.source || !row.published_at) continue;
      const tickers = tickersByKey.get(`${row.headline}::${row.source}`) ?? [];
      if (tickers.length === 0) continue; // ticker-tagged feed: skip unmapped rows
      const category = asCategory(row.category);
      feed.push({
        id: slugId(row.headline, row.source),
        tickers,
        sourceType: sourceTypeFor(category),
        sourceName: row.source,
        sourceDomain: row.source_domain || `${row.source.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
        category,
        headline: row.headline,
        summary: row.summary || row.headline,
        publishedAt: row.published_at,
        sentiment: asSentiment(row.sentiment),
        relevance: asRelevance(row.relevance),
        hypeImpact: hypeMap[tickers[0]]?.trend ?? 'steady',
        confidence: 'medium' as Confidence,
      });
    }

    if (feed.length === 0) return SAMPLE();

    const updatedAt =
      [...newsRows.map((r) => r.updated_at ?? ''), ...(hype.error ? [] : ((hype.data ?? []) as HypeRow[]).map((r) => r.computed_at ?? ''))]
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    return {
      feed,
      hypeMap: Object.keys(hypeMap).length > 0 ? hypeMap : demoTickerHypeMap,
      source: 'live',
      updatedAt,
    };
  } catch {
    return SAMPLE();
  }
}
