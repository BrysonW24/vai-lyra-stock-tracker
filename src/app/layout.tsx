import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { PinGate } from '@/components/PinGate';
import { UsageTracker } from '@/components/UsageTracker';
import { NotificationEngagementBeacon } from '@/components/NotificationEngagementBeacon';

export const metadata: Metadata = {
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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PinGate />
        {children}
        <NotificationEngagementBeacon />
        <UsageTracker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
