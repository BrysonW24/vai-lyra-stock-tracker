import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { TickerDetail } from '@/components/TickerDetail';
import { TickerChartView } from '@/components/TickerChartView';
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

  if (!signal) {
    notFound();
  }

  const ticker = data.tickers.find((candidate) => candidate.symbol.toLowerCase() === symbol.toLowerCase());
  const exchange = ticker?.exchange === 'NYSE' ? 'NYSE' : 'NASDAQ';

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
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
