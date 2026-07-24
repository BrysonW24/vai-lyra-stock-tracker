import { type NextRequest } from 'next/server';
import { rateLimitShared } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';
import { corsJson, corsPreflight } from '@/lib/api/cors';
import { issueCommunityKey } from '@/lib/community-key';

/**
 * Issue an anonymous community-board participant key (HMAC-signed, see lib/community-key.ts).
 * The client asks once, keeps the key in localStorage, and sends it with votes and posts.
 * Issuance is the choke point that makes anonymous participation abuse-DAMPED: minting keys
 * requires burning this limiter from a real IP, so vote forgery is bounded instead of free.
 * CORS is open on purpose - Lyra Solo obtains its key from the canonical board cross-origin.
 */

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: NextRequest) {
  // Tight on purpose: a legitimate device needs exactly one key, ever. The hourly window
  // absorbs shared IPs (offices, uni networks) without opening the mint to a loop.
  const rl = await rateLimitShared(`ip:${clientIp(request)}`, { scope: 'community_key', capacity: 10, windowMs: 3_600_000 });
  if (!rl.allowed) {
    return corsJson({ ok: false, error: 'Too many key requests - try again later.' }, { status: 429 });
  }

  const key = issueCommunityKey();
  if (!key) {
    return corsJson({ ok: false, error: 'Anonymous participation is not available on this deployment.' }, { status: 503 });
  }
  return corsJson({ ok: true, key });
}
