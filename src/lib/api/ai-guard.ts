import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/ratelimit';

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

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return request.headers.get('x-real-ip')?.trim() || 'anon';
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

  // 3. Rate limit.
  const rl = rateLimit(identity, { scope, capacity, windowMs });
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
