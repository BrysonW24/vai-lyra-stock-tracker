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


// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "vivacityai",
  project: "lyra-observability-sentry",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
