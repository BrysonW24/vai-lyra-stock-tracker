/**
 * Credibility strip for the light landing - the world's major exchanges whose data
 * the engine is built on (US + ASX scanned today; the live lookup + data source span
 * these globally). Real exchange marks via the favicon CDN, muted for a trust-bar feel.
 */

import { faviconUrl } from '@/lib/ticker-logos';

const EXCHANGES = [
  { label: 'NASDAQ', domain: 'nasdaq.com' },
  { label: 'LSE', domain: 'londonstockexchange.com' },
  { label: 'ASX', domain: 'asx.com.au' },
];

export function ExchangeStrip() {
  return (
    <div className="mb-6">
      <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-[#5A6B82]">
        Built on data from the world&apos;s major exchanges
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {EXCHANGES.map((ex) => (
          <div key={ex.label} className="flex items-center gap-2 opacity-90 transition hover:opacity-100">
            <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md border border-black/5 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- favicon CDN, not a bundled asset */}
              <img src={faviconUrl(ex.domain, 18)} alt={ex.label} width={18} height={18} />
            </span>
            <span className="text-[12px] font-semibold tracking-wide text-[#5A6B82]">{ex.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
