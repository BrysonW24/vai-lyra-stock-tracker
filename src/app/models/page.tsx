import { AppShell } from '@/components/AppShell';
import { ModelLab } from '@/components/models/ModelLab';
import { getDashboardData } from '@/lib/data';
import { loadEmergingWinnerQueue } from '@/lib/emerging-winner/load';

export const metadata = {
  title: 'Models',
  description:
    "Lyra's model catalogue - every model with its honest stage and provenance. The deterministic engine decides; models inform. Research, not advice.",
};

export const dynamic = 'force-dynamic';

export default async function ModelsPage() {
  const [data, ew] = await Promise.all([getDashboardData(), loadEmergingWinnerQueue()]);
  return (
    <AppShell data={data}>
      <ModelLab data={data} ew={ew} />
    </AppShell>
  );
}
