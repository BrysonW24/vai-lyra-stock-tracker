import { AppShell } from '@/components/AppShell';
import { SettingsPanel } from '@/components/SettingsPanel';
import { getDashboardData } from '@/lib/data';

export default async function SettingsPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="pb-28 xl:pb-6">
        <SettingsPanel data={data} />
      </div>
    </AppShell>
  );
}
