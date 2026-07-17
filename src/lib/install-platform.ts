/**
 * Home-screen install platform detection - pure and unit-testable. Drives the onboarding
 * "Put Lyra on your Home Screen" step: iOS gets the Safari screenshot walkthrough (web push
 * on iOS ONLY works for an installed web app, so this is functional, not cosmetic), Android
 * gets the Chrome menu steps, an already-installed app skips the step entirely, and anything
 * else (desktop) gets a "grab your phone" pointer.
 */

export type InstallPlatform = 'installed' | 'ios' | 'android' | 'other';

/** Classify from a user-agent string + the standalone display-mode flag. Pure. */
export function detectInstallPlatform(userAgent: string, standalone: boolean): InstallPlatform {
  if (standalone) return 'installed';
  const ua = userAgent.toLowerCase();
  // iPadOS 13+ masquerades as macOS Safari; the touch check in the browser-side caller
  // handles that - here the explicit tokens are enough for phones, which is what matters.
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'other';
}

/** Browser-side convenience: reads the real UA + display-mode. Safe to call anywhere client-side. */
export function detectInstallPlatformFromBrowser(): InstallPlatform {
  if (typeof window === 'undefined') return 'other';
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  return detectInstallPlatform(window.navigator.userAgent, standalone);
}
