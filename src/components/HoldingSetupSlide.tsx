'use client';

import type { ActionState, PortfolioHolding, SignalRow, TickerSetting } from '@/types/scanner';
import { formatSignedNumber, toneClass } from '@/lib/format';

/** Human label + tone for the backend-owned action state. */
const ACTION_META: Record<ActionState, { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }> = {
  buy_review: { label: 'Buy · review', tone: 'good' },
  watch: { label: 'Watch', tone: 'neutral' },
  hold: { label: 'Hold', tone: 'neutral' },
  do_not_add: { label: 'Do not add', tone: 'warn' },
  trim_review: { label: 'Trim · review', tone: 'warn' },
  sell_review: { label: 'Sell · review', tone: 'bad' },
  invalidated: { label: 'Invalidated', tone: 'bad' },
};

const TONE_CLASS: Record<'good' | 'warn' | 'bad' | 'neutral', string> = {
  good: 'border-[#1f5132] bg-[#0f2417] text-[#5fd08a]',
  warn: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
  bad: 'border-[#7a2630] bg-[#260f12] text-[#f0758a]',
  neutral: 'border-[#263241] bg-[#0d141c] text-[#a8b5c2]',
};

// max points per component in the momentum-recovery_v1 model (sums to 100).
const BREAKDOWN_LABELS: { key: keyof SignalRow['scoreBreakdown']; label: string; max: number }[] = [
  { key: 'rsiScore', label: 'RSI', max: 25 },
  { key: 'macdScore', label: 'MACD', max: 30 },
  { key: 'priceLocationScore', label: 'Price', max: 15 },
  { key: 'trendScore', label: 'Trend', max: 15 },
  { key: 'volumeScore', label: 'Volume', max: 15 },
];

function fmt(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

interface HoldingSetupSlideProps {
  signal: SignalRow;
  holding?: PortfolioHolding;
  ticker?: TickerSetting;
}

export function HoldingSetupSlide({ signal, ticker }: HoldingSetupSlideProps) {
  const action = ACTION_META[signal.actionState] ?? ACTION_META.watch;
  const breakdown = signal.scoreBreakdown;
  const triggered = signal.explanation?.triggeredBecause?.slice(0, 3) ?? [];

  // Real metric values that tie straight to the chart - keeps the slide informative
  // even when the recovery setup scores low (e.g. a name trading near its highs).
  const metrics = [
    { label: 'RSI', value: fmt(signal.rsi) },
    { label: 'MACD', value: fmt(signal.macdHistogram, 2) },
    { label: 'Price', value: `$${fmt(signal.close, 2)}` },
    { label: 'Vol', value: `${fmt(signal.volumeRatio, 2)}x` },
    { label: 'vs low', value: `${fmt(signal.distanceFromLow, 0)}%` },
  ];
  const watchItems = [
    ...(signal.explanation?.missingConfirmation ?? []),
    ...(signal.explanation?.riskNotes ?? []),
  ].slice(0, 3);

  return (
    <div className="flex h-full flex-col gap-2.5 rounded border border-[#1b2530] bg-[#0d1117] p-3">
      {/* Action + score header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${TONE_CLASS[action.tone]}`}>
          {action.label}
        </span>
        <span className="font-mono text-[11px] text-[#8190a0]">
          Setup <span className="text-sm font-semibold text-[#eef3f8]">{signal.score}</span>/100{' '}
          <span className={toneClass(signal.scoreDelta)}>{formatSignedNumber(signal.scoreDelta, 0)}</span>
        </span>
      </div>

      {ticker ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5f6b78]">
          {ticker.sector} · {ticker.industry} · {signal.lifecycleState.replaceAll('_', ' ')}
        </p>
      ) : null}

      {/* Real metric values (match the live chart) */}
      <div className="grid grid-cols-3 gap-1.5 font-mono sm:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded border border-[#1b2530] bg-[#0d141c] px-1.5 py-1">
            <p className="text-[9px] uppercase tracking-wide text-[#5f6b78]">{metric.label}</p>
            <p className="mt-0.5 text-[11px] text-[#dbe5ee]">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* Score breakdown bars - points out of each component's max (sums to /100) */}
      <div className="space-y-1">
        {BREAKDOWN_LABELS.map((entry) => {
          const value = breakdown[entry.key] ?? 0;
          const pct = Math.min(100, (Math.max(0, value) / entry.max) * 100);
          return (
            <div key={entry.key} className="flex items-center gap-2">
              <span className="w-12 shrink-0 font-mono text-[10px] text-[#8190a0]">{entry.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#161e27]">
                <span className="block h-full rounded-full bg-[#f3a33a]" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-10 shrink-0 text-right font-mono text-[10px] text-[#a8b5c2]">
                {Math.round(value)}/{entry.max}
              </span>
            </div>
          );
        })}
      </div>

      {/* Why this setup */}
      {triggered.length > 0 ? (
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5fd08a]">Why this setup</p>
          <ul className="space-y-0.5">
            {triggered.map((reason) => (
              <li key={reason} className="flex gap-1.5 text-[11px] leading-snug text-[#cdd8e3]">
                <span className="text-[#5fd08a]">▸</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Still needs / risks */}
      {watchItems.length > 0 ? (
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#f3a33a]">Watch / risks</p>
          <ul className="space-y-0.5">
            {watchItems.map((note) => (
              <li key={note} className="flex gap-1.5 text-[11px] leading-snug text-[#a8b5c2]">
                <span className="text-[#f3a33a]">!</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
