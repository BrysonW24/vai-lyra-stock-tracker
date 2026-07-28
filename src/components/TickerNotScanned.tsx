import Link from 'next/link';
import { Radar, SearchX } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';

/**
 * Honest destination for a ticker Lyra has not scanned - shown instead of a bare 404 when a
 * user types a symbol (via the header quick-search) that is not in the latest run's signal set
 * (the 2026-07-27 audit V3 fix: the autocomplete used to dead-end on notFound()). It tells the
 * truth - Lyra scans a focused universe, this name is not in it yet - and offers the covered
 * names as the next step rather than a blind alley.
 */
export function TickerNotScanned({
  symbol,
  scannedCount,
  examples,
}: {
  symbol: string;
  scannedCount: number;
  examples: { symbol: string; companyName: string }[];
}) {
  const clean = symbol.trim().toUpperCase();
  return (
    <div className="mx-auto max-w-2xl px-3 py-10">
      <div className="terminal-panel rounded-md p-6 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-[#263241] bg-[#0d141c]">
          <SearchX size={22} className="text-[#f3a33a]" />
        </div>
        <h1 className="font-mono text-lg font-semibold text-[#eef3f8]">
          {clean} is not in the current scan
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#a8b5c2]">
          Lyra scans a focused universe of {scannedCount} name{scannedCount === 1 ? '' : 's'} for
          oversold-recovery setups. {clean} is not one of them in the latest run, so there is no
          score, RSI, or history to show yet - and Lyra will not fabricate one for a name it did
          not measure.
        </p>

        {examples.length > 0 && (
          <div className="mt-6 text-left">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">
              Names Lyra is scanning now
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {examples.map((t) => (
                <Link
                  key={t.symbol}
                  href={`/tickers/${t.symbol}`}
                  className="flex items-center gap-2 rounded-md border border-[#1b2530] bg-[#0d141c] px-2.5 py-1.5 transition-colors hover:border-[#263241] hover:bg-[#101720]"
                >
                  <TickerLogo symbol={t.symbol} companyName={t.companyName} size={18} />
                  <span className="truncate font-mono text-[12px] font-semibold text-[#dbe5ee]">
                    {t.symbol}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <Link
          href="/radar"
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-[#263241] bg-[#0d141c] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f3a33a] transition-colors hover:bg-[#101720]"
        >
          <Radar size={14} />
          See the full radar
        </Link>
      </div>
    </div>
  );
}
