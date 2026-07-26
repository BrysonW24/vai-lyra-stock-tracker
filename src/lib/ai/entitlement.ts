/**
 * AI entitlement - who gets Lyra's HOSTED key (we pay) vs bring-your-own-key (they pay).
 *
 * Two ways to be "included":
 *   1. A free trial for every new account - the first AI_TRIAL_DAYS days after signup.
 *   2. A standing grant (profiles.ai_included) - for the founder, comps, or a future paid tier.
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
