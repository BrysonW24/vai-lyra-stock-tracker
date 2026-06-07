import { AppShell } from '@/components/AppShell';
import { IpoExplorer } from '@/components/ipos/IpoExplorer';
import { getDashboardData } from '@/lib/data';

export default async function IposPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <IpoExplorer />
      </div>
    </AppShell>
  );
}
