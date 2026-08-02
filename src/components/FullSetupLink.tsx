import Link from 'next/link';
import { LineChart } from 'lucide-react';

/**
 * One-tap jump to a ticker's full setup view - the chart with Bollinger Bands +
 * RSI + MACD all activated. Drop this anywhere a symbol is shown so the trader can
 * go straight from a signal/event to the live chart with the full read.
 */
export function FullSetupLink({ symbol, compact = true }: { symbol: string; compact?: boolean }) {
  return (
    <Link
      href={`/tickers/${symbol}?view=setup`}
      title={`Open ${symbol} full setup - Bollinger, RSI, MACD`}
      aria-label={`Open ${symbol} full setup`}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded border border-blue-deep bg-blue-tint font-mono font-semibold uppercase tracking-[0.1em] text-pending transition hover:bg-blue-deep/30',
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]',
      ].join(' ')}
    >
      <LineChart size={compact ? 10 : 12} /> Full setup
    </Link>
  );
}
