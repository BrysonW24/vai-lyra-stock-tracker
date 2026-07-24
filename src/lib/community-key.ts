import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { VOTER_KEY_PATTERN } from '@/lib/community-contract';

/**
 * Server-issued, HMAC-signed participant keys for the anonymous community board.
 * SERVER ONLY - never import from client components.
 *
 * Why signed: the review that shipped with this feature proved that a bare client-minted
 * UUID makes vote counts trivially forgeable - an abuser mints a fresh key per request and
 * every one passes shape validation, so "one vote per device" never really existed. Signing
 * moves key minting behind a rate-limited server endpoint: a caller can still ask for more
 * keys, but only as fast as the issuance limiter allows from a trusted IP, which turns
 * unlimited durable forgery into a bounded trickle. This is deliberate abuse DAMPING for a
 * community board, not sybil-proof identity - accounts remain the strong path.
 *
 * Key format: "<uuid>.<hmac-sha256(uuid) hex, first 32 chars>". The uuid half is what gets
 * stored as community_idea_votes.voter_key; the signature never touches the database.
 */

const SIG_LENGTH = 32;

/**
 * Secret material, in preference order: a dedicated secret, the auth secret, or (always
 * present on a configured deployment) the service-role key. HMAC derivation means the
 * secret itself is never derivable from issued keys; rotating it simply invalidates
 * outstanding anonymous keys, and clients transparently request a fresh one.
 */
function secret(): string {
  return process.env.COMMUNITY_KEY_SECRET || process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function sign(uuid: string, sec: string): string {
  return createHmac('sha256', sec).update(uuid).digest('hex').slice(0, SIG_LENGTH);
}

/** Mint a signed participant key, or null when this deployment has no secret material. */
export function issueCommunityKey(): string | null {
  const sec = secret();
  if (!sec) return null;
  const uuid = randomUUID();
  return `${uuid}.${sign(uuid, sec)}`;
}

/**
 * Verify a participant key and return its uuid half (the stored voter_key), or null for
 * anything malformed, unsigned, or tampered with. Constant-time signature comparison.
 */
export function verifyCommunityKey(key: string | null | undefined): string | null {
  const sec = secret();
  if (!sec || !key) return null;
  const dot = key.indexOf('.');
  if (dot === -1) return null;
  const uuid = key.slice(0, dot);
  const sig = key.slice(dot + 1);
  if (!VOTER_KEY_PATTERN.test(uuid) || sig.length !== SIG_LENGTH) return null;
  const expected = sign(uuid, sec);
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))) return null;
  } catch {
    return null;
  }
  return uuid.toLowerCase();
}
