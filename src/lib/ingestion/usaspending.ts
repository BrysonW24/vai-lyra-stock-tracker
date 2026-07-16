/**
 * Live government-award ingestion from USAspending.gov - the free, KEYLESS federal spending API. This
 * is the continuous-fetch proof for the flagship thesis ("invest early where government + big tech
 * put money"): instead of a hand-curated sample, it pulls real federal contract awards for the
 * narrow small-cap watchlist and normalises them into the GovAward shape the signal-intelligence
 * layer already reasons over.
 *
 * Design for a serverless, always-on host (Vercel + cron): every call is CACHED (default 6h - federal
 * award data is slow-moving), each attempt is time-bounded and RETRIED on transient failure, and the
 * whole thing DEGRADES SAFELY - any error or empty result returns no live awards, and the caller
 * (resolveGovAwards) falls back to the curated sample. Nothing here is on the request hot path
 * without the cache in front of it. Research context, never advice.
 */
import { withRetry } from '@/lib/ai/resilience';
import { cached } from '@/lib/cache';
import { getSmallCapCompanies } from '@/lib/world-radar';
import { GOV_AWARDS, type GovAward } from '@/lib/gov-awards';

const USASPENDING_ENDPOINT = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
const USASPENDING_SOURCE = { name: 'USAspending', domain: 'usaspending.gov', url: 'https://www.usaspending.gov/' } as const;

/** Procurement contract award-type codes (definitive/purchase orders). The strongest "govt is buying" signal. */
const CONTRACT_AWARD_TYPES = ['A', 'B', 'C', 'D'] as const;

/** A watchlist recipient: the ticker, the recipient search term, and the theme it feeds. */
export interface WatchlistRecipient {
  symbol: string;
  /** Fuzzy recipient search text sent to USAspending (its legal name need not be exact). */
  recipient: string;
  theme: string;
}

/**
 * The NARROW flagship watchlist - the small caps whose emerging-market thesis is most driven by
 * official spend. Derived from the small/micro-cap roster so it stays in lockstep with the universe.
 */
export function usaspendingWatchlist(): WatchlistRecipient[] {
  return getSmallCapCompanies().map((c) => ({ symbol: c.symbol, recipient: c.name, theme: c.theme }));
}

/** The subset of the USAspending `spending_by_award` result row we consume. */
interface UsaspendingRow {
  'Award ID'?: string;
  'Recipient Name'?: string;
  'Awarding Agency'?: string;
  'Award Amount'?: number;
  'Start Date'?: string;
  'Description'?: string;
  'Award Type'?: string;
  generated_internal_id?: string;
}

interface UsaspendingResponse {
  results?: UsaspendingRow[];
}

/** Injectable fetch so the client is testable against a captured fixture with no network. */
export type FetchImpl = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface FetchAwardsOptions {
  fetchImpl?: FetchImpl;
  /** Look-back window in days (default ~2 years - award data is slow-moving). */
  lookbackDays?: number;
  /** Max awards per recipient (default 3, newest/biggest first). */
  limit?: number;
  /** Per-attempt timeout in ms (default 8000). */
  timeoutMs?: number;
  /** Injectable clock for deterministic time_period windows (default Date.now via new Date). */
  now?: Date;
  /** Injectable retry backoff sleep (default real setTimeout) - lets tests run the retry path instantly. */
  retrySleep?: (ms: number) => Promise<void>;
}

/** Format a USD amount as a compact "$1.2B" / "$340M" / "$4.5K" string. */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '$0';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount)}`;
}

/** ISO date (YYYY-MM-DD) from a Date, without pulling in a tz library. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Normalise one USAspending award row into a GovAward. Pure and total - a row missing fields yields
 * best-effort defaults, and the ticker is stamped from the watchlist entry that produced the query.
 */
export function normaliseAward(row: UsaspendingRow, entry: WatchlistRecipient): GovAward {
  const awardId = row['Award ID'] || row.generated_internal_id || `${entry.symbol}-unknown`;
  const amount = typeof row['Award Amount'] === 'number' ? row['Award Amount'] : 0;
  const agency = row['Awarding Agency']?.trim() || 'US Federal (awarding agency n/a)';
  const recipient = row['Recipient Name']?.trim() || entry.recipient;
  const date = (row['Start Date'] || '').slice(0, 10) || isoDate(new Date(0));
  const description = row['Description']?.trim() || `${agency} contract award to ${recipient}.`;
  return {
    id: `usa-${entry.symbol}-${awardId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    region: 'US',
    kind: 'contract',
    agency,
    recipient,
    tickers: [entry.symbol],
    theme: entry.theme,
    amount: formatUsd(amount),
    date,
    summary: description.length > 240 ? `${description.slice(0, 237)}...` : description,
    why: `Federal contract naming ${recipient} - official demand is an early, pre-consensus read on the ${entry.theme} thesis.`,
    source: { ...USASPENDING_SOURCE },
  };
}

/**
 * Fetch the top federal CONTRACT awards for one watchlist recipient. Time-bounded + retried on a
 * transient failure; returns [] on a permanent error, an HTTP error, or no results (the caller then
 * falls back to the sample for that ticker). Never throws.
 */
export async function fetchAwardsForRecipient(entry: WatchlistRecipient, options: FetchAwardsOptions = {}): Promise<GovAward[]> {
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init) as unknown as ReturnType<FetchImpl>);
  const lookbackDays = options.lookbackDays ?? 730;
  const limit = options.limit ?? 3;
  const timeoutMs = options.timeoutMs ?? 8000;
  const now = options.now ?? new Date();
  const start = new Date(now.getTime() - lookbackDays * 86_400_000);

  const body = {
    filters: {
      recipient_search_text: [entry.recipient],
      award_type_codes: [...CONTRACT_AWARD_TYPES],
      time_period: [{ start_date: isoDate(start), end_date: isoDate(now) }],
    },
    fields: ['Award ID', 'Recipient Name', 'Awarding Agency', 'Award Amount', 'Start Date', 'Description', 'Award Type'],
    page: 1,
    limit,
    sort: 'Award Amount',
    order: 'desc',
  };

  try {
    const data = await withRetry(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetchImpl(USASPENDING_ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`usaspending ${res.status}`);
          return (await res.json()) as UsaspendingResponse;
        } finally {
          clearTimeout(timer);
        }
      },
      { policy: { maxAttempts: 3, baseDelayMs: 300, maxDelayMs: 2000 }, ...(options.retrySleep ? { sleep: options.retrySleep } : {}) },
    );
    const rows = Array.isArray(data.results) ? data.results : [];
    return rows.filter((r) => (r['Award Amount'] ?? 0) > 0).map((r) => normaliseAward(r, entry));
  } catch {
    return [];
  }
}

export interface LiveGovAwards {
  awards: GovAward[];
  fetchedAt: string;
  recipientsQueried: number;
  recipientsWithAwards: number;
}

/**
 * Fetch live contract awards across the whole watchlist. Recipients are queried with small bounded
 * concurrency so one slow request cannot stall the batch and the batch cannot fan out unbounded.
 * Never throws - a fully-failed batch just returns an empty award list.
 */
export async function fetchLiveGovAwardsUncached(options: FetchAwardsOptions = {}): Promise<LiveGovAwards> {
  const watchlist = usaspendingWatchlist();
  const now = options.now ?? new Date();
  const CONCURRENCY = 4;
  const awards: GovAward[] = [];
  let recipientsWithAwards = 0;

  for (let i = 0; i < watchlist.length; i += CONCURRENCY) {
    const batch = watchlist.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((entry) => fetchAwardsForRecipient(entry, options)));
    for (const recipientAwards of results) {
      if (recipientAwards.length > 0) recipientsWithAwards += 1;
      awards.push(...recipientAwards);
    }
  }

  return {
    awards: awards.sort((a, b) => b.date.localeCompare(a.date)),
    fetchedAt: now.toISOString(),
    recipientsQueried: watchlist.length,
    recipientsWithAwards,
  };
}

/** TTL for the cached live pull. Federal award data is slow-moving; 6h keeps it fresh and cheap. */
export const GOV_AWARDS_CACHE_TTL_SECONDS = 6 * 60 * 60;

/**
 * Cached live pull (the serverless-native "continuous fetch"): the first request in each 6h window
 * hits USAspending, the rest are served from cache. `cached()` degrades to a miss on any cache-layer
 * error, and the fetch itself degrades to an empty list, so this never throws on the request path.
 */
export async function fetchLiveGovAwards(options: FetchAwardsOptions = {}): Promise<LiveGovAwards> {
  // With an injected fetchImpl (tests) skip the cache entirely for determinism.
  if (options.fetchImpl) return fetchLiveGovAwardsUncached(options);
  return cached('ingestion:gov-awards:usaspending:v1', GOV_AWARDS_CACHE_TTL_SECONDS, () => fetchLiveGovAwardsUncached(options));
}

/**
 * Merge live awards over the curated sample: live awards win, and a sample award is kept only when
 * no live award already covers one of its tickers (so a ticker with real federal data is never
 * shown alongside its illustrative placeholder). Pure and deterministic.
 */
export function mergeAwards(live: GovAward[], sample: GovAward[]): GovAward[] {
  const liveTickers = new Set(live.flatMap((a) => a.tickers));
  const keptSample = sample.filter((a) => a.tickers.length === 0 || !a.tickers.some((t) => liveTickers.has(t)));
  const seen = new Set<string>();
  return [...live, ...keptSample].filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

export type GovAwardsProvenance = 'live' | 'sample' | 'mixed';

export interface ResolvedGovAwards {
  awards: GovAward[];
  /** 'live' when every returned award is from USAspending, 'sample' when none are, else 'mixed'. */
  source: GovAwardsProvenance;
  fetchedAt: string;
  liveAwardCount: number;
  recipientsQueried: number;
  recipientsWithAwards: number;
}

/**
 * The one call a route/UI makes: live USAspending awards merged over the curated sample, with
 * explicit provenance so the surface can DISCLOSE staleness (sample vs live) rather than present
 * placeholders as current. Fully degrades - if the live pull returns nothing, this is the sample set
 * with source 'sample'. Never throws.
 */
export async function resolveGovAwards(options: FetchAwardsOptions = {}): Promise<ResolvedGovAwards> {
  const live = await fetchLiveGovAwards(options);
  const merged = mergeAwards(live.awards, GOV_AWARDS);
  const liveAwardCount = live.awards.length;
  const source: GovAwardsProvenance =
    liveAwardCount === 0 ? 'sample' : merged.length === liveAwardCount ? 'live' : 'mixed';
  return {
    awards: merged,
    source,
    fetchedAt: live.fetchedAt,
    liveAwardCount,
    recipientsQueried: live.recipientsQueried,
    recipientsWithAwards: live.recipientsWithAwards,
  };
}
