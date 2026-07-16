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
    <div className="grid min-h-screen place-items-center bg-[#080a0d] px-6 text-[#eef3f8]">
      <div className="w-full max-w-md rounded-lg border border-[#1b2530] bg-[#0d141c] p-6 text-center">
        <div className="mb-4 flex justify-center">
          <BrandLogo size={34} />
        </div>
        <h1 className="text-base font-semibold">Something broke on this page</h1>
        <p className="mt-2 text-sm text-[#8190a0]">
          The rest of Lyra is fine - this view hit an error while rendering.
          {error.digest ? ` Reference: ${error.digest}.` : ''}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-md border border-[#f3a33a]/50 bg-[#23180b] px-4 py-2 text-sm text-[#f3a33a] transition hover:bg-[#2d1f0e]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-[#263241] bg-[#0d141c] px-4 py-2 text-sm text-[#a8b5c2] transition hover:text-[#eef3f8]"
          >
            Back to Command
          </Link>
        </div>
      </div>
    </div>
  );
}
