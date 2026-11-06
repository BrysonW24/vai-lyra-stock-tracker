import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';
import { rateLimitShared } from '@/lib/ratelimit';
import { resolveHostedEntitlement } from '@/lib/ai/entitlement';

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
  /**
   * True when this user is entitled to Lyra's hosted key (inside their free trial, or granted).
   * Pass straight to resolveAiCredentials - an authenticated-but-not-included user is BYOK-only.
   */
  aiIncluded: boolean;
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
 *
 * An IPv6 caller is identified by their /64 (see rateLimitKeyForIp): one home or phone connection
 * is handed a whole /64 and can pick any of its 18 quintillion addresses per request, so a limit
 * keyed on the full address is a limit that caller can reset at will.
 */
export function clientIp(request: NextRequest): string {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return rateLimitKeyForIp(real);
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const hops = fwd.split(',');
    return rateLimitKeyForIp(hops[hops.length - 1]!.trim()) || 'anon';
  }
  return 'anon';
}

/**
 * The key an address is rate-limited under. IPv4 is itself. IPv6 is its /64 prefix, written
 * `2001:db8:1:2::/64`; an IPv4-mapped IPv6 address is the IPv4 address inside it, however it was
 * written (`::ffff:203.0.113.7` or `::ffff:cb00:7107`). A port a proxy appended (`1.2.3.4:5678`,
 * `[2001:db8::1]:443`) is dropped - the same caller on another port is the same caller. Anything
 * that does not parse as an address is returned unchanged - a strange header still gets one bucket
 * of its own rather than sharing "anon" with everybody.
 */
export function rateLimitKeyForIp(ip: string): string {
  let raw = ip.trim().toLowerCase();
  const bracketed = raw.match(/^\[([^\]]+)\](?::\d{1,5})?$/);
  if (bracketed) raw = bracketed[1]!;
  raw = raw.split('%')[0]!;
  const v4 = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?$/);
  if (v4) return v4[1]!;
  if (!raw.includes(':')) return raw;
  const dotted = raw.match(/^(?:0{0,4}:){1,6}ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1]!;
  const halves = raw.split('::');
  if (halves.length > 2) return raw;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const gap = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (gap < 0) return raw;
  const groups = [...head, ...Array<string>(gap).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return raw;
  const words = groups.map((group) => parseInt(group, 16));
  // ::ffff:a.b.c.d with the address written as two hex groups.
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    return `${words[6]! >> 8}.${words[6]! & 0xff}.${words[7]! >> 8}.${words[7]! & 0xff}`;
  }
  return `${words.slice(0, 4).map((word) => word.toString(16)).join(':')}::/64`;
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
  // Per-user hosted-key entitlement (trial or env-granted); anonymous callers are never included.
  // Decided from the verified session and the server's env alone - never from a profiles row.
  const aiIncluded = user ? resolveHostedEntitlement(user, Date.now()).included : false;

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

  return { ok: true, body, authenticated: Boolean(user), aiIncluded, identity };
}
