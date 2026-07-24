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
