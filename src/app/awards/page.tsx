import { AppShell } from '@/components/AppShell';
import { GovAwardsView } from '@/components/gov/GovAwardsView';
import { getDashboardData } from '@/lib/data';

export default async function AwardsPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <GovAwardsView />
      </div>
    </AppShell>
  );
}
