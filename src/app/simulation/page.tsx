import { AppShell } from '@/components/AppShell';
import { SimulationLab } from '@/components/simulation/SimulationLab';
import { getDashboardData } from '@/lib/data';

export const metadata = { title: 'Simulation Lab' };

export default async function SimulationPage() {
  const data = await getDashboardData();
  const soloMode = !(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <AppShell data={data}>
      <SimulationLab
        portfolio={data.portfolio}
        signals={data.signals}
        soloMode={soloMode}
      />
    </AppShell>
  );
}
