import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Catch the silent split where the worker fills the DB (unprefixed SUPABASE_URL set) but the
 * app serves demo because the browser-readable NEXT_PUBLIC_SUPABASE_URL is missing. The browser
 * client can ONLY read NEXT_PUBLIC_* - so this must be set in the deploy env regardless. We warn
 * once at module load rather than fail silently.
 */
if (process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn(
    '[supabase] SUPABASE_URL is set but NEXT_PUBLIC_SUPABASE_URL is NOT - the browser will run in DEMO mode. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL (+ NEXT_PUBLIC_SUPABASE_ANON_KEY) in the deploy env to serve live data.',
  );
}

/**
 * Server Supabase client (anon key + the request's auth cookies). RLS applies, so
 * queries automatically return only the signed-in user's private rows. Returns null
 * when Supabase isn't configured (demo mode). Falls back to the unprefixed SUPABASE_URL
 * for the URL (the service client already does this) so server routes still work if only
 * the public URL var is missing; the anon key remains required.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only - middleware
          // refreshes the session instead, so this is safe to ignore.
        }
      },
    },
  });
}

/** Convenience: the current authenticated user (or null). */
export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Server-only service client for backend-owned global writes such as adding a newly quoted ticker
 * to stock_tickers before inserting a user-owned portfolio row. Never return this to the browser.
 */
export function createSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
