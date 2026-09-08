import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { PinGate } from '@/components/PinGate';
import { UsageTracker } from '@/components/UsageTracker';
import { NotificationEngagementBeacon } from '@/components/NotificationEngagementBeacon';
import ExternalLinkBoundary from '@/components/native/ExternalLinkBoundary';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { cookies } from 'next/headers';
import { ViewModeProvider } from '@/components/simple/ViewModeProvider';
import { parseViewMode, VIEW_MODE_COOKIE } from '@/lib/view-mode';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://lyra.vivacityai.com.au'),
  // Template so every page can set a one-word title and still carry the brand -
  // 40 tabs all reading the identical brand string made history/bookmarks useless.
  title: {
    default: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    template: `%s · ${BRAND_NAME}`,
  },
  description: 'Deterministic momentum, portfolio, watchlist, and market-intelligence console for US technology stocks.',
  openGraph: {
    title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    description: 'US tech signals - scored, explained, overlaid on your book. Research, not advice; alerts when your setups trigger.',
    siteName: BRAND_NAME,
    type: 'website',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: `${BRAND_NAME} logo` }],
  },
  twitter: {
    card: 'summary',
    title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    description: 'US tech signals - scored, explained, overlaid on your book.',
    images: ['/icons/icon-512.png'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Lyra',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d141c',
  // Edge-to-edge rendering for the iOS shell and installed PWA. Without cover,
  // env(safe-area-inset-*) is always 0 and every safe-area pad in the app is inert.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Read ONCE on the server so every AppShell below renders the right nav in the first
  // byte of HTML - no dense-then-simple flash on any of the 56 routes.
  const viewMode = parseViewMode((await cookies()).get(VIEW_MODE_COOKIE)?.value);
  return (
    <html lang="en">
      <head>
        {/* No-FOUC theme: apply the stored light theme before paint (dark is the default, so this
            only ever adds the light attribute). Runs synchronously in <head> ahead of first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <PinGate />
        <ViewModeProvider mode={viewMode}>{children}</ViewModeProvider>
        <NotificationEngagementBeacon />
        <UsageTracker />
        <ExternalLinkBoundary />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
