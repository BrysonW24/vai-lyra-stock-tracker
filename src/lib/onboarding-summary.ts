/**
 * A tiny snapshot of what the user chose in onboarding, saved on finish so the command
 * centre can personalise itself instead of nagging "New here?" forever. Browser-local;
 * demo-mode only (Supabase users get the server-backed SetupChecklist).
 */
import type { CapitalContext } from '@/lib/onboarding';

export interface OnboardingSummary {
  onboarded: boolean;
  tradedBefore: 'yes' | 'no';
  portfolioCount: number;
  watchlistCount: number;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  /** Risk appetite from the operator profile - drives the copilot's tone. */
  riskComfort?: 'conservative' | 'balanced' | 'aggressive' | 'experimental';
  /** Solo-only operating constraints sent transiently with BYOK requests; never server-persisted. */
  capital?: CapitalContext;
}

const KEY = 'lyra.onboarding.summary';
export const ONBOARDING_SUMMARY_CHANGED_EVENT =
  'lyra:onboarding-summary-changed';

export function loadOnboardingSummary(): OnboardingSummary | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingSummary>;
    if (
      parsed?.onboarded !== true ||
      (parsed.tradedBefore !== 'yes' && parsed.tradedBefore !== 'no') ||
      !Number.isInteger(parsed.portfolioCount) ||
      !Number.isInteger(parsed.watchlistCount)
    ) {
      return null;
    }
    return parsed as OnboardingSummary;
  } catch {
    return null;
  }
}

export function saveOnboardingSummary(summary: OnboardingSummary): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(summary));
    window.dispatchEvent(new Event(ONBOARDING_SUMMARY_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}
