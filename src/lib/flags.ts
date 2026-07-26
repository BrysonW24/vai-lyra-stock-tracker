/**
 * Feature controls - the ONE place a capability can be armed or held dark.
 *
 * Each flag reads a NEXT_PUBLIC_* env var so it can be flipped per deployment (in the Vercel
 * dashboard, then redeploy) WITHOUT a code change, and every flag DEFAULTS OFF - a feature
 * ships dark and only lights up when deliberately armed. Each is a function (not a const) so
 * it reads env at call time, which keeps it togglable in tests via vi.stubEnv - mirroring
 * isSupabaseConfigured() in supabase/client.ts.
 */

/**
 * Solo -> account upgrade CTA. When armed (NEXT_PUBLIC_SOLO_UPGRADE_CTA=1), a Solo deployment
 * offers a one-tap path to create an account on the canonical Community deployment - shown at
 * the exact moments Solo has to say "not here" (background notifications, hosted AI). OFF by
 * default: the prompt is built and tested but stays invisible until the founder switches it on.
 */
export const soloUpgradeCtaEnabled = () => process.env.NEXT_PUBLIC_SOLO_UPGRADE_CTA === '1';

/**
 * Pure gate for the Solo upgrade CTA: shown only on a Solo deployment (no Supabase) AND when the
 * control is armed. The accounted build (supabaseConfigured) never shows it, armed or not - it
 * already has accounts. Kept pure so the show/hide decision is unit-testable without rendering.
 */
export const shouldShowSoloUpgradeCta = (supabaseConfigured: boolean, flagArmed: boolean): boolean =>
  !supabaseConfigured && flagArmed;
