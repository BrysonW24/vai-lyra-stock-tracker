import { describe, it, expect } from 'vitest';
import {
  formatUsd,
  normaliseAward,
  fetchAwardsForRecipient,
  fetchLiveGovAwardsUncached,
  mergeAwards,
  resolveGovAwards,
  usaspendingWatchlist,
  type FetchImpl,
  type WatchlistRecipient,
} from '../usaspending';
import { GOV_AWARDS } from '@/lib/gov-awards';

const LUNR: WatchlistRecipient = { symbol: 'LUNR', recipient: 'Intuitive Machines', theme: 'space-economy' };

/** No-op backoff so the retry path runs instantly in tests. */
const noSleep = async () => {};

/** A captured-shape USAspending response, served by an injected fetch (no network). */
function fakeFetch(rows: unknown[], opts: { ok?: boolean; status?: number } = {}): FetchImpl {
  return async () => ({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => ({ results: rows }),
  });
}

const SAMPLE_ROW = {
  'Award ID': 'HQ0034-24-C-0123',
  'Recipient Name': 'INTUITIVE MACHINES, LLC',
  'Awarding Agency': 'National Aeronautics and Space Administration',
  'Award Amount': 118_400_000,
  'Start Date': '2025-09-14',
  'Description': 'CLPS lunar payload delivery services task order.',
  'Award Type': 'C',
};

describe('usaspending · formatUsd', () => {
  it('formats billions / millions / thousands', () => {
    expect(formatUsd(3_100_000_000)).toBe('$3.1B');
    expect(formatUsd(118_400_000)).toBe('$118M');
    expect(formatUsd(4_500)).toBe('$5K');
  });
  it('guards non-positive / non-finite amounts', () => {
    expect(formatUsd(0)).toBe('$0');
    expect(formatUsd(-10)).toBe('$0');
    expect(formatUsd(Number.NaN)).toBe('$0');
  });
});

describe('usaspending · normaliseAward', () => {
  it('maps a raw row into the GovAward shape and stamps the ticker', () => {
    const award = normaliseAward(SAMPLE_ROW, LUNR);
    expect(award.tickers).toEqual(['LUNR']);
    expect(award.region).toBe('US');
    expect(award.kind).toBe('contract');
    expect(award.agency).toMatch(/Aeronautics/);
    expect(award.amount).toBe('$118M');
    expect(award.date).toBe('2025-09-14');
    expect(award.source.name).toBe('USAspending');
    expect(award.id).toMatch(/^usa-lunr-/);
    expect(award.id).toMatch(/^[a-z0-9-]+$/); // slug-safe id
  });

  it('is total - a sparse row yields best-effort defaults, never throws', () => {
    const award = normaliseAward({ 'Recipient Name': 'X CORP' }, LUNR);
    expect(award.amount).toBe('$0');
    expect(award.recipient).toBe('X CORP');
    expect(award.summary.length).toBeGreaterThan(0);
  });

  it('truncates an overlong description', () => {
    const long = 'a'.repeat(400);
    const award = normaliseAward({ ...SAMPLE_ROW, Description: long }, LUNR);
    expect(award.summary.length).toBeLessThanOrEqual(240);
    expect(award.summary.endsWith('...')).toBe(true);
  });
});

describe('usaspending · fetchAwardsForRecipient', () => {
  it('returns normalised awards on success, dropping zero-amount rows', async () => {
    const rows = [SAMPLE_ROW, { ...SAMPLE_ROW, 'Award ID': 'ZERO', 'Award Amount': 0 }];
    const awards = await fetchAwardsForRecipient(LUNR, { fetchImpl: fakeFetch(rows) });
    expect(awards).toHaveLength(1);
    expect(awards[0].tickers).toEqual(['LUNR']);
  });

  it('degrades to [] on an HTTP error (never throws)', async () => {
    const awards = await fetchAwardsForRecipient(LUNR, { fetchImpl: fakeFetch([], { ok: false, status: 500 }), retrySleep: noSleep });
    expect(awards).toEqual([]);
  });

  it('degrades to [] when the fetch throws (network failure)', async () => {
    const throwing: FetchImpl = async () => {
      throw new Error('fetch failed');
    };
    const awards = await fetchAwardsForRecipient(LUNR, { fetchImpl: throwing, retrySleep: noSleep });
    expect(awards).toEqual([]);
  });

  it('degrades to [] on an empty result set', async () => {
    const awards = await fetchAwardsForRecipient(LUNR, { fetchImpl: fakeFetch([]) });
    expect(awards).toEqual([]);
  });
});

describe('usaspending · watchlist', () => {
  it('is the small-cap roster (narrow scope), every entry has a symbol + recipient', () => {
    const wl = usaspendingWatchlist();
    expect(wl.length).toBeGreaterThan(0);
    for (const e of wl) {
      expect(e.symbol).toBeTruthy();
      expect(e.recipient).toBeTruthy();
      expect(e.theme).toBeTruthy();
    }
    // Flagship small caps are present.
    expect(wl.map((e) => e.symbol)).toContain('LUNR');
    expect(wl.map((e) => e.symbol)).toContain('RGTI');
  });
});

describe('usaspending · fetchLiveGovAwardsUncached', () => {
  it('queries the whole watchlist and aggregates, counting recipients with awards', async () => {
    // Every recipient returns one award via the injected fetch.
    const live = await fetchLiveGovAwardsUncached({ fetchImpl: fakeFetch([SAMPLE_ROW]), now: new Date('2026-07-16T00:00:00Z') });
    expect(live.recipientsQueried).toBe(usaspendingWatchlist().length);
    expect(live.recipientsWithAwards).toBe(usaspendingWatchlist().length);
    expect(live.awards.length).toBe(usaspendingWatchlist().length);
    expect(live.fetchedAt).toBe('2026-07-16T00:00:00.000Z');
  });

  it('returns an empty batch when every recipient fails, without throwing', async () => {
    const live = await fetchLiveGovAwardsUncached({ fetchImpl: fakeFetch([], { ok: false, status: 503 }), retrySleep: noSleep });
    expect(live.awards).toEqual([]);
    expect(live.recipientsWithAwards).toBe(0);
  });
});

describe('usaspending · mergeAwards', () => {
  it('prefers live and drops sample awards whose ticker is now covered live', () => {
    const live = [normaliseAward({ ...SAMPLE_ROW, 'Award Amount': 1 }, { symbol: 'NVDA', recipient: 'NVIDIA', theme: 'agi-infrastructure' })];
    const sample = GOV_AWARDS; // includes an award tagged NVDA
    const merged = mergeAwards(live, sample);
    const nvdaAwards = merged.filter((a) => a.tickers.includes('NVDA'));
    // Only the live NVDA award survives; the sample NVDA award is dropped.
    expect(nvdaAwards.every((a) => a.source.name === 'USAspending')).toBe(true);
  });

  it('keeps sample awards with no ticker overlap and dedupes by id', () => {
    const merged = mergeAwards([], GOV_AWARDS);
    const ids = merged.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids
    expect(merged.length).toBe(GOV_AWARDS.length); // no live awards -> full sample
  });
});

describe('usaspending · resolveGovAwards (provenance)', () => {
  it('reports source=sample when the live pull is empty', async () => {
    const resolved = await resolveGovAwards({ fetchImpl: fakeFetch([], { ok: false, status: 500 }), retrySleep: noSleep });
    expect(resolved.source).toBe('sample');
    expect(resolved.liveAwardCount).toBe(0);
    expect(resolved.awards.length).toBe(GOV_AWARDS.length);
  });

  it('reports source=mixed when some live awards merge with retained sample', async () => {
    const resolved = await resolveGovAwards({ fetchImpl: fakeFetch([SAMPLE_ROW]), now: new Date('2026-07-16T00:00:00Z') });
    expect(resolved.liveAwardCount).toBeGreaterThan(0);
    expect(['mixed', 'live']).toContain(resolved.source);
    // Provenance is explicit and the fetch timestamp is surfaced for staleness disclosure.
    expect(resolved.fetchedAt).toBe('2026-07-16T00:00:00.000Z');
  });
});
