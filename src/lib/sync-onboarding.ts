'use client';

import type { OperatorProfile, CapitalContext, AlertPreferences, StrategySelection } from './onboarding';

export interface OnboardingSyncResult {
  ok: boolean;
  demo?: boolean;
  error?: string;
}

/**
 * Sync the full operator profile + capital + strategy + alert preferences to the backend.
 * Non-throwing, but returns the outcome so callers can surface real persistence failures.
 */
export async function syncOperatorProfile(
  profile: OperatorProfile,
  completionPct?: number,
  extras?: { capital?: CapitalContext; alerts?: AlertPreferences; strategy?: StrategySelection },
): Promise<OnboardingSyncResult> {
  try {
    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, completionPct, capital: extras?.capital, alerts: extras?.alerts, strategy: extras?.strategy }),
    });

    const data = await response.json().catch(() => ({ ok: false, error: `Bad response (HTTP ${response.status})` }));

    if (data?.demo) return { ok: false, demo: true };

    if (!response.ok || !data?.ok) {
      const error = data?.error || `HTTP ${response.status}`;
      console.warn('[onboarding sync] error:', error);
      return { ok: false, error };
    }

    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn('[onboarding sync] network error:', error);
    return { ok: false, error };
  }
}

/**
 * Resilient client helper to sync account settings to the backend.
 * Non-blocking; errors are logged but do not interrupt the UI.
 */
export async function syncAccountProfile(data: {
  displayName?: string;
  email?: string;
  baseCurrency?: string;
  timezone?: string;
  theme?: string;
  defaultTimeframe?: string;
}): Promise<void> {
  try {
    const response = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn('[account sync] HTTP error:', error);
      // Silently fail - localStorage is the fallback.
      return;
    }

    const result = await response.json();
    if (result.demo) {
      // Demo mode - no network available, that's fine.
      return;
    }

    if (!result.ok) {
      console.warn('[account sync] API error:', result.error);
      // Silently fail - localStorage is the fallback.
      return;
    }

    console.debug('[account sync] Synced successfully');
  } catch (err) {
    console.warn('[account sync] Network error:', err instanceof Error ? err.message : String(err));
    // Silently fail - localStorage is the fallback.
  }
}
