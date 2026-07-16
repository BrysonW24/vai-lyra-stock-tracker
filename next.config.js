/** @type {import('next').NextConfig} */
const path = require('path');

// Content-Security-Policy. Shipped REPORT-ONLY first (defense-in-depth without breakage): the
// browser logs violations but blocks nothing, so we can watch the console on the live surfaces
// (TradingView widget, Google favicons, Supabase, Vercel analytics) and tighten before flipping
// to enforcing. Sources reflect what the app actually loads:
//   - script/frame: TradingView embed widget    - img: data + https favicons/logos
//   - connect: Supabase (REST + realtime WS) + Vercel insights   - style: Next.js inline styles
// AI provider calls are server-side (never browser), so no provider host is needed in connect-src.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://www.tradingview-widget.com https://*.vercel-insights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.tradingview.com https://*.vercel-insights.com",
  "frame-src https://*.tradingview.com https://www.tradingview-widget.com",
].join('; ');

// Baseline security headers (Phase 9 hardening). Applied to every route.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
];

const nextConfig = {
  reactStrictMode: true,
  // Standalone server output for Docker/Coolify self-hosting (.next/standalone/server.js).
  // Vercel ignores this and keeps using its own build output, so both hosts work from one config.
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  // Allow an isolated build output dir (e.g. CI / verification builds) so a
  // running `next dev` server's .next folder is never touched. Unset in normal use.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;
