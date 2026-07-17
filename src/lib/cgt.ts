/**
 * CGT holding-period status - pure date math over the user's own records.
 *
 * Australian CGT rules apply a 50% discount to capital gains on assets held over 12
 * months. This module states WHERE a holding sits relative to that date and nothing
 * more: whether the discount would apply to a gain is tax advice territory the app
 * never enters (the paired cgt_anniversary notification carries the full wording).
 * The badge is factual either way - held duration is true for gains and losses alike.
 *
 * Mirrors workers/stock_scanner/cgt_radar.py: 365-day threshold, 30-day approach window.
 */

export const CGT_HOLDING_DAYS = 365;
export const CGT_APPROACH_WINDOW_DAYS = 30;

export interface CgtStatus {
  heldDays: number;
  /** Days until the 12-month anniversary; 0 or negative means reached. */
  daysToAnniversary: number;
  state: 'eligible' | 'approaching' | 'building';
  /** Compact badge copy, e.g. "12mo+ held" | "CGT date in 23d" | "held 84d". */
  label: string;
}

/** Null when the purchase date is missing or unparseable - never guessed. */
export function cgtStatusFor(purchaseDate: string | null | undefined, todayIso: string): CgtStatus | null {
  if (!purchaseDate) return null;
  const purchased = Date.parse(`${purchaseDate.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${todayIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(purchased) || !Number.isFinite(today) || purchased > today) return null;

  const heldDays = Math.floor((today - purchased) / 86_400_000);
  const daysToAnniversary = CGT_HOLDING_DAYS - heldDays;
  if (daysToAnniversary <= 0) {
    return { heldDays, daysToAnniversary, state: 'eligible', label: '12mo+ held' };
  }
  if (daysToAnniversary <= CGT_APPROACH_WINDOW_DAYS) {
    return { heldDays, daysToAnniversary, state: 'approaching', label: `CGT date in ${daysToAnniversary}d` };
  }
  return { heldDays, daysToAnniversary, state: 'building', label: `held ${heldDays}d` };
}

/** Badge classes per state, following the StatusBadge border-bg-text convention. */
export function cgtBadgeClass(state: CgtStatus['state']): string {
  if (state === 'eligible') return 'border-[#2f5d43] bg-[#0f2318] text-[#43d18b]';
  if (state === 'approaching') return 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]';
  return 'border-[#263241] bg-[#0d141c] text-[#8190a0]';
}
