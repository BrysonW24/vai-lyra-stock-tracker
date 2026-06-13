import { AppShell } from '@/components/AppShell';
import { CapitalFlowsView } from '@/components/flows/CapitalFlowsView';
import { getDashboardData } from '@/lib/data';

export default async function FlowsPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <CapitalFlowsView />
      </div>
    </AppShell>
  );
}
