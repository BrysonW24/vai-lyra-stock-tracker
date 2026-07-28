import Link from 'next/link';
import { TickerLogo } from '@/components/TickerLogo';
import type { WatchlistRow } from '@/types/scanner';
import { formatCurrency, formatSignedNumber } from '@/lib/format';

/**
 * Watchlist trigger board - the meaningful version. A watchlist name only "triggers"
 * when TWO gates line up: price comes into your buy zone, and the signal score
 * confirms. This board makes that legible - a plain-English read of where each name
 * stands, a progress bar for each gate, and the momentum behind it. Research only.
 */

const STATE_CHIP: Record<WatchlistRow['triggerState'], string> = {
  triggered: 'border-[#1d4f3a] bg-[#0d251b] text-[#43d18b]',
  approaching: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
  not_ready: 'border-[#263241] bg-[#0d141c] text-[#a8b5c2]',
  missed: 'border-[#3a4754] bg-[#0d141c] text-[#8190a0]',
  invalidated: 'border-[#7f1d1d] bg-[#2b1214] text-[#ff6b6b]',
};

function read(item: WatchlistRow): string {
  const dist = Math.abs(item.distanceToTarget);
  const scoreGap = item.targetSignalScore - item.signalScore;
  const momentum = item.scoreDelta > 0 ? 'building' : item.scoreDelta < 0 ? 'fading' : 'flat';
  const momentumTail = item.scoreDelta === 0 ? '' : ` and ${momentum}`;
  // No explicit price target => this rule watches on signal score alone. Never describe the
  // current price as "your buy zone" (the 2026-07-27 audit V4 fix); phrase around the score.
  if (item.targetBuyZone === null) {
    switch (item.triggerState) {
      case 'triggered':
        return `Strong setup - the signal has confirmed at ${item.signalScore} (your ${item.targetSignalScore} target). Your move.`;
      case 'approaching':
        return `Warming up - signal at ${item.signalScore}${momentumTail}, ${scoreGap > 0 ? `${scoreGap} short of your ${item.targetSignalScore} target` : `holding your ${item.targetSignalScore} target`}.`;
      case 'invalidated':
        return `Thesis weakening - the signal rolled over (${item.signalScore}, ${formatSignedNumber(item.scoreDelta, 0)}) below your ${item.targetSignalScore} target.`;
      case 'not_ready':
      default:
        return `On the bench - watching on signal only; still soft at ${item.signalScore} of a ${item.targetSignalScore} target. Add a buy price to also gate on price.`;
    }
  }
  const zone = formatCurrency(item.targetBuyZone);
  switch (item.triggerState) {
    case 'triggered':
      return `Both gates met - price is in your ${zone} buy zone and the signal has confirmed at ${item.signalScore}. Your move.`;
    case 'approaching':
      return `Closing in - ${dist.toFixed(1)}% from your ${zone} buy zone, signal ${momentum} at ${item.signalScore}${scoreGap > 0 ? `, ${scoreGap} short of your ${item.targetSignalScore} target` : ''}.`;
    case 'missed':
      return `Ran without you - cleared your ${zone} zone before the signal confirmed. Wait for a pullback or re-set the target.`;
    case 'invalidated':
      return `Thesis weakening - the signal rolled over (${item.signalScore}, ${formatSignedNumber(item.scoreDelta, 0)}) below your ${item.targetSignalScore} target.`;
    case 'not_ready':
    default:
      return `On the bench - ${dist.toFixed(1)}% from your ${zone} buy zone and the signal is still soft at ${item.signalScore} of a ${item.targetSignalScore} target.`;
  }
}

function Gate({ label, current, target, pct, tone }: { label: string; current: string; target: string; pct: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[10px]">
        <span className="text-[#8190a0]">{label}</span>
        <span className="text-[#a8b5c2]">
          {current} <span className="text-[#5e6b78]">/ {target}</span>
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#1b2530]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

export function WatchlistTriggerBoard({ rows }: { rows: WatchlistRow[] }) {
  return (
    <div className="terminal-panel overflow-hidden rounded-md">
      <div className="border-b border-[#1b2530] px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Watchlist - about to set up</p>
        <p className="mt-0.5 text-[10px] leading-snug text-[#a8b5c2]">
          A name triggers when both gates align: price drops into your buy zone, and the signal score confirms.
        </p>
      </div>
      <div className="divide-y divide-[#1b2530]">
        {rows.length === 0 ? (
          <p className="px-3 py-4 text-center text-[11px] text-[#8190a0]">No watchlist names yet. Add targets to track setups here.</p>
        ) : (
          rows.map((item) => {
            const dist = Math.abs(item.distanceToTarget);
            const priceProgress = 100 - dist * 12; // at the zone = full; ~8% away = near empty
            const signalProgress = (item.signalScore / Math.max(1, item.targetSignalScore)) * 100;
            const signalConfirmed = item.signalScore >= item.targetSignalScore;
            return (
              <div className="px-3 py-2.5" key={item.symbol}>
                <div className="flex items-center gap-2">
                  <TickerLogo symbol={item.symbol} companyName={item.companyName} size={14} />
                  <Link href={`/tickers/${item.symbol}`} className="font-mono text-[12px] font-semibold text-[#eef3f8]">
                    {item.symbol}
                  </Link>
                  <span className="truncate text-[11px] text-[#8190a0]">{item.companyName}</span>
                  <span className={`ml-auto shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${STATE_CHIP[item.triggerState]}`}>
                    {item.alertStatus}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[#c8d3de]">{read(item)}</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Gate
                    label="Price into zone"
                    current={formatCurrency(item.currentPrice)}
                    target={item.targetBuyZone === null ? 'any' : formatCurrency(item.targetBuyZone)}
                    pct={item.targetBuyZone === null ? 100 : priceProgress}
                    tone="bg-[#7fb0ff]"
                  />
                  <Gate
                    label="Signal confirm"
                    current={item.signalScore.toString()}
                    target={item.targetSignalScore.toString()}
                    pct={signalProgress}
                    tone={signalConfirmed ? 'bg-[#43d18b]' : 'bg-[#f3a33a]'}
                  />
                </div>
                <p className="mt-1.5 font-mono text-[10px] text-[#8190a0]">
                  RSI {Math.round(item.rsi)} · MACD hist {item.macdHistogram.toFixed(2)} · Vol {item.volumeRatio.toFixed(1)}x · score{' '}
                  {formatSignedNumber(item.scoreDelta, 0)} since scan
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
