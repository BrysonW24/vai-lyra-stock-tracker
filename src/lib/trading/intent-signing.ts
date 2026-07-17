/**
 * Paper-bot approval gate as a signed CAPABILITY, not a trust-the-client flag.
 *
 * The security audit flagged: "the approval gate trusts client-supplied intent state." The old HTTP
 * route flipped an intent to `approved` (and then executed it) purely because the request body said
 * `status: 'approved'`. A client could therefore skip propose+approve entirely - fabricating any
 * symbol / quantity / status - and reach a paper fill, defeating the AI-evidence + risk gate and
 * corrupting the account's track record.
 *
 * The fix binds each step cryptographically. At every stage the server signs the economically
 * meaningful fields of the intent (+ the caller it was issued to + the stage + the tour flag) with a
 * server-only secret; the next stage verifies that signature before it will act:
 *
 *     propose  -> issues a `proposed` token over {id,symbol,side,quantity,owner,tour}
 *     approve  -> verifies the `proposed` token, issues an `approved` token
 *     execute  -> verifies the `approved` token, then (and only then) fills
 *
 * Properties:
 *   - Unforgeable: a client cannot mint an `approved` token (it lacks the secret), so it cannot reach
 *     a fill without a real propose->approve chain. Fabricated fields change the signature => reject.
 *   - Per-caller: the caller identity is signed in, so user A's token cannot be replayed by user B.
 *   - Stateless: no server-side session map, so it survives serverless cold starts / instance hops -
 *     unlike an in-memory pending-intent map. Portable to any request/response API.
 *
 * The secret resolves from an existing server-only secret; when NONE is configured (pure local/demo,
 * no Supabase, single implicit user, no multi-user surface) it falls back to a per-process random key
 * so tokens are STILL unforgeable - never a source-embedded constant. A per-process key only degrades
 * cross-instance durability (a cold instance rejects an old token -> "re-propose"), which is the same
 * best-effort the in-memory CLI path already documents. Set PAPER_BOT_INTENT_SECRET to make the
 * capability durable across every instance.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type IntentStage = 'proposed' | 'approved';

export interface IntentClaim {
  /** OrderIntent.id - unique per propose. */
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  /** The caller the capability was issued to (user id when signed in, else IP). */
  owner: string;
  /** Which step of the chain this token authorises. */
  stage: IntentStage;
  /** Whether this is the onboarding tour's mock intent - bound so it cannot be flipped after issue. */
  tour: boolean;
}

let ephemeralSecret: string | null = null;

/**
 * Server-only HMAC key. Prefers an explicit secret, then any already-configured server secret, and
 * only if none exist falls back to a per-process random key (still unforgeable; see module doc).
 */
function secret(): string {
  const configured =
    process.env.PAPER_BOT_INTENT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NOTIFICATION_DISPATCH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (configured) return configured;
  if (!ephemeralSecret) ephemeralSecret = randomBytes(32).toString('hex');
  return ephemeralSecret;
}

/** Canonical, order-stable serialisation of the claim - the exact bytes that get signed. */
function canonical(c: IntentClaim): string {
  return JSON.stringify([c.id, c.symbol, c.side, c.quantity, c.owner, c.stage, c.tour ? 1 : 0]);
}

/** Sign a claim. Returns a base64url HMAC-SHA256 token. */
export function signClaim(c: IntentClaim): string {
  return createHmac('sha256', secret()).update(canonical(c)).digest('base64url');
}

/**
 * Verify a token against a claim in constant time. Any mismatch in id / symbol / side / quantity /
 * owner / stage / tour - or a missing/garbage token - returns false. This is the whole gate.
 */
export function verifyClaim(c: IntentClaim, token: unknown): boolean {
  if (typeof token !== 'string' || token.length === 0) return false;
  const expected = signClaim(c);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
