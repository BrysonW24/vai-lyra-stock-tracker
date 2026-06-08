import { AppShell } from '@/components/AppShell';
import { LiveWire } from '@/components/LiveWire';
import { getDashboardData } from '@/lib/data';
import { buildLiveWire } from '@/lib/feed';
import { demoIntelligenceFeed } from '@/lib/intelligence';
import { demoCalendarEvents } from '@/lib/calendar';

export default async function WirePage() {
  const data = await getDashboardData();
  const items = buildLiveWire(data.signalChanges, demoIntelligenceFeed, demoCalendarEvents);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <LiveWire items={items} />
      </div>
    </AppShell>
  );
}
