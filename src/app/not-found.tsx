import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';

/** Branded 404 - a mistyped or stale URL should still look and feel like Lyra. */
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-ground px-6 text-ink">
      <div className="w-full max-w-md rounded-panel border border-line bg-panel p-6 text-center">
        <div className="mb-4 flex justify-center">
          <BrandLogo size={34} />
        </div>
        <h1 className="text-base font-semibold">That page does not exist</h1>
        <p className="mt-2 text-sm text-ink-3">
          The link may be stale - surfaces move as Lyra ships. Everything lives one hop from Command.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link
            href="/"
            className="rounded-cell border border-accent-border bg-accent-tint px-4 py-2 text-sm text-accent transition hover:brightness-110"
          >
            Back to Command
          </Link>
          <Link
            href="/radar"
            className="rounded-cell border border-line-strong bg-panel px-4 py-2 text-sm text-ink-2 transition hover:text-ink"
          >
            Signal Radar
          </Link>
        </div>
      </div>
    </div>
  );
}
