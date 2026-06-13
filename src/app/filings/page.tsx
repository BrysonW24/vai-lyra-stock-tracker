import { AppShell } from '@/components/AppShell';
import { FilingsView } from '@/components/filings/FilingsView';
import { getDashboardData } from '@/lib/data';

export default async function FilingsPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <FilingsView />
      </div>
    </AppShell>
  );
}
