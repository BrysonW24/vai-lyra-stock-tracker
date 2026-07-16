import { AppShell } from '@/components/AppShell';
import { IpoExplorer } from '@/components/ipos/IpoExplorer';
import { getDashboardData } from '@/lib/data';
import { getIposLive } from '@/lib/ipos-live';

export const metadata = { title: 'IPO Radar' };
// Applies to the statically-cacheable DEMO render only: configured deploys are
// per-request dynamic because the Supabase server client reads cookies() (which also
// means every live request sees the nightly Finnhub sync immediately).
export const revalidate = 3600;

export default async function IposPage() {
  const [data, ipoData] = await Promise.all([getDashboardData(), getIposLive()]);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <IpoExplorer ipos={ipoData.ipos} source={ipoData.source} updatedAt={ipoData.updatedAt} />
      </div>
    </AppShell>
  );
}
