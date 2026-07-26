import { isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Community board plumbing. The Ideas board is ONE global board for every Lyra surface:
 * deployments with their own Supabase (prod) serve it from their own API; deployments
 * without one (Lyra Solo, self-hosts running accountless) talk to the canonical prod API
 * cross-origin, so a Solo user sees and votes on the same list as everyone else.
 *
 * Participation without an account uses a SERVER-ISSUED, HMAC-signed participant key
 * (see server-side lib/community-key.ts): the client asks the board's key endpoint once,
 * keeps the key, and sends it with votes and posts. Keys cannot be minted client-side -
 * that is what keeps anonymous vote counts honest. The key is not identity: clearing site
 * data forgets it and a fresh one is issued.
 */

/** Canonical home of the shared community board (same origin as the live product). */
export const COMMUNITY_HOME_ORIGIN = 'https://lyra.vivacityai.com.au';

/**
 * Absolute deep-link to account signup on the canonical Community deployment. Cross-origin by
 * design: Solo has no auth of its own, so account creation happens on prod. `from` is a harmless
 * attribution hint the signup page may ignore.
 */
export function communitySignupHref(from = 'solo'): string {
  return `${COMMUNITY_HOME_ORIGIN}/auth/signup?from=${encodeURIComponent(from)}`;
}

const KEY_STORAGE = 'lyra:community-key';

/** Fallback when localStorage is unavailable (private-mode edge cases, locked-down webviews):
 *  the issued key lives for the page session instead of dead-ending participation. */
let ephemeralKey: string | null = null;

/**
 * Where community API calls go: same-origin when this deployment has Supabase (it IS the
 * board), the canonical prod origin otherwise (Solo joins the shared board).
 */
export function communityApiBase(): string {
  return isSupabaseConfigured() ? '' : COMMUNITY_HOME_ORIGIN;
}

/**
 * Peek at an already-held key WITHOUT issuing one. Used for read paths (voted-state on
 * load): a visitor who never votes should never cost an issuance - keys are minted only
 * at the moment of first participation.
 */
export function communityStoredKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? ephemeralKey ?? '';
  } catch {
    return ephemeralKey ?? '';
  }
}

/**
 * The participant key for anonymous votes/posts: cached locally, issued by the board on
 * first use. Returns '' when the key cannot be obtained (offline, issuance limited) -
 * callers surface their own honest error and the user can simply retry.
 */
export async function communityParticipantKey(): Promise<string> {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(KEY_STORAGE);
    if (existing) return existing;
  } catch {
    // Storage unreadable - fall through to the ephemeral path.
  }
  if (ephemeralKey) return ephemeralKey;

  try {
    const res = await fetch(`${communityApiBase()}/api/community/key`, { cache: 'no-store' });
    const data = (await res.json()) as { ok?: boolean; key?: string };
    if (!data.ok || !data.key) return '';
    try {
      window.localStorage.setItem(KEY_STORAGE, data.key);
    } catch {
      ephemeralKey = data.key;
    }
    return data.key;
  } catch {
    return '';
  }
}

/** Drop a key the server rejected (e.g. after a secret rotation) so the next call re-issues. */
export function forgetCommunityKey(): void {
  ephemeralKey = null;
  try {
    window.localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Nothing to forget if storage is unavailable.
  }
}
