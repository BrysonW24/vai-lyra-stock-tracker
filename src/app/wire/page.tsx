import { AppShell } from '@/components/AppShell';
import { LiveWire } from '@/components/LiveWire';
import { getDashboardData } from '@/lib/data';
import { buildLiveWire } from '@/lib/feed';
import { getIntelligenceLive } from '@/lib/intelligence-live';
import { getCalendarEventsLive } from '@/lib/calendar-live';

export const metadata = { title: 'Live Wire' };

export default async function WirePage() {
  const [data, intel, calendar] = await Promise.all([
    getDashboardData(),
    getIntelligenceLive(),
    getCalendarEventsLive(),
  ]);
  const items = buildLiveWire(data.signalChanges, intel.feed, calendar.events, intel.source === 'sample');

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <LiveWire items={items} intelligenceIsSample={intel.source === 'sample'} />
      </div>
    </AppShell>
  );
}
