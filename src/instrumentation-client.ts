// Sentry browser-runtime init - runs when a user loads a page. Optional by design: with no
// NEXT_PUBLIC_SENTRY_DSN configured (demo mode, self-host, or a fork of this public repo) Sentry
// stays a complete no-op, so nothing is ever sent from the browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Full traces in dev for visibility; 10% in production to stay within quota.
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
    enableLogs: true,
  });
}

// App Router navigation instrumentation - a no-op when Sentry has no DSN.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
