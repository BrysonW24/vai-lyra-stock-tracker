'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client (anon/publishable key). Respects RLS - used for logged-in
 * user reads/writes from client components. Returns null when Supabase isn't configured
 * so the app degrades cleanly to demo mode.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
