'use client';

/**
 * Notification preferences - browser-local persistence (demo-safe). The router
 * consumes these; a Supabase-backed store can replace the load/save pair without
 * touching routing logic. Same-tab updates broadcast via a custom event so any
 * mounted preference UI stays in sync.
 */
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from './types';

const KEY = 'lyra.notificationPrefs.v1';
const EVENT = 'lyra:notificationprefs';

export function loadNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(JSON.parse(raw) as Partial<NotificationPreferences>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export function saveNotificationPreferences(patch: Partial<NotificationPreferences>): NotificationPreferences {
  const next = { ...loadNotificationPreferences(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable - ignore */
  }
  return next;
}

export const NOTIFICATION_PREFS_EVENT = EVENT;
