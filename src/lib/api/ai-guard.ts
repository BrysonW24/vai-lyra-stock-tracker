import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';
import { rateLimitShared } from '@/lib/ratelimit';

/**
 * Shared guard for the AI + paper-bot API surface. It exists to close the class of holes the
 * security audit flagged: anonymous callers burning a server-side AI key, no rate limit, and no
 * payload cap.
 *
 * It does three things before a route touches a model:
 *   1. Resolves the Supabase session user (null in demo / signed-out). The credential resolver
 *      then only allows the HOSTED/SHARED server key when `authenticated` is true - a bring-your-
 *      own-key request still works signed-out, but the server's key is never reachable anonymously.
 *   2. Caps the request body size (defends the unbounded-JSON parse + prompt-stuffing surface).
 *   3. Rate-limits per identity (user id when signed in, else client IP) so one caller cannot
 *      hammer the AI budget.
 *
 * Returns either the parsed body + auth flag, or a ready-to-send NextResponse to short-circuit.
 */

const DEFAULT_MAX_BYTES = 32_768; // 32 KB - generous for chat history, tiny vs an abuse payload

export interface AiGuardOptions {
  /** Rate-limit budget name; routes in the same class should share it. Default 'ai'. */
  scope?: string;
  /** Requests allowed per window per identity. Default 30. */
  capacity?: number;
  /** Window length in ms. Default 60_000 (per minute). */
  windowMs?: number;
  /** Max request body size in bytes. Default 32 KB. */
  maxBytes?: number;
}

export interface AiGuardOk<T> {
  ok: true;
  body: T;
  /** True when a Supabase session was present. Gates the server-side key fallback. */
  authenticated: boolean;
  /** Stable identity used for rate limiting (user id or IP). */
  identity: string;
}

export interface AiGuardBlocked {
  ok: false;
  response: NextResponse;
}

/**
 * Best-effort caller identity for anonymous rate limiting. Prefer x-real-ip: the platform
 * (Vercel, and the traefik/nginx front of a self-host) SETS it from the actual connection,
 * so the caller cannot choose it. The LEFTMOST x-forwarded-for hop, by contrast, is fully
 * caller-controlled (proxies append the real IP on the RIGHT) - keying limits on it let an
 * abuser mint a fresh rate-limit bucket per request with a spoofed header, which defeated
 * every throttle on the open community routes. When only XFF exists we take the RIGHTMOST
 * hop (the nearest, platform-appended one). Still abuse damping, not authentication.
 * Exported for the other open routes (feedback, ticker-lookup) so they share one definition.
 */
export function clientIp(request: NextRequest): string {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const hops = fwd.split(',');
    return hops[hops.length - 1]!.trim() || 'anon';
  }
  return 'anon';
}

export async function guardAiRoute<T>(
  request: NextRequest,
  opts: AiGuardOptions = {},
): Promise<AiGuardOk<T> | AiGuardBlocked> {
  const { scope = 'ai', capacity = 30, windowMs = 60_000, maxBytes = DEFAULT_MAX_BYTES } = opts;

  // 1. Payload cap - reject oversized bodies before parsing/hashing them.
  const declaredLen = Number(request.headers.get('content-length') || 0);
  if (declaredLen > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: 'payload_too_large' }, { status: 413 }),
    };
  }

  const raw = await request.text();
  if (raw.length > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: 'payload_too_large' }, { status: 413 }),
    };
  }

  let body: T;
  try {
    body = JSON.parse(raw) as T;
  } catch {
    return { ok: false, response: NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 }) };
  }

  // 2. Identity - a signed-in user is rate-limited by id; everyone else by IP.
  const user = await getSessionUser().catch(() => null);
  const identity = user?.id ?? `ip:${clientIp(request)}`;

  // 3. Rate limit - SHARED (Upstash) so the budget holds across every serverless instance.
  // On Vercel each request can hit a different lambda; the old in-process limiter reset per
  // instance, so a caller effectively got (instances x capacity). rateLimitShared uses one
  // Redis counter and only falls back to in-memory when Upstash is unconfigured (local/demo).
  const rl = await rateLimitShared(identity, { scope, capacity, windowMs });
  if (!rl.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, reason: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      ),
    };
  }

  return { ok: true, body, authenticated: Boolean(user), identity };
}
