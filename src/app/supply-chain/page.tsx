import { AppShell } from '@/components/AppShell';
import { SupplyChainGraph } from '@/components/supply-chain/SupplyChainGraph';
import { getDashboardData } from '@/lib/data';

export default async function SupplyChainPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <SupplyChainGraph />
      </div>
    </AppShell>
  );
}
