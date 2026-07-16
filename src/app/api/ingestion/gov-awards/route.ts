import { NextResponse } from 'next/server';
import { resolveGovAwards } from '@/lib/ingestion/usaspending';

// Node runtime (uses the shared cache + resilience helpers); revalidated by the 6h cache inside
// resolveGovAwards, so this route is cheap even under frequent polling.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live government-award ingestion endpoint - the continuous-fetch proof. GET returns the flagship
 * gov-award set: real USAspending federal contract awards for the small-cap watchlist, merged over
 * the curated sample, with explicit provenance ('live' | 'mixed' | 'sample') so the caller can
 * disclose staleness. The underlying pull is cached 6h and degrades to the sample on any failure, so
 * this is safe to call on the request path and safe to warm from a cron tick.
 *
 * Public + read-only: federal award data is public and no secret is involved.
 */
export async function GET() {
  const resolved = await resolveGovAwards();
  return NextResponse.json(
    {
      ok: true,
      source: resolved.source,
      fetchedAt: resolved.fetchedAt,
      counts: {
        total: resolved.awards.length,
        live: resolved.liveAwardCount,
        recipientsQueried: resolved.recipientsQueried,
        recipientsWithAwards: resolved.recipientsWithAwards,
      },
      awards: resolved.awards,
    },
    { headers: { 'cache-control': 'public, max-age=0, s-maxage=1800, stale-while-revalidate=21600' } },
  );
}
