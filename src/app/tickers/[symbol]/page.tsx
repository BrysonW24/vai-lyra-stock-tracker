import { AppShell } from '@/components/AppShell';
import { TickerDetail } from '@/components/TickerDetail';
import { TickerChartView } from '@/components/TickerChartView';
import { TickerNotScanned } from '@/components/TickerNotScanned';
import { TwinCaptureBeacon } from '@/components/twin/TwinCaptureBeacon';
import { getDashboardData } from '@/lib/data';
import { buildScoreHistory } from '@/lib/score-history';

interface TickerPageProps {
  params: Promise<{
    symbol: string;
  }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function TickerPage({ params, searchParams }: TickerPageProps) {
  const { symbol } = await params;
  const { view } = await searchParams;
  const data = await getDashboardData();
  const signal = data.signals.find((candidate) => candidate.symbol.toLowerCase() === symbol.toLowerCase());

  // Not a bare 404: a name the user typed but Lyra has not scanned gets an honest destination -
  // "not in the current scan set", plus the names it IS covering - rather than a dead end
  // (the 2026-07-27 audit V3 fix for the autocomplete -> 404 flow).
  if (!signal) {
    return (
      <AppShell data={data}>
        <TickerNotScanned
          symbol={symbol}
          scannedCount={data.signals.length}
          examples={data.signals.slice(0, 6).map((s) => ({ symbol: s.symbol, companyName: s.companyName }))}
        />
      </AppShell>
    );
  }

  const ticker = data.tickers.find((candidate) => candidate.symbol.toLowerCase() === symbol.toLowerCase());
  const exchange = ticker?.exchange === 'NYSE' ? 'NYSE' : 'NASDAQ';

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <TwinCaptureBeacon eventType="ticker_open" entityType="ticker" entityId={signal.symbol} meta={{ stage: signal.status }} />
        <TickerChartView
          symbol={signal.symbol}
          exchange={exchange}
          companyName={signal.companyName}
          fullSetup={view === 'setup'}
        />
        <TickerDetail
          signal={signal}
          scoreHistory={buildScoreHistory({
            symbol: signal.symbol,
            score: signal.score,
            rsi: signal.rsi,
            macdHistogram: signal.macdHistogram,
            scoreDelta: signal.scoreDelta,
            rsiDelta: signal.rsiDelta,
            histDelta: signal.histDelta,
            macdState: signal.macdState,
          })}
        />
      </div>
    </AppShell>
  );
}
