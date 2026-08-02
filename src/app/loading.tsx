import { BrandLogo } from '@/components/BrandLogo';

/**
 * Global streaming fallback. Next renders this instantly (it is a tiny separate chunk)
 * while the requested route's server component + JS load, so navigation always shows an
 * immediate, on-brand response instead of a blank gap. Especially noticeable in dev,
 * where routes compile on demand.
 */
export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-ground">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse">
          <BrandLogo size={48} />
        </div>
        {/* Brand-gradient echo (logo colours), not status colours. */}
        <div className="flex gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-positive [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-info [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-deep" />
        </div>
      </div>
    </div>
  );
}
