import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { PinGate } from '@/components/PinGate';
import { UsageTracker } from '@/components/UsageTracker';

export const metadata: Metadata = {
  title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
  description: 'Deterministic momentum, portfolio, watchlist, and market-intelligence console for US technology stocks.',
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
        <UsageTracker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
