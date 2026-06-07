import { AlertsTimeline } from '@/components/AlertsTimeline';
import { AppShell } from '@/components/AppShell';
import { getDashboardData } from '@/lib/data';

export default async function AlertsPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="pb-28 xl:pb-6">
        <AlertsTimeline alerts={data.alerts} signals={data.signals} />
      </div>
    </AppShell>
  );
}
