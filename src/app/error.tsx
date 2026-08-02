'use client';

/**
 * Route-level error boundary. Before this existed, any render/data throw fell through to
 * Next's unbranded white error screen - the only truly unbranded surface in the app.
 * Deliberately dependency-light: an error boundary must not be able to crash itself.
 */
import Link from 'next/link';
import { useEffect } from 'react';
import { BrandLogo } from '@/components/BrandLogo';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Server logs carry the stack; the digest ties this render to that log line.
    console.error('[lyra] route error boundary:', error.digest ?? '', error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-ground px-6 text-ink">
      <div className="w-full max-w-md rounded-panel border border-line bg-panel p-6 text-center">
        <div className="mb-4 flex justify-center">
          <BrandLogo size={34} />
        </div>
        <h1 className="text-base font-semibold">Something broke on this page</h1>
        <p className="mt-2 text-sm text-ink-3">
          The rest of Lyra is fine - this view hit an error while rendering.
          {error.digest ? ` Reference: ${error.digest}.` : ''}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-cell border border-accent-border bg-accent-tint px-4 py-2 text-sm text-accent transition hover:brightness-110"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-cell border border-line-strong bg-panel px-4 py-2 text-sm text-ink-2 transition hover:text-ink"
          >
            Back to Command
          </Link>
        </div>
      </div>
    </div>
  );
}
