// Sentry edge-runtime init - runs for middleware and edge routes (loaded from
// src/instrumentation.ts). Optional by design: with no DSN configured (demo mode, self-host, or a
// fork of this public repo) Sentry stays a complete no-op, so nothing is ever sent.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Full traces in dev for visibility; 10% in production to stay within quota.
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
    enableLogs: true,
  });
}
