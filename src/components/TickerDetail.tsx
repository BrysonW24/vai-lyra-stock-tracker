import type { SignalRow } from '@/types/scanner';
import { StatusBadge } from '@/components/StatusBadge';
import { OutcomeHistoryPanel } from '@/components/tickers/OutcomeHistoryPanel';
import { TickerInsightsPanel } from '@/components/tickers/TickerInsightsPanel';
import { SetupScorecard } from '@/components/tickers/SetupScorecard';
import { ScanDeltaPanel } from '@/components/tickers/ScanDeltaPanel';
import { SaveButton } from '@/components/research/SaveButton';
import { ShareButton } from '@/components/native/ShareButton';
import { MetricHelp } from '@/components/education/MetricHelp';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, formatSignedPercent, relativeTime, toneClass, trendArrow } from '@/lib/format';

interface TickerDetailProps {
  signal: SignalRow;
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const width = Math.min(100, Math.max(0, 50 + value));

  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 font-mono text-xs">
        <span className="text-ink-3">{label}</span>
        <span className={toneClass(value)}>{formatSignedPercent(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-line/70">
        <div className={value >= 0 ? 'h-full bg-positive' : 'h-full bg-negative'} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ExplanationList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${tone}`}>{title}</p>
      <div className="mt-2 space-y-1.5">
        {items.length > 0 ? items.map((item) => (
          <p className="text-sm leading-5 text-ink-title" key={item}>{item}</p>
        )) : (
          <p className="text-sm text-ink-3">No backend entry.</p>
        )}
      </div>
    </div>
  );
}

export function TickerDetail({ signal }: TickerDetailProps) {
  return (
    <section className="space-y-3">
      <div className="terminal-panel rounded-panel px-3 py-3">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-3xl font-semibold tracking-normal text-ink">{signal.symbol}</h1>
              <StatusBadge status={signal.status} />
              <span className="rounded border border-line-strong bg-panel px-2 py-1 font-mono text-xs text-accent">
                {signal.actionState.replaceAll('_', ' ')}
              </span>
              <span className="rounded border border-line-strong bg-panel px-2 py-1 font-mono text-xs text-ink-2">
                {signal.lifecycleState.replaceAll('_', ' ')}
              </span>
              <SaveButton symbol={signal.symbol} label={signal.companyName} score={signal.score} price={signal.close} />
              <ShareButton
                title={`${signal.symbol} on Lyra`}
                text={`${signal.symbol} (${signal.companyName}) - Lyra oversold-recovery signal, score ${signal.score}`}
                url={`/tickers/${encodeURIComponent(signal.symbol)}`}
              />
            </div>
            <p className="mt-1 text-sm text-ink-3">{signal.companyName}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-right font-mono sm:grid-cols-4 lg:min-w-[520px]">
            <div className="rounded-cell border border-line-strong bg-panel p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">Price</p>
              <p className="truncate text-sm font-semibold md:text-base">{formatCurrency(signal.close)}</p>
            </div>
            <div className="rounded-cell border border-line-strong bg-panel p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">1H / 1D</p>
              <p className={`truncate text-sm font-semibold md:text-base ${toneClass(signal.priceChange1h)}`}>{formatSignedPercent(signal.priceChange1h)} / {formatSignedPercent(signal.priceChange1d)}</p>
            </div>
            <div className="rounded-cell border border-line-strong bg-panel p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">Score</p>
              <p className="truncate text-sm font-semibold md:text-base">{signal.score}/100 <span className={toneClass(signal.scoreDelta)}>{formatSignedNumber(signal.scoreDelta, 0)}</span></p>
            </div>
            <div className="rounded-cell border border-line-strong bg-panel p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">Last scan</p>
              <p className="truncate text-sm font-semibold md:text-base">{relativeTime(signal.lastUpdated)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
        <TickerInsightsPanel signal={signal} />
        <SetupScorecard signal={signal} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
        <ScanDeltaPanel signal={signal} />

        <section className="terminal-panel rounded-panel p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Current metrics</p>
              <p className="mt-1 text-[10px] leading-snug text-ink-dim">Tap the ? on any metric for what it means and a link into the academy.</p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
                <span className="inline-flex items-center gap-1 text-ink-3">RSI <MetricHelp moduleId="rsi" /></span>
                <span className="text-right text-ink-title">{formatNumber(signal.rsi)} {trendArrow(signal.rsiDelta)} {formatSignedNumber(signal.rsiDelta)}</span>
                <span className="inline-flex items-center gap-1 text-ink-3">MACD Hist <MetricHelp moduleId="macd-histogram" /></span>
                <span className="text-right text-ink-title">{formatNumber(signal.macdHistogram, 2)} {trendArrow(signal.histDelta)} {formatSignedNumber(signal.histDelta, 2)}</span>
                <span className="inline-flex items-center gap-1 text-ink-3">Volume ratio <MetricHelp moduleId="volume-confirmation" /></span>
                <span className="text-right text-ink-title">{formatNumber(signal.volumeRatio, 2)}x</span>
                <span className="inline-flex items-center gap-1 text-ink-3">60D low distance <MetricHelp moduleId="distance-from-low" /></span>
                <span className="text-right text-ink-title">{formatPercent(signal.distanceFromLow)}</span>
                <span className="inline-flex items-center gap-1 text-ink-3">MACD state <MetricHelp moduleId="macd" /></span>
                <span className="text-right text-ink-title">{signal.macdState}</span>
              </div>
            </div>
            <div>
              <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Price vs moving averages <MetricHelp moduleId="moving-averages" /></p>
              <div className="mt-3 space-y-3">
                <MetricBar label="20MA" value={signal.priceVsSma20} />
                <MetricBar label="50MA" value={signal.priceVsSma50} />
                <MetricBar label="200MA" value={signal.priceVsSma200} />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="terminal-panel rounded-panel p-4">
        <div className="grid gap-5 md:grid-cols-3">
          <ExplanationList title="Triggered because" items={signal.explanation.triggeredBecause} tone="text-positive" />
          <ExplanationList title="Missing confirmation" items={signal.explanation.missingConfirmation} tone="text-accent" />
          <ExplanationList title="Risk notes" items={signal.explanation.riskNotes} tone="text-negative" />
        </div>
      </section>

      <OutcomeHistoryPanel signalType={signal.signalType} signalStatus={signal.status} />
    </section>
  );
}
