import { AppShell } from '@/components/AppShell';
import { CalendarView } from '@/components/calendar/CalendarView';
import { getCalendarEventsLive } from '@/lib/calendar-live';
import { getDashboardData } from '@/lib/data';

export const metadata = { title: 'Calendar' };
// Applies to the statically-cacheable DEMO render only: configured deploys are
// per-request dynamic because the Supabase server client reads cookies(). Kept so a
// keyless deploy refreshes its baked-in "today" hourly instead of never.
export const revalidate = 3600;

export default async function CalendarPage() {
  const now = new Date();
  const [data, calendar] = await Promise.all([getDashboardData(), getCalendarEventsLive(now)]);

  return (
    <AppShell data={data}>
      <CalendarView
        signals={data.signals}
        events={calendar.events}
        source={calendar.source}
        todayIso={now.toISOString().slice(0, 10)}
      />
    </AppShell>
  );
}
