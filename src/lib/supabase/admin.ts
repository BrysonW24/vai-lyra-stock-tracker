import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. SERVER ONLY - never import from client components.
 * Bypasses RLS; used for admin routes and any server-side job that must write across
 * users. The service key must live in SUPABASE_SERVICE_ROLE_KEY (never NEXT_PUBLIC_*).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
