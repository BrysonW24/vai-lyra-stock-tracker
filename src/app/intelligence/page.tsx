import { AppShell } from '@/components/AppShell';
import { IntelligenceFeed } from '@/components/intelligence/IntelligenceFeed';
import { getDashboardData } from '@/lib/data';
import { demoIntelligenceFeed, demoTickerHypeMap } from '@/lib/intelligence';

/**
 * Intelligence page - async server component wrapping the client feed.
 */
export default async function IntelligencePage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <IntelligenceFeed feed={demoIntelligenceFeed} hypeMap={demoTickerHypeMap} />
    </AppShell>
  );
}
