import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APP_VERSION, APP_VERSION_DATE } from '@/lib/version';
import { env } from '@/lib/env';
import { cacheBackendStatus } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 * Best-effort scan freshness so a dead scanner cron is visible from the health probe -
 * previously a cron auto-disabled for weeks still looked perfectly healthy here. Anon
 * read (stock_scanner_runs is global read-only under RLS); any error degrades to null.
 */
async function lastScanAt(): Promise<string | null> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await supabase
      .from('stock_scanner_runs')
      .select('finished_at')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { finished_at?: string | null } | null)?.finished_at ?? null;
  } catch {
    return null;
  }
}

/**
 * Liveness + build-identity probe for hosting platforms (Coolify healthcheck, uptime
 * monitors) and for verifying a deploy actually shipped the version you think it did.
 * Public and unauthenticated by design; exposes no secrets - `mode` only says whether
 * the Supabase env vars were present at build time (live) or absent (demo).
 */
export async function GET() {
  const live = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return NextResponse.json({
    ok: true,
    version: APP_VERSION,
    versionDate: APP_VERSION_DATE,
    mode: live ? 'live' : 'demo',
    // Verified liveness (best-effort PING, ~800ms bound), not just env-derived selection -
    // this is the only surface where a dead Redis can appear; cache errors are swallowed.
    cache: await cacheBackendStatus(),
    // When the scanner last finished a run - null in demo or on a read failure. Point an
    // uptime monitor at this: older than ~2h during market hours means the cron is dead.
    lastScanAt: live ? await lastScanAt() : null,
  });
}
