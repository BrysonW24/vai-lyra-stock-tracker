'use client';

import Link from 'next/link';
import { ArrowUpRight, LineChart } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import { DetailDrawer } from '@/components/DetailDrawer';
import { StatusBadge } from '@/components/StatusBadge';
import { TickerLogo } from '@/components/TickerLogo';
import { formatNumber, formatSignedNumber, toneClass, trendArrow } from '@/lib/format';

// Plain-English "what is this" for the metrics that drive the score.
const HELP = {
  score: 'A 0-100 momentum-recovery score built from RSI, MACD, price location, trend and volume. Higher = a stronger setup forming. Research, not advice.',
  rsi: 'RSI (0-100): how hard the stock has been bought or sold lately. Low and turning up can mean it is recovering; very high can mean it has run hot.',
  macd: 'MACD histogram: recent momentum vs the slightly longer trend. Shrinking toward zero / turning up means selling pressure is easing - an early turn signal.',
  volume: 'Volume vs its own average. Above 1x means heavier-than-usual participation confirming the move.',
};

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[10px] text-[#8190a0]">
        <span>{label}</span>
        <span className="text-[#dbe5ee]">{Math.round(value)}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#1b2530]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#3b5bdb] to-[#43d18b]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Signal explainer drawer - tap a row to learn what the Score / RSI / MACD / Volume
 * actually mean for this stock, the component breakdown, the plain-English read, why the
 * setup fired, and what is still missing. Built on the reusable DetailDrawer.
 */
export function SignalDrawer({ signal, onClose }: { signal: SignalRow | null; onClose: () => void }) {
  if (!signal) return null;

  const b = signal.scoreBreakdown;

  return (
    <DetailDrawer
      open={!!signal}
      onClose={onClose}
      title={`${signal.symbol} · ${signal.score}/100`}
      subtitle={signal.companyName}
      badge={
        <span className="mb-1 inline-flex items-center gap-1.5">
          <TickerLogo symbol={signal.symbol} companyName={signal.companyName} size={16} />
          <StatusBadge status={signal.status} />
          <span className={`font-mono text-[11px] ${toneClass(signal.scoreDelta)}`}>{formatSignedNumber(signal.scoreDelta, 0)}</span>
        </span>
      }
    >
      <p className="text-[11px] leading-snug text-[#a8b5c2]">{HELP.score}</p>

      {/* Score component breakdown */}
      <div className="space-y-2 rounded-md border border-[#263241] bg-[#0d141c] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">What makes the score</p>
        <Bar label="RSI" value={b.rsiScore} />
        <Bar label="MACD" value={b.macdScore} />
        <Bar label="Price location" value={b.priceLocationScore} />
        <Bar label="Trend" value={b.trendScore} />
        <Bar label="Volume" value={b.volumeScore} />
      </div>

      {/* Live metric values + plain-English help */}
      <div className="space-y-2">
        {[
          { k: 'RSI', v: `${formatNumber(signal.rsi)} ${trendArrow(signal.rsiDelta)}`, help: HELP.rsi },
          { k: 'MACD hist', v: `${formatNumber(signal.macdHistogram, 2)} ${trendArrow(signal.histDelta)}`, help: HELP.macd },
          { k: 'Volume', v: `${formatNumber(signal.volumeRatio, 2)}x`, help: HELP.volume },
        ].map((m) => (
          <div key={m.k} className="rounded-md border border-[#263241] bg-[#0d141c] p-2.5">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-[#8190a0]">{m.k}</span>
              <span className="text-[#eef3f8]">{m.v}</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[#a8b5c2]">{m.help}</p>
          </div>
        ))}
      </div>

      {/* Plain-English read */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">The read</p>
        <div className="space-y-1.5 text-[11px] leading-snug text-[#c8d3de]">
          <p>{signal.summary.rsi}</p>
          <p>{signal.summary.macd}</p>
          <p>{signal.summary.volume}</p>
          <p>{signal.summary.trend}</p>
        </div>
      </div>

      {/* Why it fired / what's missing / risks */}
      {signal.explanation.triggeredBecause.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#43d18b]">Why this setup</p>
          <ul className="space-y-1 text-[11px] leading-snug text-[#c8d3de]">
            {signal.explanation.triggeredBecause.map((t) => (
              <li key={t} className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#43d18b]" />{t}</li>
            ))}
          </ul>
        </div>
      )}
      {signal.explanation.missingConfirmation.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f3a33a]">Still missing</p>
          <ul className="space-y-1 text-[11px] leading-snug text-[#c8d3de]">
            {signal.explanation.missingConfirmation.map((t) => (
              <li key={t} className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#f3a33a]" />{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border border-[#263241] bg-[#0d141c] px-3 py-2 font-mono text-xs">
        <span className="text-[#8190a0]">Action state</span>
        <span className="text-[#f3a33a]">{signal.actionState.replaceAll('_', ' ')}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/tickers/${signal.symbol}?view=setup`}
          className="inline-flex items-center gap-1.5 rounded border border-[#3b5bdb] bg-[#0d1530] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8aa2ff] transition hover:bg-[#11193a]"
        >
          <LineChart size={13} /> Full setup chart
        </Link>
        <Link
          href={`/tickers/${signal.symbol}`}
          className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#a8b5c2] transition hover:text-[#eef3f8]"
        >
          Open {signal.symbol} <ArrowUpRight size={12} />
        </Link>
      </div>
    </DetailDrawer>
  );
}
