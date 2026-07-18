import type { CapacitorConfig } from '@capacitor/cli';

/**
 * iOS shell configuration (TestFlight beta). Remote-shell mode: the native app is a thin
 * WKWebView pointed at production, so every Vercel deploy updates the iOS app instantly with
 * no App Store resubmission. webDir only holds the offline fallback page - the real app is
 * served from the server.url below. Native plugins (haptics, share, APNs push) come in a
 * later wave; they require JS-side integration in the web app itself.
 */
const config: CapacitorConfig = {
  appId: 'com.vivacityai.lyra',
  appName: 'Lyra',
  webDir: 'native/shell',
  server: {
    url: 'https://lyra.vivacityai.com.au',
    cleartext: false,
    // Remote shells do NOT fall back to webDir automatically - without errorPath a
    // no-network cold start shows a bare WKWebView error (QA finding, 2026-07-18).
    errorPath: 'index.html',
  },
  ios: {
    // 'never', not 'automatic': the web layer owns safe areas via viewport-fit=cover +
    // env(safe-area-inset-*) CSS (v0.70.0). Automatic insets would stack on top of the
    // CSS pads and double-inset every safe-area-aware surface.
    contentInset: 'never',
  },
};

export default config;
