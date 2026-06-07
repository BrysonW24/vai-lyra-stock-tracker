import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Per-user setup completion, read from the database (RLS-scoped to the signed-in user).
 * Drives the in-app "Get started" checklist. Uses real row counts rather than the
 * dashboard's demo-fallback data, so an empty account reads as incomplete.
 */
export interface SetupStatus {
  signedIn: boolean;
  profileComplete: boolean;
  hasPortfolio: boolean;
  hasWatchlist: boolean;
  hasNotifications: boolean;
}

const EMPTY: SetupStatus = {
  signedIn: false,
  profileComplete: false,
  hasPortfolio: false,
  hasWatchlist: false,
  hasNotifications: false,
};

export async function getSetupStatus(): Promise<SetupStatus> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return EMPTY; // demo mode

  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return EMPTY;

    const [positions, watchlist, channels, onboarding] = await Promise.all([
      supabase.from('portfolio_positions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
      supabase.from('watchlist_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
      supabase.from('notification_channels').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
      supabase.from('onboarding_progress').select('operator_profile_completed').eq('user_id', user.id).maybeSingle(),
    ]);

    return {
      signedIn: true,
      profileComplete: Boolean(onboarding.data?.operator_profile_completed),
      hasPortfolio: (positions.count ?? 0) > 0,
      hasWatchlist: (watchlist.count ?? 0) > 0,
      hasNotifications: (channels.count ?? 0) > 0,
    };
  } catch {
    return EMPTY;
  }
}
