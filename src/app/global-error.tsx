'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Root-layout error boundary - the last net when even the layout throws. Must render its own
 * <html>/<body> and use zero app imports (anything it imports can be the thing that crashed).
 * The only imports here are vendor (Sentry + React), never app code.
 *
 * Colours are DELIBERATELY literal hexes, not Tailwind token classes or var(--lyra-*):
 * when the root layout crashed, globals.css / lyra-tokens.css may never have loaded. The
 * values below are byte-copies of the token table (ground #07090c, panel #0d141c, line
 * #1b2530, ink #eef3f8, ink-3 #8190a0, accent #f3a33a, accent-tint #2a1f0f, accent-border
 * #9a6a1f) - if TOKENS.md changes, update them here too.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Report the crash that reached the root boundary (a no-op when Sentry has no DSN).
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#07090c', color: '#eef3f8', fontFamily: '-apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center', border: '1px solid #1b2530', background: '#0d141c', borderRadius: 12, padding: 24 }}>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#f3a33a' }}>Lyra</p>
            <h1 style={{ fontSize: 16, margin: '16px 0 8px' }}>Something broke at the root</h1>
            <p style={{ fontSize: 13, color: '#8190a0', margin: 0 }}>
              A full-page error stopped this render{error.digest ? ` (reference ${error.digest})` : ''}. Reloading usually clears it.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 20,
                padding: '8px 16px',
                fontSize: 13,
                color: '#f3a33a',
                background: '#2a1f0f',
                border: '1px solid #9a6a1f',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Reload Lyra
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
