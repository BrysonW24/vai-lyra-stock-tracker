import { AppShell } from '@/components/AppShell';
import { ModelsView } from '@/components/models/ModelsView';
import { getDashboardData } from '@/lib/data';

export const metadata = {
  title: 'Models',
  description:
    "Lyra's model catalogue - every model with its honest stage and provenance. The deterministic engine decides; models inform. Research, not advice.",
};

export const dynamic = 'force-dynamic';

export default async function ModelsPage() {
  const data = await getDashboardData();
  return (
    <AppShell data={data}>
      <ModelsView />
    </AppShell>
  );
}
