import { AppShell } from '@/components/AppShell';
import { IntelligenceFeed } from '@/components/intelligence/IntelligenceFeed';
import { Insight } from '@/components/Insight';
import { getDashboardData } from '@/lib/data';
import { demoIntelligenceFeed, demoTickerHypeMap } from '@/lib/intelligence';

export const metadata = { title: 'Intelligence' };

/**
 * Intelligence page - async server component wrapping the client feed, with a rotating
 * "Good to know" finance fact under the Intel banner.
 */
export default async function IntelligencePage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <Insight />
        <IntelligenceFeed feed={demoIntelligenceFeed} hypeMap={demoTickerHypeMap} />
      </div>
    </AppShell>
  );
}
