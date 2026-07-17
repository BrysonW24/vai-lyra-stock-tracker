import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { SettingsTabs } from '@/components/account/SettingsTabs';
import { getDashboardData } from '@/lib/data';

/**
 * Shared shell for the settings family. The three settings pages (Account, AI Settings,
 * Notifications) each render just their own panels; this layout provides the app chrome and the
 * tab switcher so the split reads as one settings area rather than three unrelated screens.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <SettingsTabs />
        {children}
      </div>
    </AppShell>
  );
}
