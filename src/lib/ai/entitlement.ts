/**
 * AI entitlement - who gets Lyra's HOSTED key (we pay) vs bring-your-own-key (they pay).
 *
 * Two ways to be "included":
 *   1. A free trial for every new account - the first AI_TRIAL_DAYS days after signup.
 *   2. A standing grant - the `AI_INCLUDED_EMAILS` allowlist in the deployment env (founder, comps).
 *
 * The grant is read ONLY from the server's own environment. `profiles.ai_included` exists as a
 * column but is deliberately not consulted: a user can write their own profiles row, and until
 * migration 058 nothing stopped them setting that flag to true and keeping the house key forever.
 * Authority must not live in a row its subject can write (the same lesson as migration 047). If a
 * per-row grant is ever wanted again, read it from somewhere only the server can write.
 *
 * Everyone else falls through to BYOK: the deterministic scanner + notifications never need AI,
 * so a user past their trial keeps the whole product and simply adds their own key to chat.
 *
 * Pure + timezone-agnostic: the caller passes `now` (Date.now()) and the account's ISO created_at,
 * so the decision is fully unit-testable and never reads a wall clock itself.
 */

export const AI_TRIAL_DAYS = 14;
const DAY_MS = 86_400_000;

/** Is this account entitled to the hosted key right now (granted, or still inside the trial)? */
export function isAiIncluded(opts: { accountCreatedAt?: string | null; granted: boolean; now: number }): boolean {
  if (opts.granted) return true;
  const created = opts.accountCreatedAt ? Date.parse(opts.accountCreatedAt) : NaN;
  if (Number.isNaN(created)) return false;
  return opts.now < created + AI_TRIAL_DAYS * DAY_MS;
}

/** Whole days of trial left (ceiling), 0 once it has lapsed or the created_at is unknown. */
export function aiTrialDaysLeft(opts: { accountCreatedAt?: string | null; now: number }): number {
  const created = opts.accountCreatedAt ? Date.parse(opts.accountCreatedAt) : NaN;
  if (Number.isNaN(created)) return 0;
  const msLeft = created + AI_TRIAL_DAYS * DAY_MS - opts.now;
  return msLeft <= 0 ? 0 : Math.ceil(msLeft / DAY_MS);
}

/**
 * Standing owner/comp grant via env - `AI_INCLUDED_EMAILS` is a comma-separated allowlist of emails
 * that always get the hosted key, indefinitely, regardless of trial age. This is the founder/owner
 * escape hatch: set it in the deployment env and that account never lapses to BYOK. Case-insensitive.
 * This is the only standing grant (see the header for why the profiles column is not one).
 */
export function isOwnerGranted(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.AI_INCLUDED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * The whole hosted-key decision for one signed-in account, from server-held facts only: the
 * account's creation time (from the verified session) and the env allowlist. No database read -
 * so nothing a user can write can change the answer, and every AI request is one round trip lighter.
 */
export function resolveHostedEntitlement(
  user: { email?: string | null; created_at?: string | null },
  now: number,
): { included: boolean; granted: boolean; trialDaysLeft: number } {
  const granted = isOwnerGranted(user.email);
  return {
    included: isAiIncluded({ accountCreatedAt: user.created_at, granted, now }),
    granted,
    trialDaysLeft: granted ? 0 : aiTrialDaysLeft({ accountCreatedAt: user.created_at, now }),
  };
}
