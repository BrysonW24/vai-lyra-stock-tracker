import type { SignalRow } from '@/types/scanner';
import { formatNumber, formatSignedNumber, relativeTime, toneClass, trendArrow } from '@/lib/format';

/**
 * Since last scan - the honest replacement for the fabricated "momentum shift" histogram
 * (which drew six invented bars easing into one real value). This shows the ONLY time
 * comparison Lyra actually measures: the previous scan and the current one. Two real reads
 * per metric, nothing interpolated. Previous is derived as current - delta so it can never
 * disagree with the numbers shown elsewhere on the page.
 */

function DeltaRow({
  label,
  prev,
  now,
  delta,
  digits,
}: {
  label: string;
  prev: number;
  now: number;
  delta: number;
  digits: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-cell border border-line bg-panel px-3 py-2">
      <span className="text-[12px] text-ink-2">{label}</span>
      <span className="flex items-center gap-2 font-mono text-[12px] tabular-nums">
        <span className="text-ink-3">{formatNumber(prev, digits)}</span>
        <span className="text-ink-dim">→</span>
        <span className="font-semibold text-ink-title">{formatNumber(now, digits)}</span>
        <span className={`w-16 text-right ${toneClass(delta)}`}>
          {trendArrow(delta)} {formatSignedNumber(delta, digits)}
        </span>
      </span>
    </div>
  );
}

export function ScanDeltaPanel({ signal }: { signal: SignalRow }) {
  return (
    <section className="terminal-panel flex flex-col gap-3 rounded-panel p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Since last scan</p>
        <p className="mt-1 text-[11px] leading-snug text-ink-2">
          Two measured reads - the previous scan and now, {relativeTime(signal.lastUpdated)}.
        </p>
      </div>

      <div className="space-y-1.5">
        <DeltaRow label="Score" prev={signal.score - signal.scoreDelta} now={signal.score} delta={signal.scoreDelta} digits={0} />
        <DeltaRow label="RSI" prev={signal.rsi - signal.rsiDelta} now={signal.rsi} delta={signal.rsiDelta} digits={1} />
        <DeltaRow label="MACD histogram" prev={signal.macdHistogram - signal.histDelta} now={signal.macdHistogram} delta={signal.histDelta} digits={2} />
      </div>

      <p className="mt-auto border-t border-line pt-2 text-[10px] leading-snug text-ink-dim">
        Only these two scans are measured. Lyra shows no invented steps between them - if intraday history
        is not recorded, it is not drawn.
      </p>
    </section>
  );
}
