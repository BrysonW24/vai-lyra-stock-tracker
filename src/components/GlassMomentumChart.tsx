import type { DashboardData } from '@/types/scanner';
import { DenseLineChart, MacdHistogramChart, ScoreHeatBars } from '@/components/ChartPrimitives';

interface GlassMomentumChartProps {
  data: DashboardData;
  compact?: boolean;
  /** The ticker this momentum read is about, e.g. "NVDA". Falls back to a generic label. */
  subject?: string;
}

export function GlassMomentumChart({ data, compact = false, subject }: GlassMomentumChartProps) {
  const history = data.scoreHistory;
  const labels = history.map((point) => point.label);

  if (compact) {
    return <ScoreHeatBars points={history} />;
  }

  const first = history[0];
  const latest = history[history.length - 1];
  const who = subject ?? 'the top-ranked setup';
  const scoreDelta = Math.round(latest.score - first.score);
  const pressureFading = latest.histogram > first.histogram; // negative histogram rising toward zero

  return (
    <section className="space-y-2">
      {/* Plain-English anchor: tells you what these two charts are about and what they say right now. */}
      <div className="terminal-panel rounded-md px-4 py-2.5 text-xs leading-relaxed text-[#a8b5c2]">
        Both charts below track <span className="font-mono font-semibold text-[#eef3f8]">{who}</span> - the strongest setup on the radar right now - across the last 7 hourly scans.
        {' '}Its setup score is <span className="font-semibold text-[#f3a33a]">{latest.score}/100</span>
        {scoreDelta > 0 ? `, up ${scoreDelta} points since 6h ago` : scoreDelta < 0 ? `, down ${Math.abs(scoreDelta)} points since 6h ago` : ''}
        {pressureFading ? ', and downward pressure is fading - momentum is building underneath it.' : '.'}
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <DenseLineChart
          title={`${who} · is the setup getting stronger?`}
          subtitle="Setup score (0-100, higher = more compelling) with the RSI momentum line behind it, over the last 7 hourly scans."
          labels={labels}
          series={[
            { label: 'Setup score', values: history.map((point) => point.score), color: '#f3a33a' },
            { label: 'RSI momentum', values: history.map((point) => point.rsi), color: '#60a5fa' },
          ]}
          height={310}
        />
        <MacdHistogramChart
          points={history}
          title={`${who} · momentum shift`}
          subtitle="MACD histogram, zero-centred like TradingView. Red bars below the line are bearish; as they shrink toward zero, downward pressure is easing - an early sign momentum is turning up."
        />
      </div>
    </section>
  );
}
