import { AppShell } from '@/components/AppShell';
import { EconomyReport } from '@/components/economy/EconomyReport';
import { getDashboardData } from '@/lib/data';
import { getEconomyRead } from '@/lib/economy/live';

export const metadata = {
  title: 'Australian Economy',
  description: 'What the latest ABS and RBA figures mean together - growth, living standards, jobs, inflation and rates.',
};

// Figures are cached per series for a few hours and every fetch degrades to an honest gap,
// so this never throws to the page. Dynamic so a fresh release is picked up when the cache turns.
export const dynamic = 'force-dynamic';

export default async function EconomyPage() {
  const [data, read] = await Promise.all([getDashboardData(), getEconomyRead()]);
  return (
    <AppShell data={data}>
      <EconomyReport read={read} />
    </AppShell>
  );
}
