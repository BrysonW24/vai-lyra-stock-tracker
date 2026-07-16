import { AppShell } from '@/components/AppShell';
import { SimulationLab } from '@/components/simulation/SimulationLab';
import { getDashboardData } from '@/lib/data';

export const metadata = { title: 'Simulation Lab' };

export default async function SimulationPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <SimulationLab portfolio={data.portfolio} />
    </AppShell>
  );
}
