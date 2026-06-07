'use client';

import type { OperatorProfile } from './onboarding';

/**
 * Resilient client helper to sync operator profile to the backend.
 * Non-blocking; errors are logged but do not interrupt the UI.
 */
export async function syncOperatorProfile(profile: OperatorProfile, completionPct?: number): Promise<void> {
  try {
    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, completionPct }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn('[onboarding sync] HTTP error:', error);
      // Silently fail - localStorage is the fallback.
      return;
    }

    const data = await response.json();
    if (data.demo) {
      // Demo mode - no network available, that's fine.
      return;
    }

    if (!data.ok) {
      console.warn('[onboarding sync] API error:', data.error);
      // Silently fail - localStorage is the fallback.
      return;
    }

    console.debug('[onboarding sync] Synced successfully');
  } catch (err) {
    console.warn('[onboarding sync] Network error:', err instanceof Error ? err.message : String(err));
    // Silently fail - localStorage is the fallback.
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
