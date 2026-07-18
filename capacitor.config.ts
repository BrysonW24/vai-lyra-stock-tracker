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
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
