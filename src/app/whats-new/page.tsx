import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { WhatsNewClient } from '@/components/WhatsNewClient';
import { getDashboardData } from '@/lib/data';

export const metadata = {
  title: "What's New · Stock Momentum Radar",
};

export default async function WhatsNewPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="pb-28 xl:pb-6">
        <Suspense fallback={null}>
          <WhatsNewClient />
        </Suspense>
      </div>
    </AppShell>
  );
}
