/**
 * Middleware fail-safe contract. On 2026-07-17 a total production outage happened because
 * `supabase.auth.getUser()` in the middleware threw (auth blip / edge fetch failure) with no
 * error handling - crashing the middleware on EVERY request, so every page and API returned
 * MIDDLEWARE_INVOCATION_FAILED at once. These pin the fix: a middleware must NEVER hard-crash the
 * whole app. When auth is unavailable it fails SAFE - public/API pass through, app pages fall back
 * to the signed-out landing - and it never 500s.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

type GetUser = () => Promise<{ data: { user: unknown } }>;
const hoisted = vi.hoisted(() => ({ getUser: (async () => ({ data: { user: null } })) as GetUser }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: hoisted.getUser } }),
}));

import { middleware } from '../middleware';

const ENV = { url: 'https://x.supabase.co', key: 'anon-key' };

function req(path: string, cookies: Record<string, string> = {}): NextRequest {
  const r = new NextRequest(`https://app.test${path}`);
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
}

describe('middleware fail-safe (never 500 the whole app)', () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = orig.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = orig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    hoisted.getUser = async () => ({ data: { user: null } });
  });

  it('when getUser THROWS, an app page redirects to /welcome instead of crashing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ENV.key;
    hoisted.getUser = async () => {
      throw new Error('auth service unreachable from the edge');
    };
    const res = await middleware(req('/portfolio'));
    expect(res.status).toBe(307); // redirect, not 500
    expect(res.headers.get('location')).toContain('/welcome');
  });

  it('when getUser THROWS, an /api route passes through (it enforces its own auth)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ENV.key;
    hoisted.getUser = async () => {
      throw new Error('boom');
    };
    const res = await middleware(req('/api/health'));
    expect(res.status).toBe(200); // NextResponse.next() - passthrough
  });

  it('when getUser THROWS, a public page passes through', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ENV.key;
    hoisted.getUser = async () => {
      throw new Error('boom');
    };
    const res = await middleware(req('/welcome'));
    expect(res.status).toBe(200);
  });

  it('a signed-in user on an app page is let through (happy path still works)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ENV.key;
    hoisted.getUser = async () => ({ data: { user: { user_metadata: { onboarded: true } } } });
    const res = await middleware(req('/portfolio'));
    expect(res.status).toBe(200);
  });

  it('the demo-tour cookie survives an auth outage (read-only tour)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ENV.key;
    hoisted.getUser = async () => {
      throw new Error('boom');
    };
    const res = await middleware(req('/portfolio', { lyra_demo: '1' }));
    expect(res.status).toBe(200);
  });

  it.each(['/manifest.webmanifest', '/sw.js'])(
    'lets the PWA asset %s through before Solo onboarding',
    async (path) => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await middleware(req(path));
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    },
  );
});
