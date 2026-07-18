import type { ScorePoint, SignalRow } from '@/types/scanner';
import { MacdHistogramChart, ScoreHeatBars } from '@/components/ChartPrimitives';
import { StatusBadge } from '@/components/StatusBadge';
import { OutcomeHistoryPanel } from '@/components/tickers/OutcomeHistoryPanel';
import { TickerInsightsPanel } from '@/components/tickers/TickerInsightsPanel';
import { SaveButton } from '@/components/research/SaveButton';
import { ShareButton } from '@/components/native/ShareButton';
import { MetricHelp } from '@/components/education/MetricHelp';
import { buildScoreBreakdown } from '@/lib/score-breakdown';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, formatSignedPercent, relativeTime, toneClass, trendArrow } from '@/lib/format';

interface TickerDetailProps {
  signal: SignalRow;
  scoreHistory: ScorePoint[];
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const width = Math.min(100, Math.max(0, 50 + value));

  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 font-mono text-xs">
        <span className="text-[#8190a0]">{label}</span>
        <span className={toneClass(value)}>{formatSignedPercent(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-[#17202a]">
        <div className={value >= 0 ? 'h-full bg-[#43d18b]' : 'h-full bg-[#ff6b6b]'} style={{ width: `${width}%` }} />
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
          <p className="text-sm leading-5 text-[#dbe5ee]" key={item}>{item}</p>
        )) : (
          <p className="text-sm text-[#8190a0]">No backend entry.</p>
        )}
      </div>
    </div>
  );
}

export function TickerDetail({ signal, scoreHistory }: TickerDetailProps) {
  const scoreBreakdown = buildScoreBreakdown(signal.scoreBreakdown);

  return (
    <section className="space-y-3">
      <div className="terminal-panel rounded-md px-3 py-3">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-3xl font-semibold tracking-normal text-[#eef3f8]">{signal.symbol}</h1>
              <StatusBadge status={signal.status} />
              <span className="rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-xs text-[#f3a33a]">
                {signal.actionState.replaceAll('_', ' ')}
              </span>
              <span className="rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-xs text-[#a8b5c2]">
                {signal.lifecycleState.replaceAll('_', ' ')}
              </span>
              <SaveButton symbol={signal.symbol} label={signal.companyName} score={signal.score} price={signal.close} />
              <ShareButton
                title={`${signal.symbol} on Lyra`}
                text={`${signal.symbol} (${signal.companyName}) - Lyra oversold-recovery signal, score ${signal.score}`}
                url={`/tickers/${encodeURIComponent(signal.symbol)}`}
              />
            </div>
            <p className="mt-1 text-sm text-[#8190a0]">{signal.companyName}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-right font-mono sm:grid-cols-4 lg:min-w-[520px]">
            <div className="rounded border border-[#263241] bg-[#0d141c] p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Price</p>
              <p className="truncate text-sm font-semibold md:text-base">{formatCurrency(signal.close)}</p>
            </div>
            <div className="rounded border border-[#263241] bg-[#0d141c] p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">1H / 1D</p>
              <p className={`truncate text-sm font-semibold md:text-base ${toneClass(signal.priceChange1h)}`}>{formatSignedPercent(signal.priceChange1h)} / {formatSignedPercent(signal.priceChange1d)}</p>
            </div>
            <div className="rounded border border-[#263241] bg-[#0d141c] p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Score</p>
              <p className="truncate text-sm font-semibold md:text-base">{signal.score}/100 <span className={toneClass(signal.scoreDelta)}>{formatSignedNumber(signal.scoreDelta, 0)}</span></p>
            </div>
            <div className="rounded border border-[#263241] bg-[#0d141c] p-2">
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">Last scan</p>
              <p className="truncate text-sm font-semibold md:text-base">{relativeTime(signal.lastUpdated)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
        <TickerInsightsPanel signal={signal} />
        <ScoreHeatBars points={scoreHistory} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
        <MacdHistogramChart points={scoreHistory} />

        <section className="terminal-panel rounded-md p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Current metrics</p>
              <p className="mt-1 text-[10px] leading-snug text-[#6f7d8a]">Tap the ? on any metric for what it means and a link into the academy.</p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
                <span className="inline-flex items-center gap-1 text-[#8190a0]">RSI <MetricHelp moduleId="rsi" /></span>
                <span className="text-right text-[#dbe5ee]">{formatNumber(signal.rsi)} {trendArrow(signal.rsiDelta)} {formatSignedNumber(signal.rsiDelta)}</span>
                <span className="inline-flex items-center gap-1 text-[#8190a0]">MACD Hist <MetricHelp moduleId="macd-histogram" /></span>
                <span className="text-right text-[#dbe5ee]">{formatNumber(signal.macdHistogram, 2)} {trendArrow(signal.histDelta)} {formatSignedNumber(signal.histDelta, 2)}</span>
                <span className="inline-flex items-center gap-1 text-[#8190a0]">Volume ratio <MetricHelp moduleId="volume-confirmation" /></span>
                <span className="text-right text-[#dbe5ee]">{formatNumber(signal.volumeRatio, 2)}x</span>
                <span className="inline-flex items-center gap-1 text-[#8190a0]">60D low distance <MetricHelp moduleId="distance-from-low" /></span>
                <span className="text-right text-[#dbe5ee]">{formatPercent(signal.distanceFromLow)}</span>
                <span className="inline-flex items-center gap-1 text-[#8190a0]">MACD state <MetricHelp moduleId="macd" /></span>
                <span className="text-right text-[#dbe5ee]">{signal.macdState}</span>
              </div>
            </div>
            <div>
              <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Price vs moving averages <MetricHelp moduleId="moving-averages" /></p>
              <div className="mt-3 space-y-3">
                <MetricBar label="20MA" value={signal.priceVsSma20} />
                <MetricBar label="50MA" value={signal.priceVsSma50} />
                <MetricBar label="200MA" value={signal.priceVsSma200} />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="terminal-panel rounded-md p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Score breakdown</p>
          <p className="mt-1 text-[10px] leading-snug text-[#6f7d8a]">Points each factor added, out of its max - they sum to the {signal.score} score.</p>
          <div className="mt-3 space-y-3">
            {scoreBreakdown.map(({ label, value, max, pct }) => (
              <div key={label}>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-[#a8b5c2]">{label}</span>
                  <span className="text-[#dbe5ee]">{value}/{max}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-[#17202a]">
                  <div className="h-full bg-[#f3a33a]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="terminal-panel rounded-md p-4">
          <div className="grid gap-5 md:grid-cols-3">
            <ExplanationList title="Triggered because" items={signal.explanation.triggeredBecause} tone="text-[#43d18b]" />
            <ExplanationList title="Missing confirmation" items={signal.explanation.missingConfirmation} tone="text-[#f3a33a]" />
            <ExplanationList title="Risk notes" items={signal.explanation.riskNotes} tone="text-[#ff6b6b]" />
          </div>
        </section>
      </div>

      <OutcomeHistoryPanel signalType={signal.signalType} signalStatus={signal.status} />
    </section>
  );
}
