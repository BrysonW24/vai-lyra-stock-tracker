import { NextResponse } from 'next/server';

/**
 * CORS for the PUBLIC community-board routes only. Lyra Solo (and accountless self-hosts)
 * call the canonical prod board cross-origin, so these routes answer any origin. This is
 * safe precisely because cross-origin callers are anonymous: requests carry no credentials
 * (a wildcard origin with credentials is rejected by browsers), identity comes from an
 * explicit voter key in the body/query, and signed-in flows stay same-origin where cookies
 * flow as before. Do NOT spread this helper to routes that read the session.
 */
export const PUBLIC_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/** JSON response with public CORS headers attached. */
export function corsJson(body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: PUBLIC_CORS_HEADERS });
}

/** Shared OPTIONS preflight handler for the public community routes. */
export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}
