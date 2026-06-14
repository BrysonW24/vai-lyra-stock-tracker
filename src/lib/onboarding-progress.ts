/**
 * Resumable onboarding. We checkpoint the in-progress onboarding (the chosen path, every answer
 * entered, the current step, and the phase) to localStorage on each change, so a user who leaves
 * and comes back picks up exactly where they left off instead of starting over. Cleared on
 * completion. Per-device (localStorage); the durable per-user mirror is the Supabase
 * onboarding_progress row written at finish.
 */
import type { OnboardingState } from './onboarding';
import { SETUP_PATHS } from './onboarding';

const KEY = 'lyra.onboarding.progress';

export type OnboardingPhase = 'reveal' | 'primer' | 'questionnaire' | 'complete';

export interface OnboardingProgress {
  state: OnboardingState;
  currentStep: number;
  phase: OnboardingPhase;
  savedAt: string;
}

export function saveOnboardingProgress(progress: OnboardingProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable - ignore */
  }
}

/**
 * Load a resumable checkpoint, or null when there's nothing valid to resume. A checkpoint is only
 * resumable if it isn't complete, has a state + a known path, and its step still exists in that
 * path (so a removed step - e.g. the AI step we moved out - never strands a returning user).
 */
export function loadOnboardingProgress(): OnboardingProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as OnboardingProgress;
    if (!p?.state || p.phase === 'complete') return null;
    const path = p.state.path;
    if (!path || !(path in SETUP_PATHS)) return null;
    if (!SETUP_PATHS[path].steps.includes(p.currentStep)) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearOnboardingProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
