import { AppShell } from '@/components/AppShell';
import { CalendarView } from '@/components/calendar/CalendarView';
import { getDashboardData } from '@/lib/data';

export default async function CalendarPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <CalendarView signals={data.signals} />
    </AppShell>
  );
}
