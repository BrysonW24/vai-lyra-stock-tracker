import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';

/** Branded 404 - a mistyped or stale URL should still look and feel like Lyra. */
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#080a0d] px-6 text-[#eef3f8]">
      <div className="w-full max-w-md rounded-lg border border-[#1b2530] bg-[#0d141c] p-6 text-center">
        <div className="mb-4 flex justify-center">
          <BrandLogo size={34} />
        </div>
        <h1 className="text-base font-semibold">That page does not exist</h1>
        <p className="mt-2 text-sm text-[#8190a0]">
          The link may be stale - surfaces move as Lyra ships. Everything lives one hop from Command.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link
            href="/"
            className="rounded-md border border-[#f3a33a]/50 bg-[#23180b] px-4 py-2 text-sm text-[#f3a33a] transition hover:bg-[#2d1f0e]"
          >
            Back to Command
          </Link>
          <Link
            href="/radar"
            className="rounded-md border border-[#263241] bg-[#0d141c] px-4 py-2 text-sm text-[#a8b5c2] transition hover:text-[#eef3f8]"
          >
            Signal Radar
          </Link>
        </div>
      </div>
    </div>
  );
}
