import { createSupabaseServerClient } from '@/lib/supabase/server';
import dashboardColumns from '@/lib/dashboard-columns.json';

/**
 * Per-user setup completion, read from the database (RLS-scoped to the signed-in user).
 * Drives the in-app "Get started" checklist. Uses real row counts rather than the
 * dashboard's demo-fallback data, so an empty account reads as incomplete.
 */
/**
 * Whether alerts are actually REACHING this account - not whether a channel exists.
 *
 * "Alerts are set up" used to mean one thing: a channel row exists. On 2026-10-05 the operator
 * asked why the alerts had never come through. The channel existed and the checklist was ticked;
 * the account had been on "mute all" since 2026-07-17, fourteen seconds after the last alert that
 * ever got through, and nothing anywhere said so. A status that implies delivery has to read
 * delivery.
 */
export interface AlertHealth {
  /** An indefinite mute is on: every non-critical alert is being held back. */
  muted: boolean;
  /** When the mute was switched on (the preferences row's last change), ISO. */
  mutedSince: string | null;
  /** When an alert last actually reached this account on any channel, ISO. Null = never. */
  lastDeliveredAt: string | null;
  /** How many alerts the mute has held back so far. */
  heldBack: number;
  /** The account's own timezone, for showing those dates the way the user would say them. */
  timezone: string;
}

export interface SetupStatus {
  signedIn: boolean;
  profileComplete: boolean;
  hasPortfolio: boolean;
  hasWatchlist: boolean;
  hasNotifications: boolean;
  /** Absent when it could not be read (demo, signed out, or a failed read) - never guessed. */
  alerts?: AlertHealth;
}

const EMPTY: SetupStatus = {
  signedIn: false,
  profileComplete: false,
  hasPortfolio: false,
  hasWatchlist: false,
  hasNotifications: false,
};

type Client = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/** Best-effort: any failed read returns undefined, so the page says nothing rather than something wrong. */
async function readAlertHealth(supabase: Client, userId: string): Promise<AlertHealth | undefined> {
  try {
    const [prefs, lastSent, held] = await Promise.all([
      supabase
        .from('user_alert_preferences')
        .select(dashboardColumns.user_alert_preferences.join(', '))
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('notification_deliveries')
        .select('created_at')
        .eq('user_id', userId)
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('notification_deliveries')
        .select('created_at', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('error_message', 'muted all'),
    ]);
    if (prefs.error || lastSent.error) return undefined;
    const row = prefs.data as unknown as { mute_all?: boolean | null; alert_mode?: string | null; updated_at?: string | null; timezone?: string | null } | null;
    // The same rule the dispatch router enforces (lib/notifications/dispatch.ts). A timed snooze is
    // deliberately not flagged here: it ends on its own. An indefinite mute is the one that gets forgotten.
    const muted = Boolean(row?.mute_all) || row?.alert_mode === 'muted';
    const sentRows = (lastSent.data ?? []) as unknown as Array<{ created_at: string }>;
    return {
      muted,
      mutedSince: muted ? (row?.updated_at ?? null) : null,
      lastDeliveredAt: sentRows[0]?.created_at ?? null,
      heldBack: muted ? (held.count ?? 0) : 0,
      timezone: row?.timezone || 'Australia/Sydney',
    };
  } catch {
    return undefined;
  }
}

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
      alerts: await readAlertHealth(supabase, user.id),
    };
  } catch {
    return EMPTY;
  }
}
