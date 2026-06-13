import { AppShell } from '@/components/AppShell';
import { ChartsView } from '@/components/charts/ChartsView';
import { getDashboardData } from '@/lib/data';

export default async function ChartsPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <ChartsView data={data} />
      </div>
    </AppShell>
  );
}
