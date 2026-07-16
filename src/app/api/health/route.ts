import { NextResponse } from 'next/server';
import { APP_VERSION, APP_VERSION_DATE } from '@/lib/version';
import { env } from '@/lib/env';
import { cacheBackendName } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 * Liveness + build-identity probe for hosting platforms (Coolify healthcheck, uptime
 * monitors) and for verifying a deploy actually shipped the version you think it did.
 * Public and unauthenticated by design; exposes no secrets - `mode` only says whether
 * the Supabase env vars were present at build time (live) or absent (demo).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    version: APP_VERSION,
    versionDate: APP_VERSION_DATE,
    mode: env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'live' : 'demo',
    cache: cacheBackendName(),
  });
}
