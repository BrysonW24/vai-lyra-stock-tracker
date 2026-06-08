/**
 * A tiny snapshot of what the user chose in onboarding, saved on finish so the command
 * centre can personalise itself instead of nagging "New here?" forever. Browser-local;
 * demo-mode only (Supabase users get the server-backed SetupChecklist).
 */

export interface OnboardingSummary {
  onboarded: boolean;
  tradedBefore: 'yes' | 'no';
  portfolioCount: number;
  watchlistCount: number;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'professional';
}

const KEY = 'lyra.onboarding.summary';

export function loadOnboardingSummary(): OnboardingSummary | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingSummary) : null;
  } catch {
    return null;
  }
}

export function saveOnboardingSummary(summary: OnboardingSummary): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(summary));
  } catch {
    /* storage unavailable - ignore */
  }
}
