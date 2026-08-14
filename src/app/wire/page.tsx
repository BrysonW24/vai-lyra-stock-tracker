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
  // Sample rows render ONLY on the demo tour (standing honesty rule): a live/solo wire
  // whose news or calendar degraded to the bundled sample carries those streams empty
  // rather than tagged-but-fabricated. The per-item "· sample" tagging in buildLiveWire
  // stays as the second line of defence for the demo tour itself.
  const isDemoTour = data.mode === 'demo';
  const wireNews = intel.source === 'live' || isDemoTour ? intel.feed : [];
  const wireEvents = calendar.source === 'live' || isDemoTour ? calendar.events : [];
  const items = buildLiveWire(
    data.signalChanges,
    wireNews,
    wireEvents,
    intel.source === 'sample',
    calendar.source === 'sample',
    data.generatedFrom !== 'supabase',
    isDemoTour,
  );
  // Signal changes are live-derived on a supabase deploy (data.ts no longer substitutes
  // demo rows); on demo/solo datasets the change rows come from the bundled sample book.
  const hasLiveSignalChanges = data.generatedFrom === 'supabase' && data.signalChanges.length > 0;

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <LiveWire items={items} intelligenceIsSample={intel.source === 'sample'} hasLiveSignalChanges={hasLiveSignalChanges} />
      </div>
    </AppShell>
  );
}
