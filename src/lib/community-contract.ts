/**
 * Pure shared contract for the community board - importable from BOTH client components
 * and server routes (no 'use client' dependencies, no env reads).
 */

/**
 * Shape of the uuid HALF of a participant key (UUID v4). The full key clients hold is
 * "<uuid>.<signature>" - see lib/community-key.ts; only the uuid half is ever stored as
 * community_idea_votes.voter_key.
 */
export const VOTER_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const IDEA_TITLE_MIN = 3;
export const IDEA_TITLE_MAX = 120;
export const IDEA_DESCRIPTION_MAX = 2000;

/** Fixed ids of the two seeded example ideas (migration 053) - "things we may never build". */
export const EXAMPLE_IDEA_IDS = [
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
] as const;

/**
 * Where a submission came from. The board lives on production; Solo (and any other deployment)
 * reaches it cross-origin, so the request's Origin header tells us the source surface -
 * browser-set and reliable for real clients. A raw curl can spoof it, which is fine: this is a
 * provenance/analytics signal, never a security control.
 */
export const PROD_ORIGIN = 'https://lyra.vivacityai.com.au';
export const SOLO_ORIGIN = 'https://solo.lyra.vivacityai.com.au';
export type CommunitySurface = 'community' | 'solo' | 'other';

/** Classify a request Origin into the deployment it came from. Unknown/absent -> 'other'. */
export function classifySurface(origin: string | null | undefined): CommunitySurface {
  if (origin === SOLO_ORIGIN) return 'solo';
  if (origin === PROD_ORIGIN) return 'community';
  return 'other';
}
