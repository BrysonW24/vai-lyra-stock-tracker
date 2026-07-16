'use client';

/**
 * Root-layout error boundary - the last net when even the layout throws. Must render its own
 * <html>/<body> and use zero app imports (anything it imports can be the thing that crashed).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#080a0d', color: '#eef3f8', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center', border: '1px solid #1b2530', background: '#0d141c', borderRadius: 8, padding: 24 }}>
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
                background: '#23180b',
                border: '1px solid rgba(243,163,58,0.5)',
                borderRadius: 6,
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
